-- 0013 — Fixes audit : abs() overflow, set_sotd double-incrément, trigger updated_at

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. similar_parfums : abs(hashtext()) overflow sur INT_MIN
--    Fix : caster en bigint avant abs()
-- ═══════════════════════════════════════════════════════════════════════════
create or replace function public.similar_parfums(
  accords text[],
  exclude_id text,
  lim int default 6
)
returns setof public.parfums
language plpgsql
stable
set search_path = public, extensions
as $$
begin
  if accords is null or cardinality(accords) = 0 then
    return;
  end if;

  perform setseed(abs(hashtext(current_date::text)::bigint) / 2147483648.0);

  return query
  with scored as (
    select p.id,
           cardinality(array(
             select unnest(p.main_accords)
             intersect
             select unnest(accords)
           )) * 10 + coalesce(p.popularity_score, 0) / 100 as score
    from public.parfums p
    where p.main_accords && accords
      and p.id <> exclude_id
      and p.image_url is not null
    order by score desc
    limit 40
  )
  select p.*
  from scored s
  join public.parfums p on p.id = s.id
  order by random()
  limit lim;
end;
$$;

grant execute on function public.similar_parfums(text[], text, int) to anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. set_sotd v3 : guard incrément (ne pas incrémenter si même parfum)
-- ═══════════════════════════════════════════════════════════════════════════
create or replace function public.set_sotd(
  p_parfum_id text,
  p_nom text,
  p_marque text,
  p_image_url text default null
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_old_parfum_id text;
begin
  if v_uid is null then
    raise exception 'unauthenticated';
  end if;

  select parfum_id into v_old_parfum_id
  from public.sotd
  where user_id = v_uid and day = current_date;

  if v_old_parfum_id is not null and v_old_parfum_id is distinct from p_parfum_id then
    update public.wardrobe
    set sotd_count = greatest(sotd_count - 1, 0),
        updated_at = now()
    where user_id = v_uid and parfum_id = v_old_parfum_id;
  end if;

  insert into public.sotd (user_id, day, parfum_id, nom, marque, image_url)
  values (v_uid, current_date, p_parfum_id, p_nom, p_marque, p_image_url)
  on conflict (user_id, day) do update set
    parfum_id = excluded.parfum_id,
    nom       = excluded.nom,
    marque    = excluded.marque,
    image_url = excluded.image_url;

  if v_old_parfum_id is distinct from p_parfum_id then
    update public.wardrobe
    set sotd_count = sotd_count + 1,
        updated_at = now()
    where user_id = v_uid and parfum_id = p_parfum_id;
  end if;
end;
$$;

grant execute on function public.set_sotd(text, text, text, text) to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. Trigger updated_at automatique sur parfums, wardrobe, scentlist
-- ═══════════════════════════════════════════════════════════════════════════
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_parfums_updated_at on public.parfums;
create trigger trg_parfums_updated_at
  before update on public.parfums
  for each row execute function public.set_updated_at();

drop trigger if exists trg_wardrobe_updated_at on public.wardrobe;
create trigger trg_wardrobe_updated_at
  before update on public.wardrobe
  for each row execute function public.set_updated_at();

drop trigger if exists trg_scentlist_updated_at on public.scentlist;
create trigger trg_scentlist_updated_at
  before update on public.scentlist
  for each row execute function public.set_updated_at();
