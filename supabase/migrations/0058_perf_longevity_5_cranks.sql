-- ═══════════════════════════════════════════════════════════════════════════
-- 0058 — Longévité sur 5 crans (1:1 Fragrantica), sillage inchangé (4 crans)
--
-- Décisions :
--   • Fragrantica vote la longévité sur 5 niveaux (very weak, weak, moderate,
--     long lasting, eternal) : l'UI et la fusion passent à 5 crans, sans plus
--     fusionner very weak + weak. Le sillage reste sur 4 crans (Fragrantica
--     n'a que 4 niveaux : intimate, moderate, strong, enormous).
--   • Reset des votes utilisateurs longevity/sillage existants ('1'..'4'
--     impossibles à réinterpréter sans ambiguïté sur la nouvelle échelle).
--     Les votes season/moment sont intacts.
--   • Le cran 1 de longévité écrit désormais la string 'very weak' dans
--     parfums.longevity (nouvelle valeur du domaine, déjà présente dans les
--     breakouts scrapés ; parsers clients alignés dans le même chantier).
--
-- Contenu :
--   1. Reset des votes longevity/sillage + normalisation one-shot des strings
--      parfums.longevity/sillage des parfums réinitialisés (Fragrantica pur).
--   2. CHECK parfum_votes_value_check recréé scindé (longevity '1'..'5',
--      sillage '1'..'4') puis validé (0053 l'avait laissé NOT VALID).
--   3. Helpers : _perf_cranks (5 crans longévité), _perf_score (boucle
--      générique), _user_cranks (dimension-aware), _perf_label (5 libellés).
--   4. RPC parfum_perf (base 0050 : p_user_id := auth.uid() conservé) —
--      clamp 5 crans longévité ; cast_vote (base 0044 : moment conservé) —
--      longevity '1'..'5' ; recompute_perf_strings (base 0055 set-based) —
--      map 5 strings longévité.
-- ═══════════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────────
-- 1. Reset des votes longevity/sillage + normalisation one-shot des strings
-- ───────────────────────────────────────────────────────────────────────────
-- Capture les parfums concernés AVANT le delete : après reset ils sortiraient
-- du driver set du cron recompute_perf_strings et leurs strings fusionnées
-- pré-reset resteraient figées. On les ramène au Fragrantica pur ici.
create temporary table tmp_perf_reset_ids (parfum_id text primary key) on commit drop;

insert into tmp_perf_reset_ids (parfum_id)
select distinct parfum_id
from public.parfum_votes
where dimension in ('longevity', 'sillage');

delete from public.parfum_votes
where dimension in ('longevity', 'sillage');

-- ───────────────────────────────────────────────────────────────────────────
-- 2. CHECK value : scinde longevity ('1'..'5') / sillage ('1'..'4'), validé
-- ───────────────────────────────────────────────────────────────────────────
alter table public.parfum_votes
  drop constraint if exists parfum_votes_value_check;

alter table public.parfum_votes
  add constraint parfum_votes_value_check check (
       (dimension = 'longevity' and value in ('1', '2', '3', '4', '5'))
    or (dimension = 'sillage'   and value in ('1', '2', '3', '4'))
    or (dimension = 'season'    and value in ('spring', 'summer', 'fall', 'winter'))
    or (dimension = 'moment'    and value in ('day', 'night'))
  );

-- ───────────────────────────────────────────────────────────────────────────
-- 3. Helpers de calcul (miroir client : src/utils/perf-fusion.ts)
-- ───────────────────────────────────────────────────────────────────────────

-- Longévité : 5 crans 1:1 (very weak→1 … eternal→5). Sillage : 4 crans.
create or replace function public._perf_cranks(breakout jsonb, dimension text)
returns numeric[]
language plpgsql stable
as $$
begin
  if dimension = 'longevity' then
    if breakout is null then
      return array[0, 0, 0, 0, 0]::numeric[];
    end if;
    return array[
      public._frag_value(breakout, 'very weak'),
      public._frag_value(breakout, 'weak'),
      public._frag_value(breakout, 'moderate'),
      public._frag_value(breakout, 'long lasting'),
      public._frag_value(breakout, 'eternal')
    ];
  elsif dimension = 'sillage' then
    if breakout is null then
      return array[0, 0, 0, 0]::numeric[];
    end if;
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

-- Score moyen fusionné, générique sur la longueur des cranks (5 ou 4).
create or replace function public._perf_score(
  cranks_frag numeric[],
  cranks_user numeric[],
  cap numeric
) returns numeric
language plpgsql stable
as $$
declare
  n          int := greatest(coalesce(array_length(cranks_frag, 1), 0),
                             coalesce(array_length(cranks_user, 1), 0));
  frag_total numeric := 0;
  user_total numeric := 0;
  poids      numeric;
  num        numeric := 0;
  den        numeric := 0;
  contrib    numeric;
  i          int;
begin
  for i in 1..n loop
    frag_total := frag_total + coalesce(cranks_frag[i], 0);
    user_total := user_total + coalesce(cranks_user[i], 0);
  end loop;
  if frag_total + user_total = 0 then
    return null;
  end if;
  -- Borne l'influence Fragrantica à `cap` équivalents, en gardant sa forme.
  poids := coalesce(least(cap, frag_total) / nullif(frag_total, 0), 0);
  for i in 1..n loop
    contrib := coalesce(cranks_frag[i], 0) * poids + coalesce(cranks_user[i], 0);
    num := num + i * contrib;
    den := den + contrib;
  end loop;
  return num / den;
end;
$$;

-- Comptes de votes utilisateurs par cran : 5 pour longevity, 4 pour sillage.
create or replace function public._user_cranks(p_parfum_id text, p_dimension text)
returns numeric[]
language sql stable
as $$
  select case when p_dimension = 'longevity' then
    array[
      coalesce(count(*) filter (where value = '1'), 0),
      coalesce(count(*) filter (where value = '2'), 0),
      coalesce(count(*) filter (where value = '3'), 0),
      coalesce(count(*) filter (where value = '4'), 0),
      coalesce(count(*) filter (where value = '5'), 0)
    ]::numeric[]
  else
    array[
      coalesce(count(*) filter (where value = '1'), 0),
      coalesce(count(*) filter (where value = '2'), 0),
      coalesce(count(*) filter (where value = '3'), 0),
      coalesce(count(*) filter (where value = '4'), 0)
    ]::numeric[]
  end
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
    return case lvl
      when 1 then 'Très courte' when 2 then 'Courte' when 3 then 'Modérée'
      when 4 then 'Longue' when 5 then 'Très longue' end;
  elsif dimension = 'sillage' then
    return case lvl when 1 then 'Intime' when 2 then 'Modéré' when 3 then 'Présent' when 4 then 'Puissant' end;
  end if;
  return null;
end;
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- 4. RPC parfum_perf — longévité sur 5 crans (sécurité 0050 conservée)
-- ───────────────────────────────────────────────────────────────────────────
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
  r             record;
begin
  -- Sécurité (0050) : on ne lit jamais le vote d'un autre utilisateur.
  -- Le paramètre client est ignoré au profit de l'identité réelle de l'appelant.
  p_user_id := auth.uid();

  select longevity_breakout, sillage_breakout, season_ranking
    into p from public.parfums where id = p_parfum_id;
  if not found then
    return null;
  end if;

  -- ── Longévité (5 crans) & sillage (4 crans) ──
  long_cranks  := public._perf_cranks(p.longevity_breakout, 'longevity');
  sill_cranks  := public._perf_cranks(p.sillage_breakout, 'sillage');
  long_ucranks := public._user_cranks(p_parfum_id, 'longevity');
  sill_ucranks := public._user_cranks(p_parfum_id, 'sillage');

  long_score := public._perf_score(long_cranks, long_ucranks, PERF_CAP);
  sill_score := public._perf_score(sill_cranks, sill_ucranks, PERF_CAP);
  long_level := case when long_score is null then null else greatest(1, least(5, round(long_score)::int)) end;
  sill_level := case when sill_score is null then null else greatest(1, least(4, round(sill_score)::int)) end;

  long_frag_eq := (long_cranks[1]+long_cranks[2]+long_cranks[3]+long_cranks[4]+long_cranks[5])
                  * coalesce(least(PERF_CAP, long_cranks[1]+long_cranks[2]+long_cranks[3]+long_cranks[4]+long_cranks[5])
                             / nullif(long_cranks[1]+long_cranks[2]+long_cranks[3]+long_cranks[4]+long_cranks[5], 0), 0);
  sill_frag_eq := (sill_cranks[1]+sill_cranks[2]+sill_cranks[3]+sill_cranks[4])
                  * coalesce(least(PERF_CAP, sill_cranks[1]+sill_cranks[2]+sill_cranks[3]+sill_cranks[4])
                             / nullif(sill_cranks[1]+sill_cranks[2]+sill_cranks[3]+sill_cranks[4], 0), 0);

  long_uvotes := (long_ucranks[1]+long_ucranks[2]+long_ucranks[3]+long_ucranks[4]+long_ucranks[5])::int;
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
-- 5. RPC cast_vote — longevity '1'..'5' (moment 0044 conservé)
-- ───────────────────────────────────────────────────────────────────────────
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
    when 'longevity' then p_value in ('1','2','3','4','5')
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

-- ───────────────────────────────────────────────────────────────────────────
-- 6. Cron recompute_perf_strings — longévité 5 crans, 'very weak' au cran 1
-- ───────────────────────────────────────────────────────────────────────────
create or replace function public.recompute_perf_strings()
returns int
language plpgsql security definer
set search_path = public
as $$
declare
  PERF_CAP constant numeric := 100;
  n int := 0;
begin
  execute 'alter table public.parfums disable trigger trg_parfums_updated_at';
  begin
    with calc as (
      select v.parfum_id,
        public._perf_score(
          public._perf_cranks(p.longevity_breakout, 'longevity'),
          public._user_cranks(v.parfum_id, 'longevity'), PERF_CAP) as score_l,
        public._perf_score(
          public._perf_cranks(p.sillage_breakout, 'sillage'),
          public._user_cranks(v.parfum_id, 'sillage'), PERF_CAP) as score_s
      from (select distinct parfum_id from public.parfum_votes) v
      join public.parfums p on p.id = v.parfum_id
    )
    update public.parfums pf set
      longevity = case when c.score_l is null then pf.longevity
        else case greatest(1, least(5, round(c.score_l)::int))
          when 1 then 'very weak' when 2 then 'weak' when 3 then 'moderate'
          when 4 then 'long lasting' when 5 then 'eternal' end
        end,
      sillage = case when c.score_s is null then pf.sillage
        else case greatest(1, least(4, round(c.score_s)::int))
          when 1 then 'intimate' when 2 then 'moderate'
          when 3 then 'strong' when 4 then 'enormous' end
        end
    from calc c
    where pf.id = c.parfum_id;

    get diagnostics n = row_count;
  exception when others then
    execute 'alter table public.parfums enable trigger trg_parfums_updated_at';
    raise;
  end;
  execute 'alter table public.parfums enable trigger trg_parfums_updated_at';
  return n;
end;
$$;

grant execute on function public.recompute_perf_strings() to service_role;

-- ───────────────────────────────────────────────────────────────────────────
-- 7. Normalisation one-shot des parfums réinitialisés (Fragrantica pur)
-- ───────────────────────────────────────────────────────────────────────────
-- Post-reset, _user_cranks renvoie des zéros : le score est la moyenne
-- Fragrantica pure. Ne touche que les parfums capturés en §1, sans bruiter
-- parfums.updated_at (trigger neutralisé le temps de l'UPDATE).
alter table public.parfums disable trigger trg_parfums_updated_at;

with calc as (
  select t.parfum_id,
    public._perf_score(
      public._perf_cranks(p.longevity_breakout, 'longevity'),
      public._user_cranks(t.parfum_id, 'longevity'), 100) as score_l,
    public._perf_score(
      public._perf_cranks(p.sillage_breakout, 'sillage'),
      public._user_cranks(t.parfum_id, 'sillage'), 100) as score_s
  from tmp_perf_reset_ids t
  join public.parfums p on p.id = t.parfum_id
)
update public.parfums pf set
  longevity = case when c.score_l is null then pf.longevity
    else case greatest(1, least(5, round(c.score_l)::int))
      when 1 then 'very weak' when 2 then 'weak' when 3 then 'moderate'
      when 4 then 'long lasting' when 5 then 'eternal' end
    end,
  sillage = case when c.score_s is null then pf.sillage
    else case greatest(1, least(4, round(c.score_s)::int))
      when 1 then 'intimate' when 2 then 'moderate'
      when 3 then 'strong' when 4 then 'enormous' end
    end
from calc c
where pf.id = c.parfum_id;

alter table public.parfums enable trigger trg_parfums_updated_at;
