-- 0033_community_matviews.sql — Fix 3.1 : vues matérialisées pour les agrégats lourds
-- top_loved et trending sont des agrégats sur favoris/scans (tables volumineuses).
-- Les vues matérialisées sont rafraîchies toutes les 10 min via pg_cron.
-- sotd_today et public_profiles restent en live (requêtes légères, indexées).

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. Vue matérialisée : top_loved
-- ═══════════════════════════════════════════════════════════════════════════

create materialized view if not exists public.mv_top_loved as
select
  f.parfum_id,
  f.nom,
  f.marque,
  f.image_url,
  f.famille_olfactive,
  f.best_price,
  count(*)::int as love_count
from public.favoris f
group by f.parfum_id, f.nom, f.marque, f.image_url, f.famille_olfactive, f.best_price
having count(*) >= 3
order by count(*) desc
limit 10;

create unique index if not exists mv_top_loved_pk on public.mv_top_loved (parfum_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. Vue matérialisée : trending (7 jours)
-- ═══════════════════════════════════════════════════════════════════════════

create materialized view if not exists public.mv_trending as
select
  parfum_id, nom, marque, image_url, famille_olfactive, best_price,
  sum(activity)::int as activity_count
from (
  select parfum_id, nom, marque, image_url, famille_olfactive, best_price, 1 as activity
  from public.favoris
  where added_at > now() - interval '7 days'
  union all
  select parfum_id, nom, marque, image_url, famille_olfactive, best_price, 1 as activity
  from public.scans
  where scanned_at > now() - interval '7 days' and parfum_id is not null
) combined
group by parfum_id, nom, marque, image_url, famille_olfactive, best_price
order by sum(activity) desc
limit 10;

create unique index if not exists mv_trending_pk on public.mv_trending (parfum_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. Refresh via pg_cron (toutes les 10 min)
-- ═══════════════════════════════════════════════════════════════════════════

select cron.schedule(
  'refresh-community-matviews',
  '*/10 * * * *',
  'refresh materialized view concurrently public.mv_top_loved; refresh materialized view concurrently public.mv_trending;'
);

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. Mise à jour community_highlights : lit les matviews
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.community_highlights()
returns jsonb
language sql stable security definer
set search_path = public
as $$
  select jsonb_build_object(
    'top_loved', (
      select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb)
      from (select * from public.mv_top_loved) t
    ),
    'trending', (
      select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb)
      from (select * from public.mv_trending) t
    ),
    'public_profiles', (
      select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb)
      from (
        select
          p.pseudo,
          p.avatar_url,
          p.bio,
          count(up.parfum_id)::int as collection_count,
          (
            select coalesce(jsonb_agg(sub.image_url), '[]'::jsonb)
            from (
              select up2.image_url
              from public.user_parfum up2
              where up2.user_id = p.user_id and up2.image_url is not null
              order by up2.added_at desc
              limit 3
            ) sub
          ) as top_images
        from public.profiles p
        join public.user_parfum up on up.user_id = p.user_id
        where p.is_public = true
        group by p.user_id, p.pseudo, p.avatar_url, p.bio
        order by count(up.parfum_id) desc
        limit 6
      ) t
    ),
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
        join public.profiles p on p.user_id = s.user_id
        where s.day = current_date
          and p.is_public = true
        order by random()
        limit 10
      ) t
    )
  );
$$;
