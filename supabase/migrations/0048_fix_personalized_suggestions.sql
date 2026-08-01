-- 0048_fix_personalized_suggestions.sql — Hotfix : « Pour vous » lisait des tables mortes
--
-- Régression silencieuse depuis v8.0 (0021_unified_user_parfum) : la RPC 0020 construisait
-- ses signaux sur public.wardrobe (ownership='have') et public.scentlist (verdict), or depuis
-- 0021 TOUTES les écritures have/verdict vont dans public.user_parfum. wardrobe/scentlist ne
-- sont plus écrites par l'UI → ces deux branches de signaux (les plus pondérées : ×5 et ×4)
-- sont vides pour tout user actif post-v8.0, et la branche négative (meh/dislike) aussi.
-- Conséquence : personalized_suggestions retombe silencieusement sur favoris/price_alerts/
-- scans/sotd, et « Pour vous » (CatalogPage) perd ses deux signaux les plus forts dès le
-- 1er vrai utilisateur, sans aucun symptôme visible.
--
-- Fix : on réécrit ces 3 branches sur public.user_parfum (status='have', verdict love/like,
-- négatif meh/dislike). Le reste (sotd, favoris, price_alerts, scans) est inchangé — ces
-- tables sont vivantes. SQL pur, 0 impact UI, 0 changement de contrat (même signature/retour).

create or replace function public.personalized_suggestions(lim int default 16)
returns setof public.parfums
language plpgsql
stable
security invoker
set search_path = public, extensions
as $$
declare
  v_uid uuid := auth.uid();
  v_season text;
begin
  if v_uid is null then
    return;
  end if;

  v_season := case extract(month from now())::int
    when 3 then 'spring' when 4 then 'spring' when 5 then 'spring'
    when 6 then 'summer' when 7 then 'summer' when 8 then 'summer'
    when 9 then 'autumn' when 10 then 'autumn' when 11 then 'autumn'
    else 'winter'
  end;

  return query
  with signals as (
    -- possessions (ex-wardrobe have) : signal fort ×5 avec décroissance 90j
    select up.famille_olfactive, up.marque, up.parfum_id,
           5.0 * exp(-extract(epoch from now() - up.added_at) / 7776000.0) as w
    from public.user_parfum up
    where up.user_id = v_uid and up.status = 'have'
    union all
    -- parfum du jour (sotd) : ×2 par jour porté, plafonné à 10
    select p.famille_olfactive, sub.marque, sub.parfum_id,
           least(sub.cnt, 10) * 2.0 as w
    from (
      select s.parfum_id, s.marque, count(*) as cnt
      from public.sotd s
      where s.user_id = v_uid
      group by s.parfum_id, s.marque
    ) sub
    join public.parfums p on p.id = sub.parfum_id
    union all
    -- verdicts positifs (ex-scentlist love/like) : love ×4, like ×2.5
    select up.famille_olfactive, up.marque, up.parfum_id,
           case up.verdict when 'love' then 4.0 when 'like' then 2.5 else 0 end as w
    from public.user_parfum up
    where up.user_id = v_uid and up.verdict in ('love', 'like')
    union all
    -- favoris (cœur) : ×3 avec décroissance 90j
    select f.famille_olfactive, f.marque, f.parfum_id,
           3.0 * exp(-extract(epoch from now() - f.added_at) / 7776000.0) as w
    from public.favoris f
    where f.user_id = v_uid
    union all
    -- alertes prix : ×2
    select p.famille_olfactive, p.marque, pa.parfum_id, 2.0 as w
    from public.price_alerts pa
    join public.parfums p on p.id = pa.parfum_id
    where pa.user_id = v_uid
    union all
    -- scans réussis : ×1 avec décroissance 45j
    select s.famille_olfactive, s.marque, s.parfum_id,
           1.0 * exp(-extract(epoch from now() - s.scanned_at) / 3888000.0) as w
    from public.scans s
    where s.user_id = v_uid and s.status = 'success'
  ),
  negative as (
    -- verdicts négatifs (ex-scentlist meh/dislike) → exclusion
    select up.parfum_id
    from public.user_parfum up
    where up.user_id = v_uid and up.verdict in ('meh', 'dislike')
  ),
  seen as (
    select distinct parfum_id from signals where parfum_id is not null
  ),
  user_accords as (
    select a.accord, sum(sg.w) as c
    from signals sg
    join public.parfums p on p.id = sg.parfum_id
    cross join lateral unnest(p.main_accords) a(accord)
    group by a.accord
    order by c desc
    limit 8
  ),
  fam_scores as (
    select famille_olfactive as f, sum(w) as c
    from signals
    where famille_olfactive is not null
    group by 1
  ),
  brand_scores as (
    select marque as m, sum(w) as c
    from signals
    where marque is not null
    group by 1
  ),
  top_fam as (
    select f from fam_scores order by c desc limit 3
  ),
  cand as (
    (select p.* from public.parfums p
     where p.main_accords && (select coalesce(array_agg(accord), '{}') from user_accords)
       and p.image_url is not null
     order by p.popularity_score desc nulls last
     limit 60)
    union
    (select p.* from public.parfums p
     where p.famille_olfactive in (select f from top_fam)
       and p.image_url is not null
     order by p.popularity_score desc nulls last
     limit 30)
    union
    (select p.* from public.parfums p
     where p.image_url is not null
     order by p.popularity_score desc nulls last
     limit 30)
  ),
  scored as (
    select c.id, c.famille_olfactive,
      coalesce(cardinality(array(
        select unnest(c.main_accords)
        intersect
        select accord from user_accords
      )), 0) * 4.0
      + sqrt(coalesce(fs.c, 0)) * 2.0
      + sqrt(coalesce(bs.c, 0)) * 1.5
      + ln(coalesce(c.popularity_score, 0) + 1)
      + coalesce((
        select ln((e->>'score')::numeric + 1) / 2
        from jsonb_array_elements(c.season_ranking) e
        where e->>'name' = v_season
        limit 1
      ), 0)
      as score
    from cand c
    left join fam_scores fs on fs.f = c.famille_olfactive
    left join brand_scores bs on bs.m = c.marque
    where not exists (select 1 from seen s where s.parfum_id = c.id)
      and not exists (select 1 from negative n where n.parfum_id = c.id)
  ),
  ranked as (
    select *, row_number() over (
      partition by famille_olfactive order by score desc
    ) as fam_rank
    from scored
  )
  select p.*
  from ranked r
  join public.parfums p on p.id = r.id
  where r.fam_rank <= 3
  order by r.score desc
  limit lim;
end;
$$;

grant execute on function public.personalized_suggestions(int) to authenticated;
