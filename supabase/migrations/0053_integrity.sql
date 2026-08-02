-- ═══════════════════════════════════════════════════════════════════════════
-- 0053 — Intégrité : horodatage updated_at + validation des votes (audit v9)
--   C4 · Cohérence updated_at :
--          parfum_votes  : colonne présente (0042) mais sans trigger → ajout trigger
--          shelves       : colonne absente → ajout colonne + trigger
--          price_alerts  : colonne absente → ajout colonne + trigger
--          sotd          : colonne absente → ajout colonne + trigger
--        Réutilise public.set_updated_at() (0013). Le BEFORE UPDATE couvre les
--        UPSERT (ON CONFLICT DO UPDATE) de set_sotd / cast_vote.
--   C5 · parfum_votes.value : aucune contrainte en base (validation uniquement
--        dans la RPC cast_vote). Un INSERT PostgREST direct (policy owner) pouvait
--        écrire une valeur invalide. Ajout d'un CHECK par dimension.
--        NOT VALID : protège toutes les écritures futures sans vérifier l'existant
--        (évite un échec de migration si une ligne anomalie préexiste).
--        Pour valider l'existant a posteriori :
--          alter table public.parfum_votes validate constraint parfum_votes_value_check;
-- ═══════════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────────
-- C4 · updated_at
-- ───────────────────────────────────────────────────────────────────────────

-- parfum_votes : colonne déjà présente, on ajoute le trigger manquant
drop trigger if exists trg_parfum_votes_updated_at on public.parfum_votes;
create trigger trg_parfum_votes_updated_at
  before update on public.parfum_votes
  for each row execute function public.set_updated_at();

-- shelves
alter table public.shelves
  add column if not exists updated_at timestamptz not null default now();
drop trigger if exists trg_shelves_updated_at on public.shelves;
create trigger trg_shelves_updated_at
  before update on public.shelves
  for each row execute function public.set_updated_at();

-- price_alerts
alter table public.price_alerts
  add column if not exists updated_at timestamptz not null default now();
drop trigger if exists trg_price_alerts_updated_at on public.price_alerts;
create trigger trg_price_alerts_updated_at
  before update on public.price_alerts
  for each row execute function public.set_updated_at();

-- sotd
alter table public.sotd
  add column if not exists updated_at timestamptz not null default now();
drop trigger if exists trg_sotd_updated_at on public.sotd;
create trigger trg_sotd_updated_at
  before update on public.sotd
  for each row execute function public.set_updated_at();

-- ───────────────────────────────────────────────────────────────────────────
-- C5 · CHECK de validation sur parfum_votes.value
-- ───────────────────────────────────────────────────────────────────────────
alter table public.parfum_votes
  drop constraint if exists parfum_votes_value_check;
alter table public.parfum_votes
  add constraint parfum_votes_value_check check (
       (dimension in ('longevity', 'sillage') and value in ('1', '2', '3', '4'))
    or (dimension = 'season' and value in ('spring', 'summer', 'fall', 'winter'))
    or (dimension = 'moment' and value in ('day', 'night'))
  ) not valid;
