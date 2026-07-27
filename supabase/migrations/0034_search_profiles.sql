-- 0034_search_profiles.sql — Quick win 6.7 : autocomplete pseudo
-- Recherche par préfixe sur les profils publics (utilisé par la barre de recherche Communauté).

create or replace function public.search_profiles(p_prefix text, lim int default 5)
returns table (pseudo text, avatar_url text, collection_count bigint)
language sql stable security definer
set search_path = public
as $$
  select
    p.pseudo,
    p.avatar_url,
    (select count(*) from public.user_parfum up where up.user_id = p.user_id) as collection_count
  from public.profiles p
  where p.is_public = true
    and p.pseudo like p_prefix || '%'
  order by p.follower_count desc, p.pseudo
  limit least(greatest(lim, 1), 10);
$$;

grant execute on function public.search_profiles(text, int) to anon, authenticated;
