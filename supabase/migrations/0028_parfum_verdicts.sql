-- 0028_parfum_verdicts.sql — Verdicts publics sur un parfum (Phase 2)
-- Retourne les profils publics ayant un verdict sur un parfum donné.
-- Lecture publique (anon + authenticated). Pas de notes, pas de rating.

create or replace function public.parfum_verdicts(p_parfum_id text)
returns table (
  pseudo     text,
  avatar_url text,
  verdict    public.scent_verdict
)
language sql stable security definer
set search_path = public
as $$
  select
    p.pseudo,
    p.avatar_url,
    up.verdict
  from public.user_parfum up
  join public.profiles p on p.user_id = up.user_id
  where up.parfum_id = p_parfum_id
    and up.verdict is not null
    and p.is_public = true
  order by
    case up.verdict
      when 'love' then 0
      when 'like' then 1
      when 'meh' then 2
      when 'dislike' then 3
    end,
    up.updated_at desc
  limit 50;
$$;

grant execute on function public.parfum_verdicts(text) to anon, authenticated;
