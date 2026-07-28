-- 0039_public_shelves.sql — Communauté Phase 2 : étagères publiques & partage
-- Lecture publique d'UNE étagère (méta + flacons) d'un membre, subordonnée à la
-- double visibilité : shelves.is_public = true ET profiles.is_public = true.
-- Les notes personnelles (user_parfum.notes) ne sont JAMAIS exposées.

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. RPC public_shelf — en-tête de l'étagère publique + identité du membre
-- ═══════════════════════════════════════════════════════════════════════════
-- SECURITY DEFINER : lit l'étagère d'un AUTRE user (RLS owner-only contournée),
-- filtré sur les deux is_public. Renvoie 1 ligne même si l'étagère est vide
-- (select depuis shelves, pas depuis user_parfum) ; 0 ligne si privée/introuvable.

create or replace function public.public_shelf(p_pseudo text, p_shelf_id uuid)
returns table (
  shelf_id     uuid,
  name         text,
  description  text,
  color        text,
  icon         text,
  item_count   bigint,
  pseudo       text,
  avatar_url   text,
  bio          text
)
language sql stable security definer
set search_path = public
as $$
  select
    s.id,
    s.name,
    s.description,
    s.color,
    s.icon,
    (select count(*) from public.user_parfum up
       where up.user_id = s.user_id and s.id = any(up.shelf_ids)) as item_count,
    p.pseudo,
    p.avatar_url,
    p.bio
  from public.shelves s
  join public.profiles p on p.user_id = s.user_id
  where s.id = p_shelf_id
    and p.pseudo = p_pseudo
    and s.is_public = true
    and p.is_public = true;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. RPC public_shelf_items — flacons de l'étagère publique (notes exclues)
-- ═══════════════════════════════════════════════════════════════════════════
-- Identité + statut + verdict + rating + meilleur prix (données publiques côté
-- catalogue). Subordonné aux deux is_public via le join sur profiles + shelves.

create or replace function public.public_shelf_items(p_pseudo text, p_shelf_id uuid)
returns table (
  parfum_id         text,
  nom               text,
  marque            text,
  image_url         text,
  famille_olfactive text,
  status            public.user_parfum_status,
  verdict           public.scent_verdict,
  rating            numeric(3,1),
  best_price        numeric(10,2)
)
language sql stable security definer
set search_path = public
as $$
  select
    up.parfum_id, up.nom, up.marque, up.image_url, up.famille_olfactive,
    up.status, up.verdict, up.rating, up.best_price
  from public.user_parfum up
  join public.shelves s on s.user_id = up.user_id and s.id = any(up.shelf_ids)
  join public.profiles p on p.user_id = up.user_id
  where s.id = p_shelf_id
    and p.pseudo = p_pseudo
    and s.is_public = true
    and p.is_public = true
  order by up.added_at desc
  limit 200;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. Grants — lecture publique (étagère publique = données publiques)
-- ═══════════════════════════════════════════════════════════════════════════

grant execute on function public.public_shelf(text, uuid)       to anon, authenticated;
grant execute on function public.public_shelf_items(text, uuid) to anon, authenticated;
