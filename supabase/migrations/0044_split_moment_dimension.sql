-- 0044_split_moment_dimension.sql — Sépare la dimension « moment » (jour/nuit)
-- de la dimension « season » dans parfum_votes.
--
-- Bug corrigé : la clé primaire de parfum_votes est (parfum_id, user_id, dimension).
-- En 0042, les votes saison (value='summer') ET moment (value='day') partageaient
-- dimension='season' → un vote moment entrait en conflit PK avec le vote saison et
-- l'écrasait (ON CONFLICT DO UPDATE). On crée donc une dimension 'moment' distincte :
-- un utilisateur peut avoir 1 vote saison + 1 vote moment par parfum, sans conflit.
--
-- Impact :
--   • cast_vote accepte 'moment' (valeurs 'day'/'night') ; 'season' restreint aux
--     4 saisons (spring/summer/fall/winter).
--   • parfum_perf lit les comptes jour/nuit + myMoment depuis dimension='moment',
--     les comptes saison + mySeason depuis dimension='season', et seasonUserVotes
--     couvre les deux dimensions (compteur « Quand le porter »).
--   • La logique de fusion Fragrantica (bornage PERF_CAP, poids) est inchangée —
--     seul l'origine des votes utilisateur moment change. Supersède 0043 (conserve
--     le fix de boucle `r`).

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. Contrainte de dimension : autorise 'moment'
-- ═══════════════════════════════════════════════════════════════════════════
-- La contrainte check inline de 0042 a été nommée automatiquement par Postgres
-- (parfum_votes_dimension_check). On la remplace par l'ensemble élargi.

alter table public.parfum_votes
  drop constraint if exists parfum_votes_dimension_check;

alter table public.parfum_votes
  add constraint parfum_votes_dimension_check
  check (dimension in ('longevity', 'sillage', 'season', 'moment'));

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. RPC cast_vote — validation par dimension (moment séparé)
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.cast_vote(p_parfum_id text, p_dimension text, p_value text)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  valid boolean;
begin
  if uid is null then
    raise exception 'auth required';
  end if;
  if p_dimension not in ('longevity', 'sillage', 'season', 'moment') then
    raise exception 'invalid dimension %', p_dimension;
  end if;

  if p_value is null then
    delete from public.parfum_votes
      where parfum_id = p_parfum_id and user_id = uid and dimension = p_dimension;
    return;
  end if;

  valid := case p_dimension
    when 'longevity' then p_value in ('1','2','3','4')
    when 'sillage'   then p_value in ('1','2','3','4')
    when 'season'    then p_value in ('spring','summer','fall','winter')
    when 'moment'    then p_value in ('day','night')
  end;
  if not valid then
    raise exception 'invalid value % for dimension %', p_value, p_dimension;
  end if;

  insert into public.parfum_votes (parfum_id, user_id, dimension, value)
  values (p_parfum_id, uid, p_dimension, p_value)
  on conflict (parfum_id, user_id, dimension)
  do update set value = excluded.value, updated_at = now();
end;
$$;

grant execute on function public.cast_vote(text, text, text) to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. RPC parfum_perf — lecture moment depuis dimension='moment'
-- ═══════════════════════════════════════════════════════════════════════════
-- Identique à 0043 (boucle `r`, fusion Fragrantica bornée) sauf :
--   • comptes jour/nuit utilisateur lus sur dimension='moment' (boucle séparée) ;
--   • myMoment lu sur dimension='moment' ;
--   • seasonUserVotes = count sur dimension IN ('season','moment').

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
