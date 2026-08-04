-- ═══════════════════════════════════════════════════════════════════════════
-- 0062 — chroma_parfums : branches bornées avant scoring (fix timeout E2E)
--
-- Constat E2E : chroma_parfums('red') timeout (> 3 s) — ses notes sont des
-- lexèmes très fréquents (musk ~8 000 parfums, jasmine ~5 500, rose ~4 600) :
-- la branche FTS remontait ~15-20 000 candidats, tous scorés (jsonb + ts_rank)
-- avant le LIMIT précoce. Couleurs à notes rares (noir : encens/myrrhe) OK.
--
-- Fix : pattern personalized_suggestions (0054) — chaque branche (accords GIN /
-- notes FTS) est BORNÉE par popularité AVANT le scoring (UNION déduplique par
-- id). Le scoring ne porte plus que sur ≤ 9 000 candidats dans le pire cas.
-- Les plafonds de branche gardent les candidats populaires ; les pépites à
-- forte intensité restent repêchées par l'autre branche (ex. un encens de
-- niche peu populaire matche la branche notes « incense »).
-- Return type inchangé → CREATE OR REPLACE suffisant.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.chroma_parfums(
  p_accords text[],
  p_notes text[] default null,
  p_season text default null,
  p_limit int default 50
)
returns setof public.parfum_card
language plpgsql
stable
set search_path = public, extensions
as $$
declare
  v_accords text[] := coalesce(p_accords, '{}');
  v_notes text[] := coalesce(p_notes, '{}');
  v_season text := lower(trim(coalesce(p_season, '')));
  v_lim int;
  v_short int;
  v_tsq tsquery := null;
  n text;
begin
  -- Guards : entrées plafonnées, lim borné, saison validée (patterns 0012/0050/0054)
  if cardinality(v_accords) > 8 then v_accords := v_accords[1:8]; end if;
  if cardinality(v_notes) > 6 then v_notes := v_notes[1:6]; end if;
  if cardinality(v_accords) = 0 and cardinality(v_notes) = 0 then
    return;
  end if;

  v_lim := least(greatest(coalesce(p_limit, 50), 1), 50);
  v_short := least(v_lim * 3, 60);

  if v_season = 'fall' then v_season := 'autumn'; end if;
  if v_season not in ('spring', 'summer', 'autumn', 'winter') then
    v_season := null;
  end if;

  -- tsquery notes : plainto_tsquery par note, combinées en OR (||)
  foreach n in array v_notes loop
    if v_tsq is null then
      v_tsq := plainto_tsquery('public.french_unaccent'::regconfig, n);
    else
      v_tsq := v_tsq || plainto_tsquery('public.french_unaccent'::regconfig, n);
    end if;
  end loop;

  return query
  with cand as (
    -- Branche accords (GIN main_accords) — bornée par popularité
    (select p.id, p.search_vector, p.main_accords_percentage,
            p.popularity_score, p.season_ranking
     from public.parfums p
     where p.image_url is not null
       and cardinality(v_accords) > 0
       and p.main_accords && v_accords
     order by p.popularity_score desc nulls last
     limit 6000)
    union
    -- Branche notes (GIN search_vector) — bornée par popularité
    -- (lexèmes fréquents type musk/jasmine : le set candidat reste maîtrisé)
    (select p.id, p.search_vector, p.main_accords_percentage,
            p.popularity_score, p.season_ranking
     from public.parfums p
     where p.image_url is not null
       and v_tsq is not null
       and p.search_vector @@ v_tsq
     order by p.popularity_score desc nulls last
     limit 3000)
  ),
  base as (
    -- Scoring sur les candidats uniquement (≤ 9 000 après bornage).
    select c.id,
      coalesce((
        select sum(
          case when (c.main_accords_percentage ->> a.accord) ~ '[0-9]'
               then substring(c.main_accords_percentage ->> a.accord from '[0-9]+')::numeric / 100.0
               else 0.40 end
        )
        from unnest(v_accords) a(accord)
        where c.main_accords_percentage ? a.accord
      ), 0) * 10.0
      + case when v_tsq is not null
             then ts_rank(c.search_vector, v_tsq) * 5.0
             else 0 end
      + ln(greatest(coalesce(c.popularity_score, 0), 0) + 1) / 2 as score,
      c.season_ranking
    from cand c
  ),
  shortlist as (
    -- LIMIT précoce avant le boost saisonnier (pattern similar_parfums 0054)
    select * from base order by score desc limit v_short
  ),
  boosted as (
    -- Boost saison sur ≤ 60 lignes seulement (pattern personalized_suggestions)
    select s.id,
           s.score + case when v_season is null then 0 else
             coalesce((
               select ln((e ->> 'score')::numeric + 1) / 2
               from jsonb_array_elements(s.season_ranking) e
               where e ->> 'name' = v_season
               limit 1
             ), 0) end as score
    from shortlist s
  )
  select pc.*
  from boosted b
  join public.parfum_card pc on pc.id = b.id
  order by b.score desc
  limit v_lim;
end;
$$;
