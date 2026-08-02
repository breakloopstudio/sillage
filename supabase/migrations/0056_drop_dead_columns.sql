-- ═══════════════════════════════════════════════════════════════════════════
-- 0056 — DROP colonnes mortes de parfums (audit BDD v9 · A4)
--
-- Colonnes JAMAIS consommées (0 usage UI, seulement mappées) :
--   popularity     (text)  — valeur brute scrapée ; seul popularity_score sert
--   country        (text)  — métadonnée scraping sans consommateur
--   confidence     (text)  — la confidence affichée au scan vient de GPT-4o, pas d'ici
--   image_verified (bool)  — aucun consommateur
--
-- SONT CONSERVÉES (contrairement à l'audit initial, usage vérifié) :
--   rating (text)            — fallback communityRatingLabel (parfum-labels.ts parseFloat)
--   rating_count             — popBonus SQL de search_parfums
--   general_notes            — OlfactoryPyramid (fiche détail)
--   similar_ids / _cached_at — cache similaires 24h (app/catalog/[id].tsx)
--   offers / occasion_ranking / main_accords_percentage — fiche détail (select *)
--
-- Aucune fonction / vue / index ne référence ces 4 colonnes (la vue parfum_card
-- 0054 ne les inclut pas). Les scripts import-fresh / import-supabase sont
-- adaptés en parallèle pour ne plus les écrire.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.parfums
  drop column if exists popularity,
  drop column if exists country,
  drop column if exists confidence,
  drop column if exists image_verified;
