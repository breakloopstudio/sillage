-- 0029_follows.sql — Follow asymétrique (Phase 3a)
-- Graphe social : follower_id suit following_id. Pas d'approbation (privacy = is_public).
-- Compteurs dénormalisés sur profiles (trigger).

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. Table follows
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.follows (
  follower_id  uuid not null references auth.users(id) on delete cascade,
  following_id uuid not null references auth.users(id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id != following_id)
);

create index if not exists follows_following on public.follows (following_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. RLS
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.follows enable row level security;

-- Écriture : soi-même uniquement (follow/unfollow)
drop policy if exists "follows_owner_write" on public.follows;
create policy "follows_owner_write" on public.follows
  for all to authenticated
  using (auth.uid() = follower_id)
  with check (auth.uid() = follower_id);

-- Lecture : tous les follows (le graphe est public — la privacy est dans is_public des profils)
drop policy if exists "follows_public_read" on public.follows;
create policy "follows_public_read" on public.follows
  for select using (true);

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. Compteurs dénormalisés sur profiles
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.profiles
  add column if not exists follower_count  int not null default 0,
  add column if not exists following_count int not null default 0;

-- Trigger : maintient les compteurs à jour
create or replace function public.update_follow_counts()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if TG_OP = 'INSERT' then
    update public.profiles set following_count = following_count + 1 where user_id = NEW.follower_id;
    update public.profiles set follower_count = follower_count + 1 where user_id = NEW.following_id;
    return NEW;
  elsif TG_OP = 'DELETE' then
    update public.profiles set following_count = greatest(following_count - 1, 0) where user_id = OLD.follower_id;
    update public.profiles set follower_count = greatest(follower_count - 1, 0) where user_id = OLD.following_id;
    return OLD;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_follow_counts on public.follows;
create trigger trg_follow_counts
  after insert or delete on public.follows
  for each row execute function public.update_follow_counts();

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. RPC : statut de follow + liste followers/following d'un profil public
-- ═══════════════════════════════════════════════════════════════════════════

-- Est-ce que je (authenticated) suis ce profil ?
create or replace function public.is_following(p_pseudo text)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.follows f
    join public.profiles p on p.user_id = f.following_id
    where f.follower_id = auth.uid()
      and p.pseudo = p_pseudo
      and p.is_public = true
  );
$$;

-- Followers d'un profil public (avec avatar)
create or replace function public.public_followers(p_pseudo text, lim int default 20)
returns table (pseudo text, avatar_url text)
language sql stable security definer
set search_path = public
as $$
  select fp.pseudo, fp.avatar_url
  from public.follows f
  join public.profiles tp on tp.user_id = f.following_id
  join public.profiles fp on fp.user_id = f.follower_id
  where tp.pseudo = p_pseudo
    and tp.is_public = true
    and fp.is_public = true
  order by f.created_at desc
  limit lim;
$$;

-- Following d'un profil public
create or replace function public.public_following(p_pseudo text, lim int default 20)
returns table (pseudo text, avatar_url text)
language sql stable security definer
set search_path = public
as $$
  select fp.pseudo, fp.avatar_url
  from public.follows f
  join public.profiles tp on tp.user_id = f.follower_id
  join public.profiles fp on fp.user_id = f.following_id
  where tp.pseudo = p_pseudo
    and tp.is_public = true
    and fp.is_public = true
  order by f.created_at desc
  limit lim;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 5. Grants
-- ═══════════════════════════════════════════════════════════════════════════

grant select on public.follows to anon, authenticated;
grant insert, delete on public.follows to authenticated;
grant execute on function public.is_following(text) to authenticated;
grant execute on function public.public_followers(text, int) to anon, authenticated;
grant execute on function public.public_following(text, int) to anon, authenticated;

-- Follow/unfollow par pseudo (résout pseudo → user_id côté serveur, pas de leak d'UUID)
create or replace function public.follow_by_pseudo(p_pseudo text)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_target uuid;
begin
  select user_id into v_target from public.profiles where pseudo = p_pseudo and is_public = true;
  if v_target is null then
    raise exception 'Profil introuvable ou privé' using errcode = 'P0002';
  end if;
  if v_target = auth.uid() then
    raise exception 'Impossible de se suivre soi-même' using errcode = 'P0001';
  end if;
  insert into public.follows (follower_id, following_id) values (auth.uid(), v_target)
  on conflict do nothing;
end;
$$;

create or replace function public.unfollow_by_pseudo(p_pseudo text)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_target uuid;
begin
  select user_id into v_target from public.profiles where pseudo = p_pseudo;
  if v_target is null then return; end if;
  delete from public.follows where follower_id = auth.uid() and following_id = v_target;
end;
$$;

grant execute on function public.follow_by_pseudo(text) to authenticated;
grant execute on function public.unfollow_by_pseudo(text) to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- 6. Mise à jour public_profile (ajoute les compteurs)
-- ═══════════════════════════════════════════════════════════════════════════

drop function if exists public.public_profile(text);

create function public.public_profile(p_pseudo text)
returns table (
  pseudo           text,
  avatar_url       text,
  bio              text,
  created_at       timestamptz,
  collection_count bigint,
  follower_count   int,
  following_count  int
)
language sql stable security definer
set search_path = public
as $$
  select
    p.pseudo,
    p.avatar_url,
    p.bio,
    p.created_at,
    (select count(*) from public.user_parfum up where up.user_id = p.user_id) as collection_count,
    p.follower_count,
    p.following_count
  from public.profiles p
  where p.pseudo = p_pseudo
    and p.is_public = true;
$$;
