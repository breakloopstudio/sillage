-- 0041_runner_scores.sql — Leaderboard Flacon Runner (communauté Phase 3)
-- Un seul score par utilisateur (leur meilleur run). Soumission = acte opt-in
-- (on ne peut pas soumettre sans auth). Lecture publique via RPC SECURITY DEFINER.

create table if not exists public.runner_scores (
  user_id uuid primary key references auth.users(id) on delete cascade,
  score integer not null default 0,
  distance integer not null default 0,
  max_combo integer not null default 0,
  skin text not null default 'default',
  created_at timestamptz not null default now()
);

alter table public.runner_scores enable row level security;

-- Leaderboard lu publiquement et trié par score : index couvrant l'ordre total.
create index if not exists runner_scores_score_idx
  on public.runner_scores (score desc, created_at asc);

-- Défense en profondeur (les RPC SECURITY DEFINER contournent RLS) :
-- bloque toute écriture/lecture PostgREST directe non-owner.
create policy runner_scores_select_own on public.runner_scores
  for select to authenticated using (auth.uid() = user_id);

create policy runner_scores_insert_own on public.runner_scores
  for insert to authenticated with check (auth.uid() = user_id);

create policy runner_scores_update_own on public.runner_scores
  for update to authenticated using (auth.uid() = user_id);

-- ── Soumission (upsert du meilleur score) ───────────────────────────────────
-- Retourne le nouveau rang mondial de l'utilisateur (1 = meilleur).
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
    coalesce(nullif(p_skin, ''), 'default'),
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

-- ── Classement (lecture publique) ───────────────────────────────────────────
create or replace function public.runner_leaderboard(lim integer default 100)
returns table (
  rank integer,
  is_me boolean,
  pseudo text,
  avatar_url text,
  score integer,
  distance integer,
  max_combo integer,
  skin text,
  created_at timestamptz
)
language sql stable security definer
set search_path = public
as $$
  select
    row_number() over (order by rs.score desc, rs.created_at asc)::int as rank,
    (rs.user_id = auth.uid()) as is_me,
    p.pseudo,
    p.avatar_url,
    rs.score,
    rs.distance,
    rs.max_combo,
    rs.skin,
    rs.created_at
  from public.runner_scores rs
  left join public.profiles p on p.user_id = rs.user_id and p.is_public = true
  order by rs.score desc, rs.created_at asc
  limit greatest(1, least(coalesce(lim, 100), 100));
$$;

grant execute on function public.submit_runner_score(integer, integer, integer, text) to authenticated;
grant execute on function public.runner_leaderboard(integer) to anon, authenticated;
