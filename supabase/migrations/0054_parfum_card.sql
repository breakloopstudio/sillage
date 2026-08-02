-- ═══════════════════════════════════════════════════════════════════════════
-- 0054 — Vue parfum_card + RPC catalogue allégées (audit BDD v9 · B1)
--
-- Constat : les 4 RPC de liste (search_parfums, seasonal_parfums,
-- similar_parfums, personalized_suggestions) renvoient SETOF parfums.* et
-- transfèrent donc, pour chaque ligne, des champs volumineux JAMAIS consommés
-- par les cartes : search_vector (tsvector), search_text, offers / occasion_ranking
-- / main_accords_percentage (jsonb), general_notes / similar_ids (text[]),
-- country / confidence / popularity / rating / image_verified / purchase_url.
-- La recherche est l'opération la plus fréquente de l'app → plus gros gain réseau.
--
-- Solution : une VUE parfum_card projetant les colonnes utiles aux cartes, au tri,
-- aux filtres et à la dénormalisation favoris (season_ranking est CONSERVÉ —
-- favori-filters.ts buildFavoriFilterFields l'utilise). Les champs fiche-détail
-- restent servis par getParfumById / getParfumsByIds (select *).
--
-- Le return type des RPC change (parfums → parfum_card) : DROP + CREATE obligatoire
-- (CREATE OR REPLACE ne peut pas changer le type de retour). La logique de scoring
-- reste inchangée (elle lit public.parfums, qui porte search_vector/search_text) ;
-- seul le SELECT final projette via la vue.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace view public.parfum_card as
select
  id, nom, marque, annee, famille_olfactive,
  notes_tete, notes_coeur, notes_fond,
  image_url, image_url_2x,
  best_price, reference_price, price_value,
  type_parfum, gender,
  main_accords, longevity, sillage,
  popularity_score, rating_score, review_count, rating_count,
  perfumers, season_ranking,
  source, cached_at,
  created_at, updated_at
from public.parfums;

-- ───────────────────────────────────────────────────────────────────────────
-- search_parfums
-- ───────────────────────────────────────────────────────────────────────────
drop function if exists public.search_parfums(text, int);
create function public.search_parfums(q text, max_results int default 50)
returns setof public.parfum_card
language plpgsql
stable
set search_path = public, extensions
as $$
declare
  nq     text := public.norm_txt(q);
  tokens text[];
begin
  if nq is null or length(nq) < 2 then
    return;
  end if;

  select coalesce(array_agg(t), '{}')
    into tokens
  from (
    select w as t
    from regexp_split_to_table(nq, '\s+') as w
    where length(w) >= 2
      and not exists (select 1 from public.search_stop_words s where s.word = w)
    group by w
    order by length(w) desc
    limit 4
  ) sub;

  if cardinality(tokens) = 0 then
    return;
  end if;

  return query
  with cand as (
    select p.id, p.marque, p.nom, p.search_text,
           sum(word_similarity(tok, p.search_text)) as match_score,
           ln(greatest(
                coalesce(p.review_count, 0),
                coalesce(p.rating_count, 0),
                coalesce(p.popularity_score, 0)
              ) + 1) / 2 as pop_bonus,
           greatest(
             coalesce(p.review_count, 0),
             coalesce(p.rating_count, 0),
             coalesce(p.popularity_score, 0)
           ) as pop
    from public.parfums p
    join unnest(tokens) as tok on p.search_text %> tok
    group by p.id, p.marque, p.nom, p.search_text,
             p.review_count, p.rating_count, p.popularity_score
  ),
  scored as (
    select c.*,
           match_score + pop_bonus
           + case
               when cardinality(tokens) >= 2
                 and c.search_text like '%' || nq || '%'
               then 10 else 0
             end as score
    from cand c
    where match_score > 0
  ),
  best as (
    select * from scored
    order by score desc, pop desc
    limit max_results * 2
  ),
  deduped as (
    select id, marque, nom, search_text, match_score, pop_bonus, score, pop
    from (
      select b.*,
             row_number() over (
               partition by public.norm_txt(b.marque), public.norm_txt(b.nom)
               order by b.score desc, b.pop desc
             ) as rn
      from best b
    ) ranked
    where rn = 1
  ),
  fuzzy as (
    select p.id, similarity(p.search_text, nq) as score
    from public.parfums p
    where (select count(*) from deduped) < 5
      and p.search_text % nq
      and not exists (select 1 from deduped d where d.id = p.id)
    order by score desc
    limit 10
  ),
  final as (
    select d.id, d.score from deduped d
    union all
    select f.id, f.score from fuzzy f
  )
  select pc.*
  from final f
  join public.parfum_card pc on pc.id = f.id
  order by f.score desc
  limit max_results;
end;
$$;

grant execute on function public.search_parfums(text, int) to anon, authenticated;

-- ───────────────────────────────────────────────────────────────────────────
-- seasonal_parfums
-- ───────────────────────────────────────────────────────────────────────────
drop function if exists public.seasonal_parfums(text, int);
create function public.seasonal_parfums(season text, lim int default 12)
returns setof public.parfum_card
language plpgsql
stable
set search_path = public, extensions
as $$
declare
  v_season text := lower(trim(coalesce(season, '')));
begin
  if v_season = 'fall' then v_season := 'autumn'; end if;
  if v_season not in ('spring', 'summer', 'autumn', 'winter') then
    return;
  end if;

  return query
  with parsed as (
    select p.id,
           p.popularity_score,
           max(case when e->>'name' = v_season
                    then (e->>'score')::numeric end) as target_score,
           max(case when e->>'name' in ('spring', 'summer', 'autumn', 'winter')
                    then (e->>'score')::numeric end) as max_season_score
    from public.parfums p
    cross join lateral jsonb_array_elements(p.season_ranking) e
    where p.season_ranking is not null
      and p.image_url is not null
    group by p.id, p.popularity_score
  )
  select pc.*
  from parsed s
  join public.parfum_card pc on pc.id = s.id
  where s.target_score is not null
    and s.target_score >= s.max_season_score
  order by s.target_score desc, s.popularity_score desc nulls last
  limit lim;
end;
$$;

grant execute on function public.seasonal_parfums(text, int) to anon, authenticated;

-- ───────────────────────────────────────────────────────────────────────────
-- similar_parfums
-- ───────────────────────────────────────────────────────────────────────────
drop function if exists public.similar_parfums(text[], text, int);
create function public.similar_parfums(
  accords text[],
  exclude_id text,
  lim int default 6
)
returns setof public.parfum_card
language plpgsql
stable
set search_path = public, extensions
as $$
begin
  if accords is null or cardinality(accords) = 0 then
    return;
  end if;

  perform setseed(abs(hashtext(current_date::text)::bigint) / 2147483648.0);

  return query
  with scored as (
    select p.id,
           cardinality(array(
             select unnest(p.main_accords)
             intersect
             select unnest(accords)
           )) * 10 + coalesce(p.popularity_score, 0) / 100 as score
    from public.parfums p
    where p.main_accords && accords
      and p.id <> exclude_id
      and p.image_url is not null
    order by score desc
    limit 40
  )
  select pc.*
  from scored s
  join public.parfum_card pc on pc.id = s.id
  order by random()
  limit lim;
end;
$$;

grant execute on function public.similar_parfums(text[], text, int) to anon, authenticated;

-- ───────────────────────────────────────────────────────────────────────────
-- personalized_suggestions
-- ───────────────────────────────────────────────────────────────────────────
drop function if exists public.personalized_suggestions(int);
create function public.personalized_suggestions(lim int default 16)
returns setof public.parfum_card
language plpgsql
stable
security invoker
set search_path = public, extensions
as $$
declare
  v_uid uuid := auth.uid();
  v_season text;
begin
  if v_uid is null then
    return;
  end if;

  v_season := case extract(month from now())::int
    when 3 then 'spring' when 4 then 'spring' when 5 then 'spring'
    when 6 then 'summer' when 7 then 'summer' when 8 then 'summer'
    when 9 then 'autumn' when 10 then 'autumn' when 11 then 'autumn'
    else 'winter'
  end;

  return query
  with signals as (
    select up.famille_olfactive, up.marque, up.parfum_id,
           5.0 * exp(-extract(epoch from now() - up.added_at) / 7776000.0) as w
    from public.user_parfum up
    where up.user_id = v_uid and up.status = 'have'
    union all
    select p.famille_olfactive, sub.marque, sub.parfum_id,
           least(sub.cnt, 10) * 2.0 as w
    from (
      select s.parfum_id, s.marque, count(*) as cnt
      from public.sotd s
      where s.user_id = v_uid
      group by s.parfum_id, s.marque
    ) sub
    join public.parfums p on p.id = sub.parfum_id
    union all
    select up.famille_olfactive, up.marque, up.parfum_id,
           case up.verdict when 'love' then 4.0 when 'like' then 2.5 else 0 end as w
    from public.user_parfum up
    where up.user_id = v_uid and up.verdict in ('love', 'like')
    union all
    select f.famille_olfactive, f.marque, f.parfum_id,
           3.0 * exp(-extract(epoch from now() - f.added_at) / 7776000.0) as w
    from public.favoris f
    where f.user_id = v_uid
    union all
    select p.famille_olfactive, p.marque, pa.parfum_id, 2.0 as w
    from public.price_alerts pa
    join public.parfums p on p.id = pa.parfum_id
    where pa.user_id = v_uid
    union all
    select s.famille_olfactive, s.marque, s.parfum_id,
           1.0 * exp(-extract(epoch from now() - s.scanned_at) / 3888000.0) as w
    from public.scans s
    where s.user_id = v_uid and s.status = 'success'
  ),
  negative as (
    select up.parfum_id
    from public.user_parfum up
    where up.user_id = v_uid and up.verdict in ('meh', 'dislike')
  ),
  seen as (
    select distinct parfum_id from signals where parfum_id is not null
  ),
  user_accords as (
    select a.accord, sum(sg.w) as c
    from signals sg
    join public.parfums p on p.id = sg.parfum_id
    cross join lateral unnest(p.main_accords) a(accord)
    group by a.accord
    order by c desc
    limit 8
  ),
  fam_scores as (
    select famille_olfactive as f, sum(w) as c
    from signals
    where famille_olfactive is not null
    group by 1
  ),
  brand_scores as (
    select marque as m, sum(w) as c
    from signals
    where marque is not null
    group by 1
  ),
  top_fam as (
    select f from fam_scores order by c desc limit 3
  ),
  cand as (
    (select p.* from public.parfums p
     where p.main_accords && (select coalesce(array_agg(accord), '{}') from user_accords)
       and p.image_url is not null
     order by p.popularity_score desc nulls last
     limit 60)
    union
    (select p.* from public.parfums p
     where p.famille_olfactive in (select f from top_fam)
       and p.image_url is not null
     order by p.popularity_score desc nulls last
     limit 30)
    union
    (select p.* from public.parfums p
     where p.image_url is not null
     order by p.popularity_score desc nulls last
     limit 30)
  ),
  scored as (
    select c.id, c.famille_olfactive,
      coalesce(cardinality(array(
        select unnest(c.main_accords)
        intersect
        select accord from user_accords
      )), 0) * 4.0
      + sqrt(coalesce(fs.c, 0)) * 2.0
      + sqrt(coalesce(bs.c, 0)) * 1.5
      + ln(coalesce(c.popularity_score, 0) + 1)
      + coalesce((
        select ln((e->>'score')::numeric + 1) / 2
        from jsonb_array_elements(c.season_ranking) e
        where e->>'name' = v_season
        limit 1
      ), 0)
      as score
    from cand c
    left join fam_scores fs on fs.f = c.famille_olfactive
    left join brand_scores bs on bs.m = c.marque
    where not exists (select 1 from seen s where s.parfum_id = c.id)
      and not exists (select 1 from negative n where n.parfum_id = c.id)
  ),
  ranked as (
    select *, row_number() over (
      partition by famille_olfactive order by score desc
    ) as fam_rank
    from scored
  )
  select pc.*
  from ranked r
  join public.parfum_card pc on pc.id = r.id
  where r.fam_rank <= 3
  order by r.score desc
  limit lim;
end;
$$;

grant execute on function public.personalized_suggestions(int) to authenticated;
