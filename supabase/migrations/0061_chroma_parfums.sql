-- ═══════════════════════════════════════════════════════════════════════════
-- 0061 — RPC chroma_parfums (roue chromatique)
--
-- Feature « roue chromatique » : l'utilisateur choisit une couleur (12 ancres
-- curatées côté client dans src/utils/chromatic-wheel.ts) et l'app renvoie les
-- parfums de cette teinte, classés par INTENSITÉ chromatique puis popularité.
--
-- Le mapping couleur → vocabulaire vit CÔTÉ CLIENT (itération éditoriale sans
-- migration) ; cette RPC est le moteur de requête générique :
--   1. Filtre BitmapOr sur 2 index GIN existants (aucun nouvel index) :
--      - parfums_main_accords_gin (0004) — opérateur &&
--      - parfums_search_vector_gin (0004, notes + famille) — opérateur @@,
--        premier consommateur de cet index jusqu'ici dormant
--   2. Scoring sur les CANDIDATS uniquement (jamais la table entière) :
--      - intensité accords : main_accords_percentage (« NN% » normalisé contre
--        l'accord max à l'import) — un parfum « encens 100 % » passe avant
--        « encens 30 % » ; valeur non numérique → 0.40 (miroir du parsePct
--        client, accord-profile.ts)
--      - match notes : ts_rank (config french_unaccent)
--      - bonus popularité : ln(pop + 1) / 2 (pattern search_parfums)
--   3. LIMIT précoce (3×lim, plafonné 60) AVANT le boost saisonnier — le jsonb
--      season_ranking n'est expandé que sur la shortlist (pattern
--      personalized_suggestions 0054 ; surtout PAS le cross join lateral
--      pleine table de seasonal_parfums).
--
-- Coût estimé : 5-20 ms typique, < 50 ms pire cas (25 100 lignes).
-- Lecture publique catalogue : SECURITY INVOKER + grants anon/authenticated
-- (pattern 0054). Entrées plafonnées (pattern 0050/0012).
-- ═══════════════════════════════════════════════════════════════════════════

create function public.chroma_parfums(
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
    -- Étape filtre : BitmapOr des 2 GIN. Une branche vide s'éteint d'elle-même
    -- ('{}' && x = false ; @@ ''::tsquery = false) — pas de SQL dynamique.
    select p.id, p.search_vector, p.main_accords_percentage,
           p.popularity_score, p.season_ranking
    from public.parfums p
    where p.image_url is not null
      and (p.main_accords && v_accords
           or p.search_vector @@ coalesce(v_tsq, ''::tsquery))
  ),
  base as (
    -- Scoring sur les candidats uniquement.
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

grant execute on function public.chroma_parfums(text[], text[], text, int) to anon, authenticated;
