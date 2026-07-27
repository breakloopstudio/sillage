-- 0025_admins_rls_self_only.sql — FIX (audit F3) : la policy admins_read_auth
-- exposait la liste complète des admins à tout utilisateur authentifié (using true).
-- Restreint la lecture à sa propre ligne (auth.uid() = user_id) : le check isAdmin
-- de l'app (useAuth.ts, .eq('user_id', su.id)) continue de fonctionner, mais aucun
-- utilisateur ne peut plus lister les UUID admins (divulgation d'information).
-- Le grant SELECT (0003) reste ; la RLS filtre désormais les lignes.

drop policy if exists "admins_read_auth" on public.admins;
create policy "admins_read_self" on public.admins
  for select to authenticated using (auth.uid() = user_id);
