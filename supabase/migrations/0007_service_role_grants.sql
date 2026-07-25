-- 0007_service_role_grants.sql — FIX : le service_role n'avait AUCUN grant sur
-- les tables (projet créé SANS « Automatically expose new tables » → pas de
-- privilèges par défaut pour les rôles API).
-- Symptôme : "permission denied for table parfums" via l'API avec la clé
-- service_role. Le bypass RLS du service_role ne dispense PAS des GRANTs SQL.
-- Sans danger : la clé service_role est le secret serveur (bypass RLS de toute façon).

-- Objets existants
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant all on all routines in schema public to service_role;

-- Objets futurs (privilèges par défaut)
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to service_role;
alter default privileges in schema public grant all on routines to service_role;
