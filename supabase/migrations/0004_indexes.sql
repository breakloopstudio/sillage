-- 0004_indexes.sql — Index (traduction de firestore.indexes.json + besoins requêtes)
-- ⚠️ gin_trgm_ops DOIT être qualifié `extensions.` : le search_path de la connexion
-- de migration sur le projet hébergé n'inclut pas le schéma extensions (contrairement au local).

-- ─── Catalogue ───────────────────────────────────────────────────────────────

-- Recherche (remplace : searchKeywords CONTAINS + reviewCount DESC)
create index if not exists parfums_search_text_trgm
  on public.parfums using gin (search_text extensions.gin_trgm_ops);
create index if not exists parfums_search_vector_gin
  on public.parfums using gin (search_vector);
create index if not exists parfums_review_count_desc
  on public.parfums (review_count desc);

-- Similaires (remplace : mainAccords CONTAINS + popularityScore DESC)
create index if not exists parfums_main_accords_gin
  on public.parfums using gin (main_accords);
create index if not exists parfums_popularity_desc
  on public.parfums (popularity_score desc nulls last);

-- Perfumers (remplace : perfumers CONTAINS + popularityScore DESC)
create index if not exists parfums_perfumers_gin
  on public.parfums using gin (perfumers);

-- Suggestions personnalisées (where familleOlactive in (...))
create index if not exists parfums_famille
  on public.parfums (famille_olfactive);

-- Catalogue admin : tri updatedAt desc (onParfums)
create index if not exists parfums_updated_at_desc
  on public.parfums (updated_at desc);

-- ─── Tables user : tris des snapshots temps réel ─────────────────────────────

create index if not exists favoris_user_added
  on public.favoris (user_id, added_at desc);
create index if not exists scans_user_scanned
  on public.scans (user_id, scanned_at desc);
create index if not exists scentlist_user_status
  on public.scentlist (user_id, status);
create index if not exists shelves_user_order
  on public.shelves (user_id, "order");
create index if not exists push_tokens_token
  on public.push_tokens (token);
