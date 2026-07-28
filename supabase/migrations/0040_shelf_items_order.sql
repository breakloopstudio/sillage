-- 0040_shelf_items_order.sql — Ordre & épinglage des flacons DANS une étagère (v8.7 B-réel)
-- L'appartenance d'un parfum à une étagère vivait dans user_parfum.shelf_ids uuid[]
-- (ensemble NON ordonné). On introduit shelf_items : source de vérité de la POSITION
-- et du PIN d'un flacon dans chaque étagère. shelf_ids est conservé comme cache
-- d'appartenance, maintenu en miroir par les RPC atomiques ci-dessous (le client ne
-- l'écrit plus jamais directement → zéro désync).

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. Table shelf_items
-- ═══════════════════════════════════════════════════════════════════════════
create table if not exists public.shelf_items (
  user_id   uuid        not null references auth.users(id) on delete cascade,
  shelf_id  uuid        not null references public.shelves(id) on delete cascade,
  parfum_id text        not null,
  position  int         not null,
  pinned    boolean     not null default false,
  added_at  timestamptz not null default now(),
  primary key (user_id, shelf_id, parfum_id)
);

create index if not exists shelf_items_order
  on public.shelf_items (user_id, shelf_id, position);

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. RLS — owner-all (les mutations passent par RPC SECURITY DEFINER)
-- ═══════════════════════════════════════════════════════════════════════════
alter table public.shelf_items enable row level security;

drop policy if exists "shelf_items_owner_all" on public.shelf_items;
create policy "shelf_items_owner_all" on public.shelf_items
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. Realtime — publication (listener onShelfItems côté app)
-- ═══════════════════════════════════════════════════════════════════════════
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'shelf_items'
  ) then
    alter publication supabase_realtime add table public.shelf_items;
  end if;
end;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. Backfill depuis user_parfum.shelf_ids (position = ordre du tableau)
-- ═══════════════════════════════════════════════════════════════════════════
insert into public.shelf_items (user_id, shelf_id, parfum_id, position, pinned, added_at)
select up.user_id, sid, up.parfum_id, (ord - 1), false, up.added_at
from public.user_parfum up,
     unnest(coalesce(up.shelf_ids, '{}'::uuid[])) with ordinality as u(sid, ord)
on conflict (user_id, shelf_id, parfum_id) do nothing;

-- ═══════════════════════════════════════════════════════════════════════════
-- 5. RPC atomiques (maintiennent shelf_items + shelf_ids en miroir)
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.add_to_shelf(p_shelf_id uuid, p_parfum_id text)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_max int;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  select coalesce(max(position), -1) + 1 into v_max
    from public.shelf_items where user_id = v_uid and shelf_id = p_shelf_id;
  insert into public.shelf_items (user_id, shelf_id, parfum_id, position, pinned, added_at)
    values (v_uid, p_shelf_id, p_parfum_id, v_max, false, now())
    on conflict (user_id, shelf_id, parfum_id) do nothing;
  update public.user_parfum
     set shelf_ids = array_append(shelf_ids, p_shelf_id), updated_at = now()
   where user_id = v_uid and parfum_id = p_parfum_id
     and not (p_shelf_id = any(shelf_ids));
end;
$$;

create or replace function public.remove_from_shelf(p_shelf_id uuid, p_parfum_id text)
returns void
language plpgsql security definer
set search_path = public
as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  delete from public.shelf_items
   where user_id = v_uid and shelf_id = p_shelf_id and parfum_id = p_parfum_id;
  update public.user_parfum
     set shelf_ids = array_remove(shelf_ids, p_shelf_id), updated_at = now()
   where user_id = v_uid and parfum_id = p_parfum_id
     and p_shelf_id = any(shelf_ids);
end;
$$;

create or replace function public.pin_shelf_item(p_shelf_id uuid, p_parfum_id text, p_pinned boolean)
returns void
language plpgsql security definer
set search_path = public
as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  update public.shelf_items set pinned = p_pinned
   where user_id = v_uid and shelf_id = p_shelf_id and parfum_id = p_parfum_id;
end;
$$;

create or replace function public.reorder_shelf_items(p_shelf_id uuid, p_items jsonb)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_el  jsonb;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  for v_el in select * from jsonb_array_elements(p_items)
  loop
    update public.shelf_items
       set position = (v_el ->> 'position')::int,
           pinned   = coalesce((v_el ->> 'pinned')::boolean, false)
     where user_id = v_uid and shelf_id = p_shelf_id
       and parfum_id = (v_el ->> 'parfum_id');
  end loop;
end;
$$;

grant execute on function public.add_to_shelf(uuid, text)            to authenticated;
grant execute on function public.remove_from_shelf(uuid, text)       to authenticated;
grant execute on function public.pin_shelf_item(uuid, text, boolean) to authenticated;
grant execute on function public.reorder_shelf_items(uuid, jsonb)    to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- 6. RPC publiques migrées sur shelf_items (ordre pin+position respecté)
-- ═══════════════════════════════════════════════════════════════════════════
-- create or replace préserve les grants anon+authenticated posés en 0039.

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
    s.id, s.name, s.description, s.color, s.icon,
    (select count(*) from public.shelf_items si
       where si.shelf_id = s.id and si.user_id = s.user_id) as item_count,
    p.pseudo, p.avatar_url, p.bio
  from public.shelves s
  join public.profiles p on p.user_id = s.user_id
  where s.id = p_shelf_id
    and p.pseudo = p_pseudo
    and s.is_public = true
    and p.is_public = true;
$$;

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
  from public.shelf_items si
  join public.user_parfum up on up.user_id = si.user_id and up.parfum_id = si.parfum_id
  join public.shelves s on s.id = si.shelf_id and s.user_id = si.user_id
  join public.profiles p on p.user_id = si.user_id
  where s.id = p_shelf_id
    and p.pseudo = p_pseudo
    and s.is_public = true
    and p.is_public = true
  order by si.pinned desc, si.position asc
  limit 200;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 7. Cohérence : nettoyage des shelf_items à la suppression d'un user_parfum
-- ═══════════════════════════════════════════════════════════════════════════
-- shelf_items.parfum_id n'a pas de FK vers user_parfum (PK composite user_id+parfum_id).
-- Sans ce trigger, retirer un parfum de la parfumerie (ou supprimer le compte,
-- cascade auth.users) laisserait des shelf_items orphelins. Le DELETE est publié
-- en realtime → onShelfItems se met à jour côté app.

create or replace function public.trg_user_parfum_delete_shelf_items()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  delete from public.shelf_items
   where user_id = OLD.user_id and parfum_id = OLD.parfum_id;
  return OLD;
end;
$$;

drop trigger if exists trg_user_parfum_delete_shelf_items on public.user_parfum;
create trigger trg_user_parfum_delete_shelf_items
  after delete on public.user_parfum
  for each row execute function public.trg_user_parfum_delete_shelf_items();
