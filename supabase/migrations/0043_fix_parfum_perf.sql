-- 0043_fix_parfum_perf.sql — Corrige la RPC parfum_perf (0042) : simplifie les
-- boucles saison qui référençaient `k.name/k.value` dans des expressions trop
-- imbriquées (PostgreSQL n'y résolvait pas la variable de boucle).
-- "missing FROM-clause entry for table 'k'" → réécriture avec variables locales.

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

  -- ── Saison + jour/nuit ──
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

  season_out := '{}'::jsonb;
  daynight_out := '{}'::jsonb;
  for r in select value, count(*) as n from public.parfum_votes
           where parfum_id = p_parfum_id and dimension = 'season' group by value
  loop
    if r.value in ('spring','summer','fall','winter') then
      season_out := jsonb_set(season_out, array[r.value],
        to_jsonb(coalesce((season_out ->> r.value)::numeric, 0) + r.n));
    elsif r.value in ('day','night') then
      daynight_out := jsonb_set(daynight_out, array[r.value],
        to_jsonb(coalesce((daynight_out ->> r.value)::numeric, 0) + r.n));
    end if;
  end loop;

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
      where parfum_id = p_parfum_id and user_id = p_user_id and dimension = 'season'
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
      select count(*) from public.parfum_votes where parfum_id = p_parfum_id and dimension = 'season'
    ),
    'mySeason', my_season,
    'myMoment', my_moment
  );
end;
$$;

grant execute on function public.parfum_perf(text, uuid) to anon, authenticated;
