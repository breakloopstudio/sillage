-- 0005_rls.sql — Row Level Security (parité exacte de firestore.rules)
-- + publication Realtime des 6 tables écoutées par onSnapshot.

-- ─── parfums ─────────────────────────────────────────────────────────────────
-- rules : read if true / write admin only

alter table public.parfums enable row level security;

drop policy if exists "parfums_read_all" on public.parfums;
create policy "parfums_read_all" on public.parfums
  for select using (true);

drop policy if exists "parfums_write_admin" on public.parfums;
create policy "parfums_write_admin" on public.parfums
  for all to authenticated
  using (exists (select 1 from public.admins a where a.user_id = auth.uid()))
  with check (exists (select 1 from public.admins a where a.user_id = auth.uid()));

-- ─── admins ──────────────────────────────────────────────────────────────────
-- rules : read authenticated / write false

alter table public.admins enable row level security;

drop policy if exists "admins_read_auth" on public.admins;
create policy "admins_read_auth" on public.admins
  for select to authenticated using (true);

-- ─── 10 tables user : owner only (read + write) ──────────────────────────────
-- rules : allow read, write if request.auth.uid == userId

do $$
declare
  t text;
begin
  foreach t in array array[
    'favoris', 'scans', 'collection', 'scentlist', 'wardrobe',
    'shelves', 'sotd', 'price_alerts', 'user_settings', 'push_tokens'
  ] loop
    execute format('alter table public.%I enable row level security', t);

    execute format('drop policy if exists "%I" on public.%I', t || '_owner_all', t);
    execute format(
      'create policy "%I" on public.%I for all to authenticated
         using (auth.uid() = user_id) with check (auth.uid() = user_id)',
      t || '_owner_all', t
    );
  end loop;
end;
$$;

-- ─── Tables server-only : RLS activée, AUCUNE policy (= allow read,write: if false) ──

alter table public.rate_limits        enable row level security;
alter table public.notification_runs  enable row level security;

-- ─── Realtime : publication des 6 tables avec listeners onSnapshot ───────────
-- sotd / user_settings / price_alerts / push_tokens : pas de listener dans le code
-- actuel (get/upsert uniquement) → pas publiées.
-- Replica identity par défaut suffisante : les DELETE véhiculent la PK.

do $$
declare
  t text;
begin
  foreach t in array array['favoris', 'scans', 'collection', 'scentlist', 'wardrobe', 'shelves'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end;
$$;
