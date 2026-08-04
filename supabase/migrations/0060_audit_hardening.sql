-- 0060_audit_hardening.sql — Durcissement post-audit 2026-08-04
-- 1. recompute_perf_strings : retire EXECUTE à PUBLIC/anon (la fonction est
--    SECURITY DEFINER sans garde d'identité et pose un verrou ACCESS EXCLUSIVE
--    sur parfums — appelable par la clé anon embarquée dans l'APK).
--    Le grant service_role existant (0058) suffit au cron pg_cron.
--    Pattern identique à 0006_functions.sql (check_and_increment_quota, export_user_data).
-- 2. runner_scores.skin : contrainte de longueur + troncature côté RPC.
-- 3. export_user_data : complétude RGPD (parfum_votes, follows, profiles, runner_scores).

-- ── 1. recompute_perf_strings : revoke PUBLIC/anon ──────────────────────────
revoke all on function public.recompute_perf_strings() from public, anon;

-- ── 2. runner_scores.skin borné ─────────────────────────────────────────────
alter table public.runner_scores
  add constraint runner_scores_skin_len check (length(skin) <= 32);

create or replace function public.submit_runner_score(
  p_score integer,
  p_distance integer default 0,
  p_max_combo integer default 0,
  p_skin text default 'default'
)
returns integer
language plpgsql volatile security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  capped integer;
  new_rank integer;
begin
  if uid is null then
    raise exception 'auth required';
  end if;

  -- Anti-triche : plafond généreux (un run extrême dépasse difficilement 10k).
  capped := greatest(0, least(coalesce(p_score, 0), 50000));

  insert into public.runner_scores (user_id, score, distance, max_combo, skin, created_at)
  values (
    uid,
    capped,
    greatest(0, least(coalesce(p_distance, 0), 1000000)),
    greatest(0, least(coalesce(p_max_combo, 0), 100000)),
    left(coalesce(nullif(p_skin, ''), 'default'), 32),
    now()
  )
  on conflict (user_id) do update set
    score      = greatest(runner_scores.score, excluded.score),
    distance   = case when excluded.score > runner_scores.score then excluded.distance  else runner_scores.distance  end,
    max_combo  = case when excluded.score > runner_scores.score then excluded.max_combo else runner_scores.max_combo end,
    skin       = case when excluded.score > runner_scores.score then excluded.skin      else runner_scores.skin      end,
    created_at = case when excluded.score > runner_scores.score then excluded.created_at else runner_scores.created_at end;

  -- Rang cohérent avec runner_leaderboard (même ordre total : score desc, created_at asc).
  select r.rank into new_rank
  from (
    select user_id, row_number() over (order by score desc, created_at asc)::int as rank
    from public.runner_scores
  ) r
  where r.user_id = uid;

  return new_rank;
end;
$$;

-- ── 3. export_user_data v3.1.0 : complétude RGPD ────────────────────────────
create or replace function public.export_user_data()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_out jsonb;
begin
  if v_uid is null then
    raise exception 'unauthenticated';
  end if;

  select jsonb_build_object(
    'exportedAt', now(),
    'app', 'Sillage',
    'version', '3.1.0',
    'collections', jsonb_build_object(
      'favoris',      (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.favoris t where t.user_id = v_uid),
      'userParfum',   (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.user_parfum t where t.user_id = v_uid),
      'possessions',  (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.possessions t where t.user_id = v_uid),
      'scans',        (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.scans t where t.user_id = v_uid),
      'shelves',      (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.shelves t where t.user_id = v_uid),
      'sotd',         (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.sotd t where t.user_id = v_uid),
      'priceAlerts',  (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.price_alerts t where t.user_id = v_uid),
      'perfVotes',    (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.parfum_votes t where t.user_id = v_uid),
      'following',    (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.follows t where t.follower_id = v_uid),
      'followers',    (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.follows t where t.following_id = v_uid),
      'runnerScore',  (select to_jsonb(t) from public.runner_scores t where t.user_id = v_uid),
      'profile',      (select to_jsonb(t) from public.profiles t where t.user_id = v_uid),
      'settings',     (select to_jsonb(t) from public.user_settings t where t.user_id = v_uid)
    ),
    'excluded', jsonb_build_array(
      jsonb_build_object(
        'table', 'push_tokens',
        'reason', 'Identifiants techniques de notification, régénérés automatiquement'
      )
    )
  ) into v_out;

  return v_out;
end;
$$;

revoke all on function public.export_user_data() from public, anon;
grant execute on function public.export_user_data() to authenticated;
