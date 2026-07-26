-- 0020_unified_user_parfum.sql — Modèle unifié : user_parfum + possessions
-- Fusionne wardrobe + scentlist en une seule table de relation (parcours utilisateur).
-- Les possessions (flacon, décant, échantillon) deviennent des objets physiques multiples.
-- Le cœur (favoris) reste une table séparée (inchangée).

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. Nouveaux enums
-- ═══════════════════════════════════════════════════════════════════════════

create type public.user_parfum_status as enum ('to_try', 'tried', 'want', 'have', 'had');
create type public.possession_type    as enum ('bottle', 'decant', 'sample');

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. Table user_parfum — la relation unique (parcours + metadata)
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.user_parfum (
  user_id           uuid not null references auth.users(id) on delete cascade,
  parfum_id         text not null,

  -- parcours
  status            public.user_parfum_status not null default 'to_try',
  verdict           public.scent_verdict,
  rating            numeric(3,1),
  notes             text,
  tried_at          timestamptz,

  -- collection
  shelf_ids         uuid[] not null default '{}',
  sotd_count        int not null default 0,
  is_signature      boolean not null default false,

  -- affichage dénormalisé
  nom               text,
  marque            text,
  image_url         text,
  famille_olfactive text,
  best_price        numeric(10,2),
  reference_price   numeric(10,2),

  -- filtres dénormalisés
  longevity         text,
  sillage           text,
  season_scores     jsonb,
  all_notes         text[],

  added_at          timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  primary key (user_id, parfum_id)
);

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. Table possessions — objets physiques (multiples par parfum)
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.possessions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  parfum_id  text not null,

  type       public.possession_type not null default 'bottle',
  size_ml    int,
  quantity   int not null default 1,
  for_sale   boolean not null default false,
  notes      text,

  added_at   timestamptz not null default now(),

  constraint fk_user_parfum
    foreign key (user_id, parfum_id)
    references public.user_parfum (user_id, parfum_id)
    on delete cascade
);

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. Index
-- ═══════════════════════════════════════════════════════════════════════════

create index if not exists user_parfum_user_status
  on public.user_parfum (user_id, status);
create index if not exists user_parfum_user_added
  on public.user_parfum (user_id, added_at desc);
create index if not exists possessions_user_parfum
  on public.possessions (user_id, parfum_id);
create index if not exists possessions_user_type
  on public.possessions (user_id, type);

-- ═══════════════════════════════════════════════════════════════════════════
-- 5. RLS — owner only (même pattern que les autres tables user)
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.user_parfum enable row level security;
alter table public.possessions enable row level security;

create policy "user_parfum_owner_all" on public.user_parfum
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "possessions_owner_all" on public.possessions
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- 6. Realtime publication
-- ═══════════════════════════════════════════════════════════════════════════

alter publication supabase_realtime add table public.user_parfum;
alter publication supabase_realtime add table public.possessions;

-- ═══════════════════════════════════════════════════════════════════════════
-- 7. Trigger updated_at
-- ═══════════════════════════════════════════════════════════════════════════

create trigger trg_user_parfum_updated_at
  before update on public.user_parfum
  for each row execute function public.set_updated_at();

-- ═══════════════════════════════════════════════════════════════════════════
-- 8. Backfill — scentlist → user_parfum
-- ═══════════════════════════════════════════════════════════════════════════

insert into public.user_parfum (
  user_id, parfum_id, status, verdict, rating, notes, tried_at,
  nom, marque, image_url, famille_olfactive, best_price, reference_price,
  added_at, updated_at
)
select
  user_id, parfum_id,
  status::text::public.user_parfum_status,
  verdict, rating, notes, tried_at,
  nom, marque, image_url, famille_olfactive, best_price, reference_price,
  added_at, updated_at
from public.scentlist
on conflict (user_id, parfum_id) do nothing;

-- ═══════════════════════════════════════════════════════════════════════════
-- 9. Backfill — wardrobe → user_parfum (wins on conflict)
--    ownership mapping : have/sample/decant → 'have', want → 'want', had → 'had'
-- ═══════════════════════════════════════════════════════════════════════════

insert into public.user_parfum (
  user_id, parfum_id, status, rating, notes,
  shelf_ids, sotd_count, is_signature,
  nom, marque, image_url, famille_olfactive,
  longevity, sillage, season_scores, all_notes,
  added_at, updated_at
)
select
  user_id, parfum_id,
  case ownership
    when 'have'   then 'have'::public.user_parfum_status
    when 'sample' then 'have'::public.user_parfum_status
    when 'decant' then 'have'::public.user_parfum_status
    when 'want'   then 'want'::public.user_parfum_status
    when 'had'    then 'had'::public.user_parfum_status
  end,
  rating, notes,
  shelf_ids, sotd_count, is_signature,
  nom, marque, image_url, famille_olfactive,
  longevity, sillage, season_scores, all_notes,
  added_at, updated_at
from public.wardrobe
on conflict (user_id, parfum_id) do update set
  status        = excluded.status,
  rating        = coalesce(excluded.rating, user_parfum.rating),
  notes         = coalesce(excluded.notes, user_parfum.notes),
  shelf_ids     = excluded.shelf_ids,
  sotd_count    = excluded.sotd_count,
  is_signature  = excluded.is_signature,
  nom           = coalesce(excluded.nom, user_parfum.nom),
  marque        = coalesce(excluded.marque, user_parfum.marque),
  image_url     = coalesce(excluded.image_url, user_parfum.image_url),
  famille_olfactive = coalesce(excluded.famille_olfactive, user_parfum.famille_olfactive),
  longevity     = coalesce(excluded.longevity, user_parfum.longevity),
  sillage       = coalesce(excluded.sillage, user_parfum.sillage),
  season_scores = coalesce(excluded.season_scores, user_parfum.season_scores),
  all_notes     = coalesce(excluded.all_notes, user_parfum.all_notes),
  updated_at    = now();

-- ═══════════════════════════════════════════════════════════════════════════
-- 10. Backfill — wardrobe → possessions (objets physiques)
--     have → bottle, sample → sample, decant → decant
--     want/had → pas de possession
-- ═══════════════════════════════════════════════════════════════════════════

insert into public.possessions (user_id, parfum_id, type, size_ml, quantity, added_at)
select
  user_id, parfum_id,
  case ownership
    when 'have'   then 'bottle'::public.possession_type
    when 'sample' then 'sample'::public.possession_type
    when 'decant' then 'decant'::public.possession_type
  end,
  size_ml,
  1,
  added_at
from public.wardrobe
where ownership in ('have', 'sample', 'decant');

-- ═══════════════════════════════════════════════════════════════════════════
-- 11. GRANTs
-- ═══════════════════════════════════════════════════════════════════════════

grant select, insert, update, delete on public.user_parfum to authenticated;
grant select, insert, update, delete on public.possessions to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- 12. Mise à jour set_sotd → user_parfum (remplace wardrobe)
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
    update public.user_parfum
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
    update public.user_parfum
    set sotd_count = sotd_count + 1,
        updated_at = now()
    where user_id = v_uid and parfum_id = p_parfum_id;
  end if;
end;
$$;

grant execute on function public.set_sotd(text, text, text, text) to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- 13. Mise à jour delete_shelf → user_parfum (remplace wardrobe)
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.delete_shelf(p_shelf_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'unauthenticated'; end if;

  delete from public.shelves
  where id = p_shelf_id and user_id = v_uid;

  update public.user_parfum
  set shelf_ids = array_remove(shelf_ids, p_shelf_id),
      updated_at = now()
  where user_id = v_uid and p_shelf_id = any(shelf_ids);
end;
$$;

grant execute on function public.delete_shelf(uuid) to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- 14. Suppression des RPCs obsolètes (move entre tables → simple UPDATE status)
-- ═══════════════════════════════════════════════════════════════════════════

drop function if exists public.move_scent_to_wardrobe(text, public.ownership_type, int, text, text, text, text, numeric, text, text, text, jsonb, text[]);
drop function if exists public.move_to_collection(text, text, text, text, text);
drop function if exists public.move_to_scentlist(text, text, text, text, text, text);
drop function if exists public.move_favori(text, text, text, text, text, text, text, text, jsonb, text[]);

-- ═══════════════════════════════════════════════════════════════════════════
-- 15. export_user_data — mise à jour RGPD (user_parfum + possessions)
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.export_user_data()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_out jsonb;
begin
  if v_uid is null then
    raise exception 'unauthenticated';
  end if;

  select jsonb_build_object(
    'exportedAt', now(),
    'app', 'ParfumScan',
    'version', '3.0.0',
    'collections', jsonb_build_object(
      'favoris',      (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.favoris t where t.user_id = v_uid),
      'userParfum',   (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.user_parfum t where t.user_id = v_uid),
      'possessions',  (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.possessions t where t.user_id = v_uid),
      'scans',        (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.scans t where t.user_id = v_uid),
      'shelves',      (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.shelves t where t.user_id = v_uid),
      'sotd',         (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.sotd t where t.user_id = v_uid),
      'priceAlerts',  (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.price_alerts t where t.user_id = v_uid),
      'settings',     (select to_jsonb(t) from public.user_settings t where t.user_id = v_uid)
    ),
    'excluded', jsonb_build_array(
      jsonb_build_object(
        'table', 'push_tokens',
        'reason', 'Identifiants techniques de notification, régénérés automatiquement'
      )
    )
  ) into v_out;

  return v_out;
end;
$$;

revoke all on function public.export_user_data() from public, anon;
grant execute on function public.export_user_data() to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- 16. personalized_suggestions v3 — lit user_parfum (remplace wardrobe + scentlist)
--     Signaux : have ×5, sotd ×2 (cap 10), verdict love ×4 / like ×2.5,
--               favoris ×3 (décroissance 90j), price_alerts ×2, scans ×1.
--     Négatif : verdict meh/dislike → exclusion.
-- ═══════════════════════════════════════════════════════════════════════════

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
    -- possession active (have) → signal fort
    select up.famille_olfactive, up.marque, up.parfum_id,
           5.0 * exp(-extract(epoch from now() - up.added_at) / 7776000.0) as w
    from public.user_parfum up
    where up.user_id = v_uid and up.status = 'have'
    union all
    -- sotd
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
    -- verdict positif (love/like)
    select up.famille_olfactive, up.marque, up.parfum_id,
           case up.verdict when 'love' then 4.0 when 'like' then 2.5 else 0 end as w
    from public.user_parfum up
    where up.user_id = v_uid and up.verdict in ('love', 'like')
    union all
    -- favoris (cœur)
    select f.famille_olfactive, f.marque, f.parfum_id,
           3.0 * exp(-extract(epoch from now() - f.added_at) / 7776000.0) as w
    from public.favoris f
    where f.user_id = v_uid
    union all
    -- price alerts
    select p.famille_olfactive, p.marque, pa.parfum_id, 2.0 as w
    from public.price_alerts pa
    join public.parfums p on p.id = pa.parfum_id
    where pa.user_id = v_uid
    union all
    -- scans
    select s.famille_olfactive, s.marque, s.parfum_id,
           1.0 * exp(-extract(epoch from now() - s.scanned_at) / 3888000.0) as w
    from public.scans s
    where s.user_id = v_uid and s.status = 'success'
  ),
  negative as (
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
