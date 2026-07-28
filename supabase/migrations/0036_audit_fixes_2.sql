-- 0036_audit_fixes_2.sql — Correctifs audit v8.7 (suite)
-- M11 : trigger recalc_follow_counts restreint au INSERT (pas UPDATE profil)
-- M12 : possessions.updated_at + trigger

-- ─── M11 : recalc_follow_counts — INSERT only ───────────────────────────────

drop trigger if exists trg_profiles_recalc_counts on public.profiles;

create trigger trg_profiles_recalc_counts
  before insert on public.profiles
  for each row execute function public.recalc_follow_counts();

-- ─── M12 : possessions.updated_at ───────────────────────────────────────────

alter table public.possessions add column if not exists updated_at timestamptz not null default now();

create trigger trg_possessions_updated_at
  before update on public.possessions
  for each row execute function public.set_updated_at();
