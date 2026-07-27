-- 0030_followed_highlights.sql — Activité des nez suivis (Phase 3b)
-- RPC authentifiée : retourne SOTD du jour + verdicts récents + nouveaux « have »
-- des profils que l'utilisateur suit. Utilisée par l'onglet Communauté (connecté).

create or replace function public.followed_highlights()
returns jsonb
language sql stable security definer
set search_path = public
as $$
  select jsonb_build_object(
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
        join public.follows f on f.following_id = s.user_id
        join public.profiles p on p.user_id = s.user_id
        where f.follower_id = auth.uid()
          and s.day = current_date
          and p.is_public = true
        order by random()
        limit 10
      ) t
    ),
    'recent_verdicts', (
      select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb)
      from (
        select
          p.pseudo,
          p.avatar_url,
          up.parfum_id,
          up.nom,
          up.marque,
          up.image_url,
          up.verdict,
          up.updated_at
        from public.user_parfum up
        join public.follows f on f.following_id = up.user_id
        join public.profiles p on p.user_id = up.user_id
        where f.follower_id = auth.uid()
          and up.verdict is not null
          and up.updated_at > now() - interval '7 days'
          and p.is_public = true
        order by up.updated_at desc
        limit 15
      ) t
    ),
    'new_have', (
      select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb)
      from (
        select
          p.pseudo,
          p.avatar_url,
          up.parfum_id,
          up.nom,
          up.marque,
          up.image_url,
          up.added_at
        from public.user_parfum up
        join public.follows f on f.following_id = up.user_id
        join public.profiles p on p.user_id = up.user_id
        where f.follower_id = auth.uid()
          and up.status = 'have'
          and up.added_at > now() - interval '7 days'
          and p.is_public = true
        order by up.added_at desc
        limit 10
      ) t
    )
  );
$$;

grant execute on function public.followed_highlights() to authenticated;
