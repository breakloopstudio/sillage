-- ═══════════════════════════════════════════════════════════════════════════
-- 0057 — parfum_card : réintègre rating (text)
--
-- 0054 avait exclu rating (string) de la projection de liste. Or
-- communityRatingLabel (parfum-labels.ts) l'utilise en FALLBACK du chip ★
-- quand rating_score est absent. Avant 0054, les listes (select *) le
-- fournissaient. Réintégré pour préserver le comportement exact des cartes.
--
-- Ajouté en FIN de vue : CREATE OR REPLACE VIEW interdit de réordonner les
-- colonnes existantes (les RPC retournent SETOF parfum_card via pc.*, l'ordre
-- suit la définition de la vue — le mapper client accède par nom de colonne).
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
  created_at, updated_at,
  rating
from public.parfums;
