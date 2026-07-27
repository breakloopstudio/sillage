-- 0022_price_alerts_v2.sql — Alertes prix v2 : prix cible custom + historique de prix
-- + publication Realtime de price_alerts (nouveau listener onPriceAlerts côté app).

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. price_alerts — prix cible + prix à l'activation
-- ═══════════════════════════════════════════════════════════════════════════
-- target_price  : seuil custom (« préviens-moi sous 70 € »). NULL = logique
--                 historique (baisse ≥ 10% ou ≥ 5€ vs last_price).
-- initial_price : prix au moment de l'activation — ancre pour « −X% depuis
--                 l'alerte » dans l'UI (last_price, lui, est écrasé à chaque run).

alter table public.price_alerts
  add column if not exists target_price  numeric(10,2),
  add column if not exists initial_price numeric(10,2);

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. price_history — plus bas prix constaté par parfum (1 ligne / jour)
-- ═══════════════════════════════════════════════════════════════════════════
-- Alimentée par le cron check-price-alerts (service_role) pour les parfums
-- suivis. Lecture publique (les prix sont déjà publics via parfums.best_price).
-- Sert d'ancre de suggestion (« plus bas constaté : 64 € ») et, plus tard,
-- d'un graphe d'évolution sur la fiche.

create table if not exists public.price_history (
  parfum_id   text not null,
  captured_on date not null default current_date,
  best_price  numeric(10,2) not null,
  primary key (parfum_id, captured_on)
);

create index if not exists price_history_parfum_captured
  on public.price_history (parfum_id, captured_on desc);

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. RLS — price_history en lecture publique (parité parfums), écriture cron
-- ═══════════════════════════════════════════════════════════════════════════
-- L'écriture passe exclusivement par le service_role (bypass RLS) ; aucune
-- policy d'écriture pour authenticated/anon.

alter table public.price_history enable row level security;

drop policy if exists "price_history_read_all" on public.price_history;
create policy "price_history_read_all" on public.price_history
  for select using (true);

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. Realtime — publication de price_alerts (listener onPriceAlerts)
-- ═══════════════════════════════════════════════════════════════════════════
-- price_alerts n'était pas publiée (get/upsert uniquement avant v8.3).
-- Le tab Favoris s'abonne désormais en temps réel (section « Tes alertes »
-- + badges 🔔) → la table rejoint la publication supabase_realtime.

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'price_alerts'
  ) then
    alter publication supabase_realtime add table public.price_alerts;
  end if;
end;
$$;
