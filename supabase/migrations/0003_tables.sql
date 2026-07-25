-- 0003_tables.sql — Schéma complet (15 tables)
-- Miroir de src/models/ + aplatissement des sous-collections Firestore users/{uid}/*
-- Toutes les tables user : user_id uuid FK auth.users ON DELETE CASCADE
--   → la suppression RGPD = auth.admin.deleteUser() (remplace recursiveDelete).

-- ─── Catalogue ───────────────────────────────────────────────────────────────

-- Miroir de Parfum (src/models/parfum.interface.ts).
-- searchKeywords Firestore NON migré : remplacé par les 2 colonnes générées.
create table if not exists public.parfums (
  id                       text primary key,            -- slug seed conservé
  nom                      text not null,
  marque                   text not null,
  annee                    int,
  famille_olfactive        text,
  notes_tete               text[] not null default '{}',
  notes_coeur              text[] not null default '{}',
  notes_fond               text[] not null default '{}',
  image_url                text,
  best_price               numeric(10,2),
  reference_price          numeric(10,2),
  offers                   jsonb not null default '[]'::jsonb,   -- PriceOffer[]
  source                   public.parfum_source default 'seed',
  cached_at                timestamptz,
  image_verified           boolean,
  type_parfum              text,
  purchase_url             text,
  main_accords             text[] not null default '{}',
  longevity                text,
  sillage                  text,
  gender                   text,
  rating                   text,
  popularity               text,
  popularity_score         numeric,
  rating_score             numeric,
  review_count             int not null default 0,
  rating_count             int not null default 0,
  price_value              text,
  country                  text,
  main_accords_percentage  jsonb,                        -- Record<string,string>
  general_notes            text[] not null default '{}',
  perfumers                text[] not null default '{}',
  confidence               text,
  season_ranking           jsonb,                        -- {name,score}[]
  occasion_ranking         jsonb,                        -- {name,score}[]
  similar_ids              text[] not null default '{}',
  similar_ids_cached_at    timestamptz,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  -- Recherche : texte normalisé (trgm) + vecteur FTS (unaccent) — colonnes générées
  search_text   text generated always as (public.norm_txt(marque || ' ' || nom)) stored,
  -- ⚠️ 'public.french_unaccent'::regconfig : le cast explicite est obligatoire
  -- dans une colonne générée — la chaîne nue est considérée non immutable.
  search_vector tsvector generated always as (
    to_tsvector('public.french_unaccent'::regconfig,
      coalesce(marque, '') || ' ' ||
      coalesce(nom, '') || ' ' ||
      coalesce(famille_olfactive, '') || ' ' ||
      coalesce(public.immutable_array_to_string(notes_tete, ' '), '') || ' ' ||
      coalesce(public.immutable_array_to_string(notes_coeur, ' '), '') || ' ' ||
      coalesce(public.immutable_array_to_string(notes_fond, ' '), ''))
  ) stored
);

comment on table public.parfums is 'Catalogue ~25K parfums (ex collection Firestore parfums). Lecture publique, écriture admin.';

-- ─── Tables utilisateur (sous-collections aplaties) ──────────────────────────

-- users/{uid}/favoris/{parfumId} — UserFavori (champs affichage + filtres dénormalisés)
create table if not exists public.favoris (
  user_id           uuid not null references auth.users(id) on delete cascade,
  parfum_id         text not null,
  nom               text,
  marque            text,
  image_url         text,
  famille_olfactive text,
  best_price        numeric(10,2),
  reference_price   numeric(10,2),
  annee             int,
  longevity         text,
  sillage           text,
  season_scores     jsonb,                 -- {spring,summer,fall,winter}
  notes             text[],                -- tête+cœur+fond dédupliqués, lowercase
  added_at          timestamptz not null default now(),
  primary key (user_id, parfum_id)
);

-- users/{uid}/scans/{autoId} — UserScan
create table if not exists public.scans (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  parfum_id         text,
  raw_text          text,
  marque            text,
  nom               text,
  volume_ml         int,
  type_parfum       text,
  image_url         text,
  famille_olfactive text,
  annee             int,
  best_price        numeric(10,2),
  status            public.scan_status,
  scanned_at        timestamptz not null default now()
);

-- users/{uid}/collection/{parfumId} — UserCollectionItem
create table if not exists public.collection (
  user_id    uuid not null references auth.users(id) on delete cascade,
  parfum_id  text not null,
  nom        text,
  marque     text,
  image_url  text,
  added_at   timestamptz not null default now(),
  primary key (user_id, parfum_id)
);

-- users/{uid}/scentlist/{parfumId} — UserScentItem
create table if not exists public.scentlist (
  user_id           uuid not null references auth.users(id) on delete cascade,
  parfum_id         text not null,
  nom               text,
  marque            text,
  image_url         text,
  famille_olfactive text,
  status            public.scent_status not null default 'to_try',
  verdict           public.scent_verdict,
  rating            numeric(3,1),
  notes             text,
  tried_at          timestamptz,
  best_price        numeric(10,2),
  reference_price   numeric(10,2),
  added_at          timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  primary key (user_id, parfum_id)
);

-- users/{uid}/wardrobe/{parfumId} — WardrobeItem
create table if not exists public.wardrobe (
  user_id           uuid not null references auth.users(id) on delete cascade,
  parfum_id         text not null,
  nom               text,
  marque            text,
  image_url         text,
  famille_olfactive text,
  ownership         public.ownership_type not null default 'have',
  rating            numeric(3,1),
  notes             text,
  shelf_ids         uuid[] not null default '{}',   -- références shelves.id
  size_ml           int,
  sotd_count        int not null default 0,
  is_signature      boolean not null default false,
  longevity         text,
  sillage           text,
  season_scores     jsonb,
  all_notes         text[],
  added_at          timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  primary key (user_id, parfum_id)
);

-- users/{uid}/shelves/{autoId} — Shelf
create table if not exists public.shelves (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null,
  icon       text,
  color      text,
  "order"    int not null default 0,          -- mot réservé → colonne quotée
  created_at timestamptz not null default now()
);

-- users/{uid}/sotd/{YYYY-MM-DD} — SotdEntry (doc id date → colonne day)
create table if not exists public.sotd (
  user_id    uuid not null references auth.users(id) on delete cascade,
  day        date not null,
  parfum_id  text not null,
  nom        text not null,
  marque     text not null,
  image_url  text,
  primary key (user_id, day)
);

-- users/{uid}/priceAlerts/{parfumId}
create table if not exists public.price_alerts (
  user_id      uuid not null references auth.users(id) on delete cascade,
  parfum_id    text not null,
  last_price   numeric(10,2),
  last_checked timestamptz,
  added_at     timestamptz not null default now(),
  primary key (user_id, parfum_id)
);

-- users/{uid}/settings/preferences → 1 ligne par user
create table if not exists public.user_settings (
  user_id        uuid primary key references auth.users(id) on delete cascade,
  price_alerts   boolean not null default false,
  push_notifs    boolean not null default true,
  weather_notifs boolean not null default false,
  weather_lat    numeric(6,2),          -- arrondies à 2 décimales (parité saveWeatherCoords)
  weather_lon    numeric(6,2)
);

-- users/{uid}/fcmTokens/* → tokens Expo Push (ExponentPushToken[...])
create table if not exists public.push_tokens (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  token      text not null unique,
  platform   text,                        -- 'ios' | 'android'
  created_at timestamptz not null default now()
);

-- ─── Tables système ──────────────────────────────────────────────────────────

-- admins/{uid} — le user_id est l'UUID Supabase du compte admin (seed manuel)
create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);

-- rateLimits/{date}/users/{uid} — quotas journaliers scan/voice (server-only)
create table if not exists public.rate_limits (
  user_id     uuid not null references auth.users(id) on delete cascade,
  day         date not null,
  scan_count  int not null default 0,
  voice_count int not null default 0,
  primary key (user_id, day)
);

-- users/{uid}/usage/{runId} — marqueurs d'idempotence des crons (server-only)
create table if not exists public.notification_runs (
  user_id    uuid not null references auth.users(id) on delete cascade,
  run_id     text not null,
  sent_count int not null default 0,
  created_at timestamptz not null default now(),
  primary key (user_id, run_id)
);

-- ─── GRANTS explicites ───────────────────────────────────────────────────────
-- Requis car « Automatically expose new tables » est DÉSACTIVÉ au niveau projet
-- (recommandation Supabase : exposition manuelle). Modèle à 2 couches :
--   GRANT = la table est visible de l'API · RLS (0005) = quelles lignes.
-- Le service_role (Edge Functions, crons, scripts d'import) bypass la RLS.

grant usage on schema public to anon, authenticated;

-- Catalogue : lecture publique (anon = app non connectée)
grant select on public.parfums           to anon, authenticated;
grant select on public.search_stop_words to anon, authenticated;

-- Admin : lecture seule pour le check isAdmin
grant select on public.admins to authenticated;

-- Tables user : CRUD complet, réservé aux connectés (la RLS filtre les lignes)
do $$
declare
  t text;
begin
  foreach t in array array[
    'favoris', 'scans', 'collection', 'scentlist', 'wardrobe',
    'shelves', 'sotd', 'price_alerts', 'user_settings', 'push_tokens'
  ] loop
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end;
$$;

-- Server-only : rate_limits & notification_runs = AUCUN grant anon/authenticated
-- (accessible uniquement via service_role, parité firestore.rules "if false")
