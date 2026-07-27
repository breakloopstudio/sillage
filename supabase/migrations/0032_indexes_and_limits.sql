-- 0032_indexes_and_limits.sql — Fixes audit moyen (3.2, 3.3)

-- ═══════════════════════════════════════════════════════════════════════════
-- FIX 3.2 — Index partiel pour parfum_verdicts (évite seq scan sur user_parfum)
-- ═══════════════════════════════════════════════════════════════════════════

create index if not exists user_parfum_parfum_verdict
  on public.user_parfum (parfum_id)
  where verdict is not null;

-- ═══════════════════════════════════════════════════════════════════════════
-- FIX 3.3 — public_collection : paramètre limit (défaut 50, max 200)
-- ═══════════════════════════════════════════════════════════════════════════

drop function if exists public.public_collection(text);

create function public.public_collection(p_pseudo text, p_limit int default 50)
returns table (
  parfum_id         text,
  nom               text,
  marque            text,
  image_url         text,
  famille_olfactive text,
  status            public.user_parfum_status,
  verdict           public.scent_verdict,
  rating            numeric(3,1),
  best_price        numeric(10,2),
  added_at          timestamptz
)
language sql stable security definer
set search_path = public
as $$
  select
    up.parfum_id, up.nom, up.marque, up.image_url, up.famille_olfactive,
    up.status, up.verdict, up.rating, up.best_price, up.added_at
  from public.user_parfum up
  join public.profiles p on p.user_id = up.user_id
  where p.pseudo = p_pseudo
    and p.is_public = true
  order by up.added_at desc
  limit least(greatest(p_limit, 1), 200);
$$;

grant execute on function public.public_collection(text, int) to anon, authenticated;
