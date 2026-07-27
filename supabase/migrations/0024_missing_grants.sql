-- 0024_missing_grants.sql — FIX : GRANTs client omis sur profiles (0023) et price_history (0022).
-- L'auto-exposition des tables est DÉSACTIVÉE au niveau projet (cf. 0003_tables.sql) :
-- chaque table cliente exige un GRANT explicite en plus de la RLS. Le service_role
-- est déjà couvert par les privilèges par défaut (0007), mais pas anon/authenticated.
-- Symptôme sans ce fix : "permission denied for table profiles" via l'API client →
-- création de profil public cassée ; getLowestObservedPrice échoue silencieusement.

-- profiles : CRUD connecté (la RLS filtre les lignes ; la lecture publique des
-- profils publics passe par les RPC SECURITY DEFINER, pas par un grant anon).
grant select, insert, update on public.profiles to authenticated;

-- price_history : lecture publique (les prix sont déjà publics via parfums),
-- écriture réservée au service_role (cron check-price-alerts).
grant select on public.price_history to anon, authenticated;
