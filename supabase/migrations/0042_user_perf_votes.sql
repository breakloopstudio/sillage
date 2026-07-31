-- 0042_user_perf_votes.sql — Votes utilisateurs sur la performance olfactive
-- (longévité, sillage, saison, jour/nuit) — réappropriation progressive de la base.
--
-- Principe du calcul (fusion) :
--   • Fragrantica fournit une *distribution* de votes (breakout) par parfum.
--     On la borne à PERF_CAP équivalents en conservant exactement sa forme
--     (poids = min(CAP, total)/total), puis on ajoute nos votes à plein poids.
--   • À 0 vote user, la moyenne est strictement celle de Fragrantica (jour 1
--     identique). À mesure que la communauté vote, nos votes dépassent la borne
--     et finissent par dominer — réappropriation sur le long terme.
--   • PERF_CAP = 100, calibré sur la distribution réelle du catalogue
--     (médiane Fragrantica = 56 votes ; P25 = 16 ; P90 = 657). min(total,100)/total
--     laisse la moitié du catalogue intacte (poids 1) et borne l'autre moitié.
--
-- Échelle : Fragrantica vote sur 5 niveaux (longévité) / 4 (sillage) ; l'UI
-- affiche 4 crans. On normalise le breakout Fragrantica en 4 crans avant fusion
-- (very weak + weak → cran 1 ; moderate → 2 ; long lasting → 3 ; eternal → 4).

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. Colonnes de distribution Fragrantica sur parfums
-- ═══════════════════════════════════════════════════════════════════════════
-- Format jsonb identique à data/clean : [{"weak":280},{"moderate":1537},…].
-- Alimentées par le backfill (clean → base) pour l'existant et par import-fresh
-- pour les nouveaux scrapes. NULL = pas de votes Fragrantica connus.

alter table public.parfums
  add column if not exists longevity_breakout jsonb,
  add column if not exists sillage_breakout jsonb;

comment on column public.parfums.longevity_breakout is
  'Distribution brute des votes Fragrantica pour la longévité (labels → comptes). Source de la fusion avec parfum_votes.';
comment on column public.parfums.sillage_breakout is
  'Distribution brute des votes Fragrantica pour le sillage (labels → comptes). Source de la fusion avec parfum_votes.';

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. parfum_votes — votes bruts des utilisateurs
-- ═══════════════════════════════════════════════════════════════════════════
-- Un utilisateur = un vote par (parfum, dimension). value : '1'..'4' pour
-- longevity/sillage (crans UI) ; 'spring'|'summer'|'fall'|'winter'|'day'|'night'
-- pour season. Les votes individuels sont PRIVÉS (RLS owner) ; l'agrégat public
-- passe exclusivement par la RPC parfum_perf (SECURITY DEFINER).

create table if not exists public.parfum_votes (
  parfum_id  text        not null references public.parfums(id) on delete cascade,
  user_id    uuid        not null references auth.users(id) on delete cascade,
  dimension  text        not null check (dimension in ('longevity', 'sillage', 'season')),
  value      text        not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (parfum_id, user_id, dimension)
);

create index if not exists parfum_votes_parfum_dim on public.parfum_votes (parfum_id, dimension);
create index if not exists parfum_votes_user on public.parfum_votes (user_id);

alter table public.parfum_votes enable row level security;

drop policy if exists "parfum_votes_select_own" on public.parfum_votes;
create policy "parfum_votes_select_own" on public.parfum_votes
  for select using (auth.uid() = user_id);

drop policy if exists "parfum_votes_insert_own" on public.parfum_votes;
create policy "parfum_votes_insert_own" on public.parfum_votes
  for insert with check (auth.uid() = user_id);

drop policy if exists "parfum_votes_update_own" on public.parfum_votes;
create policy "parfum_votes_update_own" on public.parfum_votes
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "parfum_votes_delete_own" on public.parfum_votes;
create policy "parfum_votes_delete_own" on public.parfum_votes
  for delete using (auth.uid() = user_id);

grant select, insert, update, delete on public.parfum_votes to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. Helpers de calcul (fusion Fragrantica borné + votes utilisateurs)
-- ═══════════════════════════════════════════════════════════════════════════

-- Valeur d'un label dans un breakout jsonb (0 si absent).
create or replace function public._frag_value(breakout jsonb, lbl text)
returns numeric
language sql stable strict
as $$
  select coalesce((
    select (e ->> lbl)::numeric
    from jsonb_array_elements(breakout) e
    where e ? lbl
    limit 1
  ), 0);
$$;

-- Normalise un breakout Fragrantica en 4 crans UI (array numeric[4]).
-- longevity : very weak+weak→1, moderate→2, long lasting→3, eternal→4.
-- sillage   : intimate→1, moderate→2, strong→3, enormous→4.
create or replace function public._perf_cranks(breakout jsonb, dimension text)
returns numeric[]
language plpgsql stable
as $$
begin
  if breakout is null then
    return array[0, 0, 0, 0]::numeric[];
  end if;
  if dimension = 'longevity' then
    return array[
      public._frag_value(breakout, 'very weak') + public._frag_value(breakout, 'weak'),
      public._frag_value(breakout, 'moderate'),
      public._frag_value(breakout, 'long lasting'),
      public._frag_value(breakout, 'eternal')
    ];
  elsif dimension = 'sillage' then
    return array[
      public._frag_value(breakout, 'intimate'),
      public._frag_value(breakout, 'moderate'),
      public._frag_value(breakout, 'strong'),
      public._frag_value(breakout, 'enormous')
    ];
  end if;
  return array[0, 0, 0, 0]::numeric[];
end;
$$;

-- Score moyen fusionné sur 4 crans (NULL si aucun vote des deux côtés).
-- cranks_user = comptes de votes utilisateurs par cran.
create or replace function public._perf_score(
  cranks_frag numeric[],
  cranks_user numeric[],
  cap numeric
) returns numeric
language plpgsql stable
as $$
declare
  frag_total numeric := cranks_frag[1] + cranks_frag[2] + cranks_frag[3] + cranks_frag[4];
  user_total numeric := cranks_user[1] + cranks_user[2] + cranks_user[3] + cranks_user[4];
  poids      numeric;
  num        numeric := 0;
  den        numeric := 0;
  contrib    numeric;
  i          int;
begin
  if frag_total + user_total = 0 then
    return null;
  end if;
  -- Borne l'influence Fragrantica à `cap` équivalents, en gardant sa forme.
  poids := coalesce(least(cap, frag_total) / nullif(frag_total, 0), 0);
  for i in 1..4 loop
    contrib := cranks_frag[i] * poids + cranks_user[i];
    num := num + i * contrib;
    den := den + contrib;
  end loop;
  return num / den;
end;
$$;

-- Comptes de votes utilisateurs par cran pour (parfum, dimension).
create or replace function public._user_cranks(p_parfum_id text, p_dimension text)
returns numeric[]
language sql stable
as $$
  select array[
    coalesce(count(*) filter (where value = '1'), 0),
    coalesce(count(*) filter (where value = '2'), 0),
    coalesce(count(*) filter (where value = '3'), 0),
    coalesce(count(*) filter (where value = '4'), 0)
  ]::numeric[]
  from public.parfum_votes
  where parfum_id = p_parfum_id and dimension = p_dimension;
$$;

-- Libellé FR d'un cran (mêmes seuils que l'app).
create or replace function public._perf_label(dimension text, lvl int)
returns text
language plpgsql immutable
as $$
begin
  if dimension = 'longevity' then
    return case lvl when 1 then 'Courte' when 2 then 'Modérée' when 3 then 'Longue' when 4 then 'Très longue' end;
  elsif dimension = 'sillage' then
    return case lvl when 1 then 'Intime' when 2 then 'Modéré' when 3 then 'Présent' when 4 then 'Puissant' end;
  end if;
  return null;
end;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. RPC parfum_perf — profil de performance fusionné pour la fiche détail
-- ═══════════════════════════════════════════════════════════════════════════
-- Retourne, calculé à la volée :
--   • longevity / sillage : level (1-4), valueLabel, score, fragEquiv (votes
--     Fragrantica après borne), userVotes (comptes communauté), myVote (vote de
--     l'utilisateur connecté, NULL sinon).
--   • season : comptes fusionnés par saison (barres relatives) + dayNight
--     fusionnés + myVote saison + myVote moment.
-- À 0 vote user, le résultat est strictement la donnée Fragrantica (jour 1).

create or replace function public.parfum_perf(p_parfum_id text, p_user_id uuid default null)
returns jsonb
language plpgsql stable security definer
set search_path = public
as $$
declare
  PERF_CAP      constant numeric := 100; -- calibré : médiane réelle du catalogue = 56 votes
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
  k             text;
begin
  select longevity_breakout, sillage_breakout, season_ranking
    into p from public.parfums where id = p_parfum_id;
  if not found then
    return null;
  end if;

  -- ── Longévité & sillage (4 crans) ──
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

  -- ── Saison + jour/nuit (comptes fusionnés) ──
  srank := coalesce(p.season_ranking, '[]'::jsonb);
  frag_season := '{}'::jsonb;
  for k in
    select (e ->> 'name') as name, (e ->> 'score')::numeric as score
    from jsonb_array_elements(srank) e
  loop
    frag_season := jsonb_set(frag_season, array[case when k.name = 'autumn' then 'fall' else k.name end],
                             to_jsonb(coalesce((frag_season ->> case when k.name = 'autumn' then 'fall' else k.name end)::numeric, 0) + k.score));
  end loop;

  season_total := coalesce((frag_season ->> 'spring')::numeric, 0)
                + coalesce((frag_season ->> 'summer')::numeric, 0)
                + coalesce((frag_season ->> 'fall')::numeric, 0)
                + coalesce((frag_season ->> 'winter')::numeric, 0)
                + coalesce((frag_season ->> 'day')::numeric, 0)
                + coalesce((frag_season ->> 'night')::numeric, 0);
  season_poids := coalesce(least(PERF_CAP, season_total) / nullif(season_total, 0), 0);

  -- Comptes utilisateurs par saison / moment
  season_out := '{}'::jsonb;
  daynight_out := '{}'::jsonb;
  for k in select value, count(*) as n from public.parfum_votes
           where parfum_id = p_parfum_id and dimension = 'season' group by value
  loop
    if k.value in ('spring','summer','fall','winter') then
      season_out := jsonb_set(season_out, array[k.value], to_jsonb(coalesce((season_out ->> k.value)::numeric, 0) + k.n));
    elsif k.value in ('day','night') then
      daynight_out := jsonb_set(daynight_out, array[k.value], to_jsonb(coalesce((daynight_out ->> k.value)::numeric, 0) + k.n));
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

-- ═══════════════════════════════════════════════════════════════════════════
-- 5. RPC cast_vote — vote / change / retire (value NULL = suppression)
-- ═══════════════════════════════════════════════════════════════════════════
-- Authentification requise (auth.uid()). value validée selon la dimension.

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
  if p_dimension not in ('longevity', 'sillage', 'season') then
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
    when 'season'    then p_value in ('spring','summer','fall','winter','day','night')
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
-- 6. Cron quotidien — propage la moyenne fusionnée dans la string stockée
-- ═══════════════════════════════════════════════════════════════════════════
-- Ne touche que les parfums ayant ≥ 1 vote utilisateur (efficace + c'est là
-- que la réappropriation s'installe). Les autres gardent la string Fragrantica
-- (fallback). Ainsi parfums.longevity / sillage évoluent progressivement vers
-- le vécu de la communauté — propageant à favoris, filtres et recherche.

create or replace function public.recompute_perf_strings()
returns int
language plpgsql security definer
set search_path = public
as $$
declare
  PERF_CAP constant numeric := 100;
  r record;
  lvl_l int;
  lvl_s int;
  n int := 0;
begin
  for r in select distinct parfum_id from public.parfum_votes
  loop
    lvl_l := case
      when public._perf_score(
        public._perf_cranks((select longevity_breakout from public.parfums where id = r.parfum_id), 'longevity'),
        public._user_cranks(r.parfum_id, 'longevity'), PERF_CAP) is null then null
      else greatest(1, least(4, round(public._perf_score(
        public._perf_cranks((select longevity_breakout from public.parfums where id = r.parfum_id), 'longevity'),
        public._user_cranks(r.parfum_id, 'longevity'), PERF_CAP))::int))
    end;
    lvl_s := case
      when public._perf_score(
        public._perf_cranks((select sillage_breakout from public.parfums where id = r.parfum_id), 'sillage'),
        public._user_cranks(r.parfum_id, 'sillage'), PERF_CAP) is null then null
      else greatest(1, least(4, round(public._perf_score(
        public._perf_cranks((select sillage_breakout from public.parfums where id = r.parfum_id), 'sillage'),
        public._user_cranks(r.parfum_id, 'sillage'), PERF_CAP))::int))
    end;

    update public.parfums set
      longevity = case lvl_l
        when 1 then 'weak' when 2 then 'moderate' when 3 then 'long lasting' when 4 then 'eternal'
        else longevity end,
      sillage = case lvl_s
        when 1 then 'intimate' when 2 then 'moderate' when 3 then 'strong' when 4 then 'enormous'
        else sillage end
    where id = r.parfum_id;
    n := n + 1;
  end loop;
  return n;
end;
$$;

grant execute on function public.recompute_perf_strings() to service_role;

-- Planifie le recalcul quotidien (3h15 UTC, heure creuse) si pg_cron est dispo.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if not exists (select 1 from cron.job where jobname = 'recompute-perf-strings') then
      perform cron.schedule('recompute-perf-strings', '15 3 * * *', $cmd$select public.recompute_perf_strings()$cmd$);
    end if;
  end if;
end;
$$;
