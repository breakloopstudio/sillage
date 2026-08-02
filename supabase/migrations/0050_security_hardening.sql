-- ═══════════════════════════════════════════════════════════════════════════
-- 0050 — Durcissement sécurité (audit BDD v9)
--   D1 · parfum_perf : ignore le p_user_id fourni par le client, force auth.uid()
--        (la fonction SECURITY DEFINER contournait la RLS owner-only de parfum_votes
--         et pouvait lire le vote individuel « privé » d'un autre utilisateur)
--   D2 · RPC étagères : valide que p_shelf_id appartient à l'appelant
--        (évite les rows shelf_items orphelines pointant vers l'étagère d'autrui)
--   D3 · public_followers / public_following : plafonne le paramètre lim (≤ 100)
-- ═══════════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────────
-- D1 · parfum_perf — p_user_id := auth.uid()
-- ───────────────────────────────────────────────────────────────────────────
create or replace function public.parfum_perf(p_parfum_id text, p_user_id uuid default null)
returns jsonb
language plpgsql stable security definer
set search_path = public
as $$
declare
  PERF_CAP      constant numeric := 100;
  p             record;
  long_cranks   numeric[];
  sill_cranks   numeric[];
  long_ucranks  numeric[];
  sill_ucranks  numeric[];
  long_score    numeric;
  sill_score    numeric;
  long_level    int;
  sill_level    int;
  long_frag_eq  numeric;
  sill_frag_eq  numeric;
  long_uvotes   int;
  sill_uvotes   int;
  srank         jsonb;
  frag_season   jsonb;
  season_total  numeric;
  season_poids  numeric;
  season_out    jsonb;
  daynight_out  jsonb;
  my_long       int;
  my_sill       int;
  my_season     text;
  my_moment     text;
  r             record;
begin
  -- Sécurité : on ne lit jamais le vote d'un autre utilisateur.
  -- Le paramètre client est ignoré au profit de l'identité réelle de l'appelant.
  p_user_id := auth.uid();

  select longevity_breakout, sillage_breakout, season_ranking
    into p from public.parfums where id = p_parfum_id;
  if not found then
    return null;
  end if;

  -- ── Longévité & sillage ──
  long_cranks  := public._perf_cranks(p.longevity_breakout, 'longevity');
  sill_cranks  := public._perf_cranks(p.sillage_breakout, 'sillage');
  long_ucranks := public._user_cranks(p_parfum_id, 'longevity');
  sill_ucranks := public._user_cranks(p_parfum_id, 'sillage');

  long_score := public._perf_score(long_cranks, long_ucranks, PERF_CAP);
  sill_score := public._perf_score(sill_cranks, sill_ucranks, PERF_CAP);
  long_level := case when long_score is null then null else greatest(1, least(4, round(long_score)::int)) end;
  sill_level := case when sill_score is null then null else greatest(1, least(4, round(sill_score)::int)) end;

  long_frag_eq := (long_cranks[1]+long_cranks[2]+long_cranks[3]+long_cranks[4])
                  * coalesce(least(PERF_CAP, long_cranks[1]+long_cranks[2]+long_cranks[3]+long_cranks[4])
                             / nullif(long_cranks[1]+long_cranks[2]+long_cranks[3]+long_cranks[4], 0), 0);
  sill_frag_eq := (sill_cranks[1]+sill_cranks[2]+sill_cranks[3]+sill_cranks[4])
                  * coalesce(least(PERF_CAP, sill_cranks[1]+sill_cranks[2]+sill_cranks[3]+sill_cranks[4])
                             / nullif(sill_cranks[1]+sill_cranks[2]+sill_cranks[3]+sill_cranks[4], 0), 0);

  long_uvotes := (long_ucranks[1]+long_ucranks[2]+long_ucranks[3]+long_ucranks[4])::int;
  sill_uvotes := (sill_ucranks[1]+sill_ucranks[2]+sill_ucranks[3]+sill_ucranks[4])::int;

  if p_user_id is not null then
    select value::int into my_long from public.parfum_votes
      where parfum_id = p_parfum_id and user_id = p_user_id and dimension = 'longevity';
    select value::int into my_sill from public.parfum_votes
      where parfum_id = p_parfum_id and user_id = p_user_id and dimension = 'sillage';
  end if;

  -- ── Saison + jour/nuit (fusion Fragrantica bornée) ──
  srank := coalesce(p.season_ranking, '[]'::jsonb);
  frag_season := '{}'::jsonb;
  season_total := 0;
  for r in
    select (e ->> 'name') as name, (e ->> 'score')::numeric as score
    from jsonb_array_elements(srank) e
  loop
    declare
      fk text := case when r.name = 'autumn' then 'fall' else r.name end;
      fv numeric := coalesce((frag_season ->> fk)::numeric, 0);
    begin
      season_total := season_total + r.score;
      frag_season := jsonb_set(frag_season, array[fk], to_jsonb(fv + r.score));
    end;
  end loop;

  season_poids := coalesce(least(PERF_CAP, season_total) / nullif(season_total, 0), 0);

  -- Comptes utilisateur par saison (dimension='season')
  season_out := '{}'::jsonb;
  for r in select value, count(*) as n from public.parfum_votes
           where parfum_id = p_parfum_id and dimension = 'season' group by value
  loop
    if r.value in ('spring','summer','fall','winter') then
      season_out := jsonb_set(season_out, array[r.value],
        to_jsonb(coalesce((season_out ->> r.value)::numeric, 0) + r.n));
    end if;
  end loop;

  -- Comptes utilisateur par moment (dimension='moment')
  daynight_out := '{}'::jsonb;
  for r in select value, count(*) as n from public.parfum_votes
           where parfum_id = p_parfum_id and dimension = 'moment' group by value
  loop
    if r.value in ('day','night') then
      daynight_out := jsonb_set(daynight_out, array[r.value],
        to_jsonb(coalesce((daynight_out ->> r.value)::numeric, 0) + r.n));
    end if;
  end loop;

  -- Fusion frag×poids + user pour chaque saison / moment
  season_out := jsonb_build_object(
    'spring', coalesce((frag_season ->> 'spring')::numeric, 0) * season_poids + coalesce((season_out ->> 'spring')::numeric, 0),
    'summer', coalesce((frag_season ->> 'summer')::numeric, 0) * season_poids + coalesce((season_out ->> 'summer')::numeric, 0),
    'fall',   coalesce((frag_season ->> 'fall')::numeric, 0)   * season_poids + coalesce((season_out ->> 'fall')::numeric, 0),
    'winter', coalesce((frag_season ->> 'winter')::numeric, 0) * season_poids + coalesce((season_out ->> 'winter')::numeric, 0)
  );
  daynight_out := jsonb_build_object(
    'day',   coalesce((frag_season ->> 'day')::numeric, 0)   * season_poids + coalesce((daynight_out ->> 'day')::numeric, 0),
    'night', coalesce((frag_season ->> 'night')::numeric, 0) * season_poids + coalesce((daynight_out ->> 'night')::numeric, 0)
  );

  if p_user_id is not null then
    select value into my_season from public.parfum_votes
      where parfum_id = p_parfum_id and user_id = p_user_id and dimension = 'season'
        and value in ('spring','summer','fall','winter') limit 1;
    select value into my_moment from public.parfum_votes
      where parfum_id = p_parfum_id and user_id = p_user_id and dimension = 'moment'
        and value in ('day','night') limit 1;
  end if;

  return jsonb_build_object(
    'longevity', jsonb_build_object(
      'level', long_level,
      'valueLabel', public._perf_label('longevity', long_level),
      'score', long_score,
      'fragEquiv', long_frag_eq,
      'userVotes', long_uvotes,
      'myVote', my_long
    ),
    'sillage', jsonb_build_object(
      'level', sill_level,
      'valueLabel', public._perf_label('sillage', sill_level),
      'score', sill_score,
      'fragEquiv', sill_frag_eq,
      'userVotes', sill_uvotes,
      'myVote', my_sill
    ),
    'season', season_out,
    'dayNight', daynight_out,
    'seasonUserVotes', (
      select count(*) from public.parfum_votes
        where parfum_id = p_parfum_id and dimension in ('season', 'moment')
    ),
    'mySeason', my_season,
    'myMoment', my_moment
  );
end;
$$;

grant execute on function public.parfum_perf(text, uuid) to anon, authenticated;

-- ───────────────────────────────────────────────────────────────────────────
-- D2 · RPC étagères — garde de propriété sur p_shelf_id
-- ───────────────────────────────────────────────────────────────────────────
create or replace function public.add_to_shelf(p_shelf_id uuid, p_parfum_id text)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_max int;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if not exists (select 1 from public.shelves where id = p_shelf_id and user_id = v_uid) then
    raise exception 'shelf not found';
  end if;
  select coalesce(max(position), -1) + 1 into v_max
    from public.shelf_items where user_id = v_uid and shelf_id = p_shelf_id;
  insert into public.shelf_items (user_id, shelf_id, parfum_id, position, pinned, added_at)
    values (v_uid, p_shelf_id, p_parfum_id, v_max, false, now())
    on conflict (user_id, shelf_id, parfum_id) do nothing;
  update public.user_parfum
     set shelf_ids = array_append(shelf_ids, p_shelf_id), updated_at = now()
   where user_id = v_uid and parfum_id = p_parfum_id
     and not (p_shelf_id = any(shelf_ids));
end;
$$;

create or replace function public.remove_from_shelf(p_shelf_id uuid, p_parfum_id text)
returns void
language plpgsql security definer
set search_path = public
as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if not exists (select 1 from public.shelves where id = p_shelf_id and user_id = v_uid) then
    raise exception 'shelf not found';
  end if;
  delete from public.shelf_items
   where user_id = v_uid and shelf_id = p_shelf_id and parfum_id = p_parfum_id;
  update public.user_parfum
     set shelf_ids = array_remove(shelf_ids, p_shelf_id), updated_at = now()
   where user_id = v_uid and parfum_id = p_parfum_id
     and p_shelf_id = any(shelf_ids);
end;
$$;

create or replace function public.pin_shelf_item(p_shelf_id uuid, p_parfum_id text, p_pinned boolean)
returns void
language plpgsql security definer
set search_path = public
as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if not exists (select 1 from public.shelves where id = p_shelf_id and user_id = v_uid) then
    raise exception 'shelf not found';
  end if;
  update public.shelf_items set pinned = p_pinned
   where user_id = v_uid and shelf_id = p_shelf_id and parfum_id = p_parfum_id;
end;
$$;

create or replace function public.reorder_shelf_items(p_shelf_id uuid, p_items jsonb)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_el  jsonb;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if not exists (select 1 from public.shelves where id = p_shelf_id and user_id = v_uid) then
    raise exception 'shelf not found';
  end if;
  for v_el in select * from jsonb_array_elements(p_items)
  loop
    update public.shelf_items
       set position = (v_el ->> 'position')::int,
           pinned   = coalesce((v_el ->> 'pinned')::boolean, false)
      where user_id = v_uid and shelf_id = p_shelf_id
        and parfum_id = (v_el ->> 'parfum_id');
  end loop;
end;
$$;

grant execute on function public.add_to_shelf(uuid, text)            to authenticated;
grant execute on function public.remove_from_shelf(uuid, text)       to authenticated;
grant execute on function public.pin_shelf_item(uuid, text, boolean) to authenticated;
grant execute on function public.reorder_shelf_items(uuid, jsonb)    to authenticated;

-- ───────────────────────────────────────────────────────────────────────────
-- D3 · public_followers / public_following — plafonne lim à 100
-- ───────────────────────────────────────────────────────────────────────────
create or replace function public.public_followers(p_pseudo text, lim int default 20)
returns table (pseudo text, avatar_url text)
language sql stable security definer
set search_path = public
as $$
  select fp.pseudo, fp.avatar_url
  from public.follows f
  join public.profiles tp on tp.user_id = f.following_id
  join public.profiles fp on fp.user_id = f.follower_id
  where tp.pseudo = p_pseudo
    and tp.is_public = true
    and fp.is_public = true
  order by f.created_at desc
  limit least(greatest(coalesce(lim, 20), 1), 100);
$$;

create or replace function public.public_following(p_pseudo text, lim int default 20)
returns table (pseudo text, avatar_url text)
language sql stable security definer
set search_path = public
as $$
  select fp.pseudo, fp.avatar_url
  from public.follows f
  join public.profiles tp on tp.user_id = f.follower_id
  join public.profiles fp on fp.user_id = f.following_id
  where tp.pseudo = p_pseudo
    and tp.is_public = true
    and fp.is_public = true
  order by f.created_at desc
  limit least(greatest(coalesce(lim, 20), 1), 100);
$$;

grant execute on function public.public_followers(text, int) to anon, authenticated;
grant execute on function public.public_following(text, int) to anon, authenticated;
