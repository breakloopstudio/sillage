-- 0020_personalized_v2.sql — RPC personalized_suggestions v2
-- Signaux : wardrobe(have) ×5, sotd ×2 (cap 10), scentlist(love/like) ×4/×2.5,
--           favoris ×3 (décroissance 90j), price_alerts ×2, scans ×1 (décroissance 45j).
-- Négatif : scentlist(meh/dislike) → exclusion.
-- Matching : overlap main_accords (GIN) + famille + marque, scoring sqrt/ln borné.
-- Diversité : max 3 par famille dans le résultat.
-- Pool : 120 candidats (60 accords + 30 famille + 30 populaires).

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
    select w.famille_olfactive, w.marque, w.parfum_id,
           5.0 * exp(-extract(epoch from now() - w.added_at) / 7776000.0) as w
    from public.wardrobe w
    where w.user_id = v_uid and w.ownership = 'have'
    union all
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
    select sl.famille_olfactive, sl.marque, sl.parfum_id,
           case sl.verdict when 'love' then 4.0 when 'like' then 2.5 else 0 end as w
    from public.scentlist sl
    where sl.user_id = v_uid and sl.verdict in ('love', 'like')
    union all
    select f.famille_olfactive, f.marque, f.parfum_id,
           3.0 * exp(-extract(epoch from now() - f.added_at) / 7776000.0) as w
    from public.favoris f
    where f.user_id = v_uid
    union all
    select p.famille_olfactive, p.marque, pa.parfum_id, 2.0 as w
    from public.price_alerts pa
    join public.parfums p on p.id = pa.parfum_id
    where pa.user_id = v_uid
    union all
    select s.famille_olfactive, s.marque, s.parfum_id,
           1.0 * exp(-extract(epoch from now() - s.scanned_at) / 3888000.0) as w
    from public.scans s
    where s.user_id = v_uid and s.status = 'success'
  ),
  negative as (
    select sl.parfum_id
    from public.scentlist sl
    where sl.user_id = v_uid and sl.verdict in ('meh', 'dislike')
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
