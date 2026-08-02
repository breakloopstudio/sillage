-- ═══════════════════════════════════════════════════════════════════════════
-- 0051 — Nettoyage legacy (audit BDD v9)
--   A1 · DROP des tables mortes collection / wardrobe / scentlist (dépréciées
--        en v8.0 / migration 0021, modèle unifié user_parfum) + enums orphelins
--        ownership_type / scent_status. 0 lecteur client, 0 fonction vivante,
--        0 script d'import n'y touche (vérifié grep src/ + scripts/).
--   A2 · DROP des index redondants / morts :
--          push_tokens_token            (doublon de la contrainte UNIQUE token)
--          price_history_parfum_captured (DESC couvert par backward scan de la PK)
--          parfums_review_count_desc    (jamais trié seul ; couvert par parfums_top_rated)
--   A3 · Retire possessions de la publication realtime (0 listener client —
--        usePossessions ne fait que du fetch on-demand).
--
-- NB : A4 (DROP colonnes mortes de parfums : rating/popularity/country/
--     confidence/general_notes/similar_ids) est REPORTÉ — les scripts
--     import-fresh.ts / import-supabase.ts écrivent encore dans ces colonnes.
--     Toute action est réversible (recréer table/index/type via 0002-0004).
-- ═══════════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────────
-- A1 · Tables mortes + enums orphelins
-- ───────────────────────────────────────────────────────────────────────────
-- CASCADE : emporte les FK vers auth.users, l'index scentlist_user_status (0004)
-- et tout objet dépendant. Les triggers updated_at ont déjà été droppés en 0035.
drop table if exists public.collection cascade;
drop table if exists public.wardrobe   cascade;
drop table if exists public.scentlist  cascade;

drop type if exists public.ownership_type;
drop type if exists public.scent_status;

-- ───────────────────────────────────────────────────────────────────────────
-- A2 · Index redondants / morts
-- ───────────────────────────────────────────────────────────────────────────
drop index if exists public.push_tokens_token;
drop index if exists public.price_history_parfum_captured;
drop index if exists public.parfums_review_count_desc;

-- ───────────────────────────────────────────────────────────────────────────
-- A3 · possessions hors realtime (aucun listener client)
-- ───────────────────────────────────────────────────────────────────────────
alter publication supabase_realtime drop table public.possessions;
