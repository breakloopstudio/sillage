-- ═══════════════════════════════════════════════════════════════════════════
-- 0055 — Perf serveur (audit BDD v9 · B3 + B5)
--
--   B3 · recompute_perf_strings : la version 0042 itérait ligne par ligne
--        (curseur sur distinct parfum_id) avec ~8 sous-requêtes corrélées par
--        parfum (N+1). Réécriture set-based : un seul UPDATE ... FROM sur un CTE
--        qui calcule les deux scores pour TOUS les parfums votés d'un coup.
--        Effet de bord corrigé : chaque UPDATE déclenchait trg_parfums_updated_at
--        (0013) → le cron « mutilait » parfums.updated_at quotidiennement,
--        bruitant l'index parfums_updated_at_desc. Le trigger est neutralisé le
--        temps du recalcul et réactivé quoi qu'il arrive (handler d'exception).
--
--   B5 · Matviews communauté (mv_top_loved 90j / mv_trending 7j) rafraîchies
--        toutes les 10 min (144×/jour) pour une activité décrite « cold-start
--        dormant » et un cache client de 1h. Passage à 30 min : gain CPU,
--        fraîcheur max 30 min largement acceptable.
-- ═══════════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────────
-- B3 · recompute_perf_strings — set-based
-- ───────────────────────────────────────────────────────────────────────────
create or replace function public.recompute_perf_strings()
returns int
language plpgsql security definer
set search_path = public
as $$
declare
  PERF_CAP constant numeric := 100;
  n int := 0;
begin
  execute 'alter table public.parfums disable trigger trg_parfums_updated_at';
  begin
    with calc as (
      select v.parfum_id,
        public._perf_score(
          public._perf_cranks(p.longevity_breakout, 'longevity'),
          public._user_cranks(v.parfum_id, 'longevity'), PERF_CAP) as score_l,
        public._perf_score(
          public._perf_cranks(p.sillage_breakout, 'sillage'),
          public._user_cranks(v.parfum_id, 'sillage'), PERF_CAP) as score_s
      from (select distinct parfum_id from public.parfum_votes) v
      join public.parfums p on p.id = v.parfum_id
    )
    update public.parfums pf set
      longevity = case when c.score_l is null then pf.longevity
        else case greatest(1, least(4, round(c.score_l)::int))
          when 1 then 'weak' when 2 then 'moderate'
          when 3 then 'long lasting' when 4 then 'eternal' end
        end,
      sillage = case when c.score_s is null then pf.sillage
        else case greatest(1, least(4, round(c.score_s)::int))
          when 1 then 'intimate' when 2 then 'moderate'
          when 3 then 'strong' when 4 then 'enormous' end
        end
    from calc c
    where pf.id = c.parfum_id;

    get diagnostics n = row_count;
  exception when others then
    execute 'alter table public.parfums enable trigger trg_parfums_updated_at';
    raise;
  end;
  execute 'alter table public.parfums enable trigger trg_parfums_updated_at';
  return n;
end;
$$;

grant execute on function public.recompute_perf_strings() to service_role;

-- ───────────────────────────────────────────────────────────────────────────
-- B5 · Matviews communauté — refresh /30 min (au lieu de /10 min)
-- ───────────────────────────────────────────────────────────────────────────
do $$
begin
  begin
    perform cron.unschedule('refresh-community-matviews');
  exception when others then
    null;
  end;
  perform cron.schedule(
    'refresh-community-matviews',
    '*/30 * * * *',
    'refresh materialized view concurrently public.mv_top_loved; refresh materialized view concurrently public.mv_trending;'
  );
end;
$$;
