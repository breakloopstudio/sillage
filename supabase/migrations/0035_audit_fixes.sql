-- 0035_audit_fixes.sql — Correctifs audit v8.7
-- C3 : search_profiles LIKE non échappé → starts_with()
-- C4 : tables mortes (collection, scentlist, wardrobe) retirées du realtime + GRANTs révoqués
-- M10 : 5 index manquants (sotd.day, favoris.added_at, scans.scanned_at, profiles.pseudo prefix, user_parfum.parfum_id)

-- ─── C3 : search_profiles — échappement des wildcards ───────────────────────

create or replace function public.search_profiles(p_prefix text, lim int default 5)
returns table (pseudo text, avatar_url text, collection_count bigint)
language sql stable security definer
set search_path = public
as $$
  select
    p.pseudo,
    p.avatar_url,
    (select count(*) from public.user_parfum up where up.user_id = p.user_id) as collection_count
  from public.profiles p
  where p.is_public = true
    and starts_with(p.pseudo, lower(trim(p_prefix)))
  order by p.follower_count desc, p.pseudo
  limit least(greatest(lim, 1), 10);
$$;

-- ─── C4 : tables mortes — nettoyage realtime + GRANTs ───────────────────────

do $$ begin
  alter publication supabase_realtime drop table public.collection;
exception when others then null;
end $$;
do $$ begin
  alter publication supabase_realtime drop table public.scentlist;
exception when others then null;
end $$;
do $$ begin
  alter publication supabase_realtime drop table public.wardrobe;
exception when others then null;
end $$;

drop trigger if exists trg_collection_updated_at on public.collection;
drop trigger if exists trg_scentlist_updated_at on public.scentlist;
drop trigger if exists trg_wardrobe_updated_at on public.wardrobe;

revoke insert, update, delete on public.collection from authenticated;
revoke insert, update, delete on public.scentlist from authenticated;
revoke insert, update, delete on public.wardrobe from authenticated;

-- ─── M10 : index manquants ──────────────────────────────────────────────────

create index if not exists sotd_day_idx on public.sotd (day);

create index if not exists favoris_added_at_idx on public.favoris (added_at desc);

create index if not exists scans_scanned_at_idx on public.scans (scanned_at desc) where parfum_id is not null;

create index if not exists profiles_pseudo_prefix on public.profiles (pseudo text_pattern_ops);

create index if not exists user_parfum_parfum_id_idx on public.user_parfum (parfum_id);
