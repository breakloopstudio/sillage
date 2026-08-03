-- ═══════════════════════════════════════════════════════════════════════════
-- 0059 — GRANT SELECT sur la vue parfum_card (anon, authenticated)
--
-- 0054 a créé la vue parfum_card + recréé les 4 RPC de liste en SECURITY
-- INVOKER, mais n'a jamais accordé le SELECT sur la vue : les appels anon /
-- authenticated échouaient en « permission denied for view parfum_card »
-- (recherche, rangées saisonnières, similaires, suggestions). Le cache disque
-- SWR (v9.0) masquait la casse côté app. Les RPC communauté (security definer)
-- ne sont pas impactées.
-- ═══════════════════════════════════════════════════════════════════════════

grant select on public.parfum_card to anon, authenticated;
