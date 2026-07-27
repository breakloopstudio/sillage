-- 0031_fix_critical_community.sql — Fixes audit critique (5.1, 1.1, 1.2)

-- ═══════════════════════════════════════════════════════════════════════════
-- FIX 5.1 — RLS follows : le graphe n'est plus public via PostgREST
-- ═══════════════════════════════════════════════════════════════════════════
-- Avant : USING (true) + GRANT TO anon → n'importe qui pouvait mapper tous les UUIDs.
-- Après : lecture uniquement si les DEUX profils sont publics. Anon perd le SELECT direct.

drop policy if exists "follows_public_read" on public.follows;
create policy "follows_public_read" on public.follows
  for select
  using (
    exists (select 1 from public.profiles where user_id = follower_id and is_public = true)
    and exists (select 1 from public.profiles where user_id = following_id and is_public = true)
  );

revoke select on public.follows from anon;

-- WITH CHECK renforcé : on ne peut suivre qu'un profil public (anti-bypass PostgREST direct)
drop policy if exists "follows_owner_write" on public.follows;
create policy "follows_owner_write" on public.follows
  for all to authenticated
  using (auth.uid() = follower_id)
  with check (
    auth.uid() = follower_id
    and exists (select 1 from public.profiles where user_id = following_id and is_public = true)
  );

-- ═══════════════════════════════════════════════════════════════════════════
-- FIX 1.1 — followed_highlights : new_have utilise updated_at (pas added_at)
-- ═══════════════════════════════════════════════════════════════════════════
-- Un changement de statut to_try → have modifie updated_at, pas added_at.

create or replace function public.followed_highlights()
returns jsonb
language sql stable security definer
set search_path = public
as $$
  select jsonb_build_object(
    'sotd_today', (
      select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb)
      from (
        select
          p.pseudo,
          p.avatar_url,
          s.parfum_id,
          s.nom,
          s.marque,
          s.image_url
        from public.sotd s
        join public.follows f on f.following_id = s.user_id
        join public.profiles p on p.user_id = s.user_id
        where f.follower_id = auth.uid()
          and s.day = current_date
          and p.is_public = true
        order by random()
        limit 10
      ) t
    ),
    'recent_verdicts', (
      select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb)
      from (
        select
          p.pseudo,
          p.avatar_url,
          up.parfum_id,
          up.nom,
          up.marque,
          up.image_url,
          up.verdict,
          up.updated_at
        from public.user_parfum up
        join public.follows f on f.following_id = up.user_id
        join public.profiles p on p.user_id = up.user_id
        where f.follower_id = auth.uid()
          and up.verdict is not null
          and up.updated_at > now() - interval '7 days'
          and p.is_public = true
        order by up.updated_at desc
        limit 15
      ) t
    ),
    'new_have', (
      select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb)
      from (
        select
          p.pseudo,
          p.avatar_url,
          up.parfum_id,
          up.nom,
          up.marque,
          up.image_url,
          up.updated_at as added_at
        from public.user_parfum up
        join public.follows f on f.following_id = up.user_id
        join public.profiles p on p.user_id = up.user_id
        where f.follower_id = auth.uid()
          and up.status = 'have'
          and up.updated_at > now() - interval '7 days'
          and p.is_public = true
        order by up.updated_at desc
        limit 10
      ) t
    )
  );
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- FIX 1.2 — Trigger compteurs : guard si le profil n'existe pas encore
-- ═══════════════════════════════════════════════════════════════════════════
-- Si l'user n'a pas de row profiles, l'UPDATE affecte 0 rows → compteur perdu.
-- Fix : le trigger ne fait rien si le profil n'existe pas (le recalcul se fait
-- à la création du profil via upsertMyProfile — voir ci-dessous).

create or replace function public.update_follow_counts()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if TG_OP = 'INSERT' then
    update public.profiles set following_count = following_count + 1
      where user_id = NEW.follower_id;
    update public.profiles set follower_count = follower_count + 1
      where user_id = NEW.following_id;
    return NEW;
  elsif TG_OP = 'DELETE' then
    update public.profiles set following_count = greatest(following_count - 1, 0)
      where user_id = OLD.follower_id;
    update public.profiles set follower_count = greatest(follower_count - 1, 0)
      where user_id = OLD.following_id;
    return OLD;
  end if;
  return null;
end;
$$;

-- Recalcul des compteurs à la création/mise à jour du profil
-- (corrige la désynchronisation si des follows existaient avant le profil)
create or replace function public.recalc_follow_counts()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  NEW.follower_count := (select count(*) from public.follows where following_id = NEW.user_id);
  NEW.following_count := (select count(*) from public.follows where follower_id = NEW.user_id);
  return NEW;
end;
$$;

drop trigger if exists trg_profiles_recalc_counts on public.profiles;
create trigger trg_profiles_recalc_counts
  before insert or update on public.profiles
  for each row execute function public.recalc_follow_counts();
