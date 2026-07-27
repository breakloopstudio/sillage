-- 0023_public_profiles.sql — Communauté Phase 1 : profils publics & partage
-- Profils opt-in (pseudo + avatar + bio + visibilité) et lecture publique de la
-- collection (user_parfum) d'un profil public. Les notes personnelles restent privées.

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. Table profiles — identité publique (opt-in)
-- ═══════════════════════════════════════════════════════════════════════════
-- pseudo     : slug unique choisi par l'utilisateur (URL /u/<pseudo>), 3-20 car.,
--              commence/finit par un alphanumérique, [a-z0-9_-] au milieu.
-- avatar_url : photo Google (AppUser.photoURL) ou null → initiales. Pas d'upload
--              custom (zéro modération image).
-- bio        : texte court (≤ 140 car.), liens filtrés côté app.
-- is_public  : défaut false — la collection n'est visible qu'après opt-in explicite.

create table if not exists public.profiles (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  pseudo     text not null unique
             check (pseudo ~ '^[a-z0-9][a-z0-9_-]{1,18}[a-z0-9]$'),
  avatar_url text,
  bio        text check (bio is null or char_length(bio) <= 140),
  is_public  boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profiles_is_public
  on public.profiles (is_public) where is_public;

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. RLS — owner-all + lecture publique des profils publics
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.profiles enable row level security;

drop policy if exists "profiles_owner_all" on public.profiles;
create policy "profiles_owner_all" on public.profiles
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Lecture publique (anon + authenticated) UNIQUEMENT des profils publics.
-- Un profil privé n'est lisible que par son owner (policy ci-dessus).
drop policy if exists "profiles_public_read" on public.profiles;
create policy "profiles_public_read" on public.profiles
  for select using (is_public = true);

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. Trigger updated_at
-- ═══════════════════════════════════════════════════════════════════════════

create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. RPC public_profile — en-tête du profil public + compteurs
-- ═══════════════════════════════════════════════════════════════════════════
-- SECURITY DEFINER : lit le profil d'un AUTRE user (RLS owner-only contournée),
-- filtré sur is_public = true. search_path verrouillé (anti-hijack).
-- Ne renvoie que des agrégats/compteurs — jamais la liste des favoris ni les scans.

create or replace function public.public_profile(p_pseudo text)
returns table (
  pseudo           text,
  avatar_url       text,
  bio              text,
  created_at       timestamptz,
  collection_count bigint
)
language sql stable security definer
set search_path = public
as $$
  select
    p.pseudo,
    p.avatar_url,
    p.bio,
    p.created_at,
    (select count(*) from public.user_parfum up where up.user_id = p.user_id) as collection_count
  from public.profiles p
  where p.pseudo = p_pseudo
    and p.is_public = true;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 5. RPC public_collection — collection publique (user_parfum), notes exclues
-- ═══════════════════════════════════════════════════════════════════════════
-- Identité du parfum + statut + verdict + rating + meilleur prix (données déjà
-- publiques côté catalogue). Les notes personnelles (user_parfum.notes) ne sont
-- JAMAIS sélectionnées. Subordonnée à is_public = true via le join sur profiles.

create or replace function public.public_collection(p_pseudo text)
returns table (
  parfum_id         text,
  nom               text,
  marque            text,
  image_url         text,
  famille_olfactive text,
  status            public.user_parfum_status,
  verdict           public.scent_verdict,
  rating            numeric(3,1),
  best_price        numeric(10,2),
  added_at          timestamptz
)
language sql stable security definer
set search_path = public
as $$
  select
    up.parfum_id, up.nom, up.marque, up.image_url, up.famille_olfactive,
    up.status, up.verdict, up.rating, up.best_price, up.added_at
  from public.user_parfum up
  join public.profiles p on p.user_id = up.user_id
  where p.pseudo = p_pseudo
    and p.is_public = true
  order by up.added_at desc
  limit 200;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 6. Grants — RPC accessibles en lecture publique (profil public = données publiques)
-- ═══════════════════════════════════════════════════════════════════════════

grant execute on function public.public_profile(text)   to anon, authenticated;
grant execute on function public.public_collection(text) to anon, authenticated;
