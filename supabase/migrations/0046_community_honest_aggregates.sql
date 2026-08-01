-- 0046_community_honest_aggregates.sql — Communauté : agrégats honnêtes + SOTD en RPC dédiée
--
-- Corrige 3 problèmes de l'onglet Communauté en cold-start :
--
-- 1. Prix cassé (« — € ») + compteurs fragmentés.
--    Les matviews 0033 lisaient nom/marque/image_url/famille_olfactive/best_price
--    depuis les tables favoris/scans (champs DÉNORMALISÉS, souvent NULL ou stale)
--    et faisaient GROUP BY sur ces champs → un même parfum était éclaté en plusieurs
--    groupes selon son best_price dénormalisé, ce qui divisait love_count/activity_count
--    ET remontait un best_price NULL. On joint désormais la table canonique `parfums`
--    et on groupe sur la PK seule : prix live + compteurs non fragmentés.
--
-- 2. Seuil « HAVING count(*) >= 3 » de top_loved impossible à tenir en cold-start
--    (1 user = 1 cœur/parfum → section structurellement vide, ou pire : à 1-2 users
--    trending reflétait l'activité du visiteur sous le label « communauté »).
--    top_loved : seuil dynamique = GREATEST(2, 10% des cœurs-récent distincts).
--    trending  : exige >= 2 utilisateurs DISTINCTS (signal croisé, pas un miroir perso).
--    Le fallback éditorial (saison/météo) côté client couvre le vide honnêtement.
--
-- 3. sotd_today change au fil de la journée mais était embarqué dans community_highlights,
--    mis en cache 1h côté client → SOTD « du jour » affiché avec jusqu'à 60 min de retard.
--    Il est extrait dans une RPC dédiée `sotd_community_today()` (cache court côté client).

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. mv_top_loved : JOIN parfums + GROUP BY PK + seuil dynamique
-- ═══════════════════════════════════════════════════════════════════════════

drop materialized view if exists public.mv_top_loved;

create materialized view public.mv_top_loved as
select
  p.id                as parfum_id,
  p.nom,
  p.marque,
  p.image_url,
  p.famille_olfactive,
  p.best_price,
  count(*)::int       as love_count
from public.favoris f
join public.parfums p on p.id = f.parfum_id
where f.added_at > now() - interval '90 days'
group by p.id
having count(*) >= greatest(
  2,
  (select count(distinct user_id) / 10
   from public.favoris
   where added_at > now() - interval '90 days')
)
order by count(*) desc
limit 10;

create unique index mv_top_loved_pk on public.mv_top_loved (parfum_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. mv_trending : JOIN parfums + GROUP BY PK + >= 2 users distincts
-- ═══════════════════════════════════════════════════════════════════════════

drop materialized view if exists public.mv_trending;

create materialized view public.mv_trending as
select
  p.id                as parfum_id,
  p.nom,
  p.marque,
  p.image_url,
  p.famille_olfactive,
  p.best_price,
  sum(c.activity)::int as activity_count
from (
  select parfum_id, user_id, 1 as activity
  from public.favoris
  where added_at > now() - interval '7 days'
  union all
  select parfum_id, user_id, 1 as activity
  from public.scans
  where scanned_at > now() - interval '7 days' and parfum_id is not null
) c
join public.parfums p on p.id = c.parfum_id
group by p.id
having count(distinct c.user_id) >= 2
order by sum(c.activity) desc
limit 10;

create unique index mv_trending_pk on public.mv_trending (parfum_id);

-- Peuplement initial (non concurrent) — requis avant tout refresh concurrent du cron.
refresh materialized view public.mv_top_loved;
refresh materialized view public.mv_trending;

-- (Le cron 'refresh-community-matviews' de 0033 rafraîchit ces deux vues par leur nom ;
--  il n'est PAS recréé ici pour éviter un doublon de schedule.)

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. community_highlights : SANS sotd_today (top_loved/trending via matviews)
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
    )
  );
$$;

grant execute on function public.community_highlights() to anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. sotd_community_today : RPC dédiée, live, cache court côté client
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.sotd_community_today()
returns jsonb
language sql stable security definer
set search_path = public
as $$
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
  ) t;
$$;

grant execute on function public.sotd_community_today() to anon, authenticated;
