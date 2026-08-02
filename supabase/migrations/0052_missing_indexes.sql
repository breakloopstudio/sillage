-- ═══════════════════════════════════════════════════════════════════════════
-- 0052 — Index manquants (audit BDD v9 · C1-C3)
--   C1 · user_parfum (user_id, updated_at DESC)
--        suivi par la RPC followed_highlights qui filtre sur
--        user_id + updated_at > now() - 7j (l'index existant couvre added_at,
--        pas updated_at → filtre résiduel après index scan).
--   C2 · price_alerts (parfum_id)
--        le cron check-price-alerts regroupe les alertes par parfum ; la PK
--        (user_id, parfum_id) a user_id en tête → seq scan côté parfum.
--   C3 · shelf_items (user_id, parfum_id)
--        le trigger trg_user_parfum_delete_shelf_items fait
--        DELETE ... WHERE user_id AND parfum_id ; la PK (user_id, shelf_id,
--        parfum_id) ne couvre que le préfixe user_id → scan de toutes les
--        étagères du user à chaque suppression de user_parfum.
-- ═══════════════════════════════════════════════════════════════════════════

create index if not exists user_parfum_user_updated
  on public.user_parfum (user_id, updated_at desc);

create index if not exists price_alerts_parfum
  on public.price_alerts (parfum_id);

create index if not exists shelf_items_user_parfum
  on public.shelf_items (user_id, parfum_id);
