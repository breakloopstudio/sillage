-- 0027_community_highlights.sql — Vitrine communauté (Phase 1.5)
-- RPC unique retournant 4 sections en JSONB. Lecture publique (anon + authenticated).
-- Agrégats anonymes (top_loved, trending) + données publiques opt-in (profils, SOTD).

create or replace function public.community_highlights()
returns jsonb
language sql stable security definer
set search_path = public
as $$
  select jsonb_build_object(
    'top_loved', (
      select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb)
      from (
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
        limit 10
      ) t
    ),
    'trending', (
      select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb)
      from (
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
        limit 10
      ) t
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

grant execute on function public.community_highlights() to anon, authenticated;
