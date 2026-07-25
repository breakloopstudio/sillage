-- 0006_functions.sql — RPC : recherche, similaires, suggestions, quotas,
-- transactions métier (remplacement des writeBatch Firestore), export RGPD.

-- Seuils pg_trgm au niveau BASE (dédiée à l'app) :
--   word_similarity 0.3  → candidats préfixe/typo de search_parfums
--   similarity 0.25      → fallback fuzzy (= seuil Jaccard de l'app)
-- NB : SET LOCAL est interdit dans une fonction STABLE — d'où le réglage global.
alter database postgres set pg_trgm.word_similarity_threshold = 0.3;
alter database postgres set pg_trgm.similarity_threshold      = 0.25;

-- ═══════════════════════════════════════════════════════════════════════════
-- search_parfums — remplace searchParfumsCached (array-contains → trgm + FTS)
-- Formule de scoring = parité avec _scoreDocs (reference.md §7) :
--   matchScore  ≈ Σ word_similarity(token, search_text)        (0..1 / token)
--   exactMatch  = +10 si ≥ 2 tokens et query complète dans search_text
--   popBonus    = ln(greatest(review_count, rating_count, popularity_score)+1)/2
-- Fuzzy : similarity(search_text, q) > 0.25 si < 5 résultats (= Jaccard trgm).
-- Dédoublonnage : norm_txt(marque, nom) — garde le meilleur score.
-- ═══════════════════════════════════════════════════════════════════════════
create or replace function public.search_parfums(q text, max_results int default 50)
returns setof public.parfums
language plpgsql
stable
set search_path = public, extensions
as $$
declare
  nq     text := public.norm_txt(q);
  tokens text[];
begin
  -- Parité : query < 2 chars → []
  if nq is null or length(nq) < 2 then
    return;
  end if;

  -- Tokenisation identique à searchParfumsCached :
  -- split, ≥ 2 chars, stop words filtrés, tri longueur desc, max 4 tokens
  select coalesce(array_agg(t order by length(t) desc), '{}')
    into tokens
  from (
    select distinct w as t
    from regexp_split_to_table(nq, '\s+') as w
    where length(w) >= 2
      and not exists (select 1 from public.search_stop_words s where s.word = w)
    limit 4
  ) sub;

  if cardinality(tokens) = 0 then
    return;
  end if;

  -- Les seuils trgm sont globaux (ALTER DATABASE en tête de fichier).

  return query
  with cand as (
    -- Candidats : au moins un token en word-similarity (index GIN par token,
    -- nested loop ≤ 4 itérations) — couvre préfixes ET fautes de frappe
    select p.id, p.marque, p.nom, p.search_text,
           sum(word_similarity(tok, p.search_text)) as match_score,
           ln(greatest(
                coalesce(p.review_count, 0),
                coalesce(p.rating_count, 0),
                coalesce(p.popularity_score, 0)
              ) + 1) / 2 as pop_bonus,
           greatest(
             coalesce(p.review_count, 0),
             coalesce(p.rating_count, 0),
             coalesce(p.popularity_score, 0)
           ) as pop
    from public.parfums p
    join unnest(tokens) as tok on p.search_text %> tok
    group by p.id, p.marque, p.nom, p.search_text,
             p.review_count, p.rating_count, p.popularity_score
  ),
  scored as (
    select c.*,
           match_score + pop_bonus
           + case
               when cardinality(tokens) >= 2
                 and c.search_text like '%' || nq || '%'
               then 10 else 0
             end as score
    from cand c
    where match_score > 0
  ),
  best as (
    select * from scored
    order by score desc, pop desc          -- pertinence primaire, pop tiebreaker
    limit max_results * 2                   -- marge pour le dédoublonnage
  ),
  deduped as (
    select distinct on (public.norm_txt(marque), public.norm_txt(nom)) *
    from best
    order by public.norm_txt(marque), public.norm_txt(nom), score desc, pop desc
  ),
  fuzzy as (
    -- Fallback si rappel faible (< 5) : similarité trgm globale (Jaccard)
    select p.id, similarity(p.search_text, nq) as score
    from public.parfums p
    where (select count(*) from deduped) < 5
      and p.search_text % nq
      and not exists (select 1 from deduped d where d.id = p.id)
    order by score desc
    limit 10
  ),
  final as (
    select d.id, d.score from deduped d
    union all
    select f.id, f.score from fuzzy f
  )
  select p.*
  from final f
  join public.parfums p on p.id = f.id
  order by f.score desc
  limit max_results;
end;
$$;

grant execute on function public.search_parfums(text, int) to anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- similar_parfums — remplace getSimilarParfums (mainAccords array-contains-any)
-- Score : 10 × accords partagés + popularity/100, top 40, shuffle journalier
-- déterministe (remplace le Lehmer RNG par setseed sur la date).
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

  -- Seed déterministe par jour (parité : shuffle quotidien stable)
  perform setseed(abs(hashtext(current_date::text)) / 2147483648.0);

  return query
  with scored as (
    select p.id,
           cardinality(array(
             select unnest(p.main_accords)
             intersect
             select unnest(accords)
           )) * 10 + coalesce(p.popularity_score, 0) / 100 as score
    from public.parfums p
    where p.main_accords && accords                 -- overlap (index GIN)
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
-- personalized_suggestions — remplace getPersonalizedSuggestions
-- Family/brand scores sur favoris+scans du user, exclusion des vus, 1 round-trip.
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
begin
  if v_uid is null then
    return;
  end if;

  return query
  with fav as (
    select f.famille_olfactive, f.marque, f.parfum_id
    from public.favoris f where f.user_id = v_uid
    union all
    select s.famille_olfactive, s.marque, s.parfum_id
    from public.scans s where s.user_id = v_uid
  ),
  fam_scores as (
    select famille_olfactive as f, count(*) as c
    from fav where famille_olfactive is not null group by 1
  ),
  brand_scores as (
    select marque as m, count(*) as c
    from fav where marque is not null group by 1
  ),
  seen as (
    select distinct parfum_id from fav where parfum_id is not null
  ),
  top_fam as (
    select f from fam_scores order by c desc limit 3
  ),
  cand as (
    -- Parité : 20 candidats famille + 20 populaires (union déduplique)
    (select p.* from public.parfums p
      where p.famille_olfactive in (select f from top_fam)
      order by p.popularity_score desc nulls last limit 20)
    union
    (select p.* from public.parfums p
      order by p.popularity_score desc nulls last limit 20)
  ),
  scored as (
    select c.id,
           coalesce(fs.c, 0) * 3
           + coalesce(bs.c, 0) * 2
           + coalesce(c.popularity_score, 0) / 20 as score
    from cand c
    left join fam_scores fs on fs.f = c.famille_olfactive
    left join brand_scores bs on bs.m = c.marque
    where not exists (select 1 from seen s where s.parfum_id = c.id)
      and c.image_url is not null
  )
  select p.*
  from scored s
  join public.parfums p on p.id = s.id
  order by s.score desc
  limit lim;
end;
$$;

grant execute on function public.personalized_suggestions(int) to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- check_and_increment_quota — remplace la transaction Firestore rate-limit.ts
-- UPDATE conditionnel atomique : lève 'resource-exhausted' si quota atteint.
-- Appelée par les Edge Functions analyze-perfume-image / transcribe-voice.
-- ═══════════════════════════════════════════════════════════════════════════
create or replace function public.check_and_increment_quota(p_kind text, p_max int)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_count int;
begin
  if v_uid is null then
    raise exception 'unauthenticated';
  end if;
  if p_kind not in ('scan', 'voice') then
    raise exception 'invalid-argument: kind doit être scan ou voice';
  end if;

  insert into public.rate_limits (user_id, day, scan_count, voice_count)
  values (v_uid, current_date, 0, 0)
  on conflict (user_id, day) do nothing;

  if p_kind = 'scan' then
    update public.rate_limits
    set scan_count = scan_count + 1
    where user_id = v_uid and day = current_date and scan_count < p_max
    returning scan_count into v_count;
  else
    update public.rate_limits
    set voice_count = voice_count + 1
    where user_id = v_uid and day = current_date and voice_count < p_max
    returning voice_count into v_count;
  end if;

  if not found then
    raise exception 'resource-exhausted: limite quotidienne atteinte (%)', p_kind;
  end if;
end;
$$;

revoke all on function public.check_and_increment_quota(text, int) from public, anon;
grant execute on function public.check_and_increment_quota(text, int) to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- set_sotd — remplace le batch setSotd (upsert sotd + increment sotd_count)
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
begin
  if v_uid is null then
    raise exception 'unauthenticated';
  end if;

  insert into public.sotd (user_id, day, parfum_id, nom, marque, image_url)
  values (v_uid, current_date, p_parfum_id, p_nom, p_marque, p_image_url)
  on conflict (user_id, day) do update set
    parfum_id = excluded.parfum_id,
    nom       = excluded.nom,
    marque    = excluded.marque,
    image_url = excluded.image_url;

  update public.wardrobe
  set sotd_count = sotd_count + 1,
      updated_at = now()
  where user_id = v_uid and parfum_id = p_parfum_id;
end;
$$;

grant execute on function public.set_sotd(text, text, text, text) to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- move_* — remplacent les writeBatch Firestore (delete source + upsert cible,
-- atomique en une transaction Postgres)
-- ═══════════════════════════════════════════════════════════════════════════

-- moveFavori : from 'collection' | 'scentlist' → favoris (avec champs filtres)
create or replace function public.move_favori(
  p_from text,
  p_parfum_id text,
  p_nom text default null,
  p_marque text default null,
  p_image_url text default null,
  p_famille_olfactive text default null,
  p_longevity text default null,
  p_sillage text default null,
  p_season_scores jsonb default null,
  p_notes text[] default null
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'unauthenticated'; end if;
  if p_from not in ('collection', 'scentlist') then
    raise exception 'invalid-argument: from doit être collection ou scentlist';
  end if;

  insert into public.favoris (
    user_id, parfum_id, nom, marque, image_url, famille_olfactive,
    longevity, sillage, season_scores, notes, added_at
  ) values (
    v_uid, p_parfum_id, p_nom, p_marque, p_image_url, p_famille_olfactive,
    p_longevity, p_sillage, p_season_scores, p_notes, now()
  )
  on conflict (user_id, parfum_id) do update set
    nom               = excluded.nom,
    marque            = excluded.marque,
    image_url         = excluded.image_url,
    famille_olfactive = excluded.famille_olfactive,
    longevity         = excluded.longevity,
    sillage           = excluded.sillage,
    season_scores     = excluded.season_scores,
    notes             = excluded.notes;

  if p_from = 'collection' then
    delete from public.collection where user_id = v_uid and parfum_id = p_parfum_id;
  else
    delete from public.scentlist where user_id = v_uid and parfum_id = p_parfum_id;
  end if;
end;
$$;

grant execute on function public.move_favori(text, text, text, text, text, text, text, text, jsonb, text[]) to authenticated;

-- moveToCollection : from 'favoris' | 'scentlist' → collection
create or replace function public.move_to_collection(
  p_from text,
  p_parfum_id text,
  p_nom text default null,
  p_marque text default null,
  p_image_url text default null
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'unauthenticated'; end if;
  if p_from not in ('favoris', 'scentlist') then
    raise exception 'invalid-argument: from doit être favoris ou scentlist';
  end if;

  insert into public.collection (user_id, parfum_id, nom, marque, image_url, added_at)
  values (v_uid, p_parfum_id, p_nom, p_marque, p_image_url, now())
  on conflict (user_id, parfum_id) do update set
    nom       = excluded.nom,
    marque    = excluded.marque,
    image_url = excluded.image_url;

  if p_from = 'favoris' then
    delete from public.favoris where user_id = v_uid and parfum_id = p_parfum_id;
  else
    delete from public.scentlist where user_id = v_uid and parfum_id = p_parfum_id;
  end if;
end;
$$;

grant execute on function public.move_to_collection(text, text, text, text, text) to authenticated;

-- moveToScentList : from 'favoris' | 'collection' → scentlist (statut to_try)
create or replace function public.move_to_scentlist(
  p_from text,
  p_parfum_id text,
  p_nom text default null,
  p_marque text default null,
  p_image_url text default null,
  p_famille_olfactive text default null
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'unauthenticated'; end if;
  if p_from not in ('favoris', 'collection') then
    raise exception 'invalid-argument: from doit être favoris ou collection';
  end if;

  insert into public.scentlist (
    user_id, parfum_id, nom, marque, image_url, famille_olfactive,
    status, verdict, rating, notes, tried_at, added_at, updated_at
  ) values (
    v_uid, p_parfum_id, p_nom, p_marque, p_image_url, p_famille_olfactive,
    'to_try', null, null, null, null, now(), now()
  )
  on conflict (user_id, parfum_id) do update set
    nom               = excluded.nom,
    marque            = excluded.marque,
    image_url         = excluded.image_url,
    famille_olfactive = excluded.famille_olfactive,
    updated_at        = now();

  if p_from = 'favoris' then
    delete from public.favoris where user_id = v_uid and parfum_id = p_parfum_id;
  else
    delete from public.collection where user_id = v_uid and parfum_id = p_parfum_id;
  end if;
end;
$$;

grant execute on function public.move_to_scentlist(text, text, text, text, text, text) to authenticated;

-- moveScentToWardrobe : scentlist → wardrobe (transfère rating/notes), atomique
-- (remplace la séquence addToWardrobe + updateWardrobeItem + removeFromScentList)
create or replace function public.move_scent_to_wardrobe(
  p_parfum_id text,
  p_ownership public.ownership_type,
  p_size_ml int default null,
  p_nom text default null,
  p_marque text default null,
  p_image_url text default null,
  p_famille_olfactive text default null,
  p_rating numeric default null,
  p_notes text default null,
  p_longevity text default null,
  p_sillage text default null,
  p_season_scores jsonb default null,
  p_all_notes text[] default null
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'unauthenticated'; end if;

  insert into public.wardrobe (
    user_id, parfum_id, nom, marque, image_url, famille_olfactive,
    ownership, rating, notes, shelf_ids, size_ml, sotd_count, is_signature,
    longevity, sillage, season_scores, all_notes, added_at, updated_at
  ) values (
    v_uid, p_parfum_id, p_nom, p_marque, p_image_url, p_famille_olfactive,
    p_ownership, p_rating, p_notes, '{}', p_size_ml, 0, false,
    p_longevity, p_sillage, p_season_scores, p_all_notes, now(), now()
  )
  on conflict (user_id, parfum_id) do update set
    ownership         = excluded.ownership,
    rating            = coalesce(excluded.rating, public.wardrobe.rating),
    notes             = coalesce(excluded.notes, public.wardrobe.notes),
    size_ml           = coalesce(excluded.size_ml, public.wardrobe.size_ml),
    longevity         = coalesce(excluded.longevity, public.wardrobe.longevity),
    sillage           = coalesce(excluded.sillage, public.wardrobe.sillage),
    season_scores     = coalesce(excluded.season_scores, public.wardrobe.season_scores),
    all_notes         = coalesce(excluded.all_notes, public.wardrobe.all_notes),
    updated_at        = now();

  delete from public.scentlist where user_id = v_uid and parfum_id = p_parfum_id;
end;
$$;

grant execute on function public.move_scent_to_wardrobe(text, public.ownership_type, int, text, text, text, text, numeric, text, text, text, jsonb, text[]) to authenticated;

-- deleteShelf : delete shelf + retrait de shelf_ids dans wardrobe (batch Firestore)
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

  update public.wardrobe
  set shelf_ids = array_remove(shelf_ids, p_shelf_id),
      updated_at = now()
  where user_id = v_uid and p_shelf_id = any(shelf_ids);
end;
$$;

grant execute on function public.delete_shelf(uuid) to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- export_user_data — export RGPD en une requête (Edge Function export-user-data
-- = enveloppe fine autour de cette RPC). Même shape que l'export actuel.
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
    'version', '2.0.0',
    'collections', jsonb_build_object(
      'favoris',      (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.favoris t where t.user_id = v_uid),
      'wardrobe',     (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.wardrobe t where t.user_id = v_uid),
      'scans',        (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.scans t where t.user_id = v_uid),
      'shelves',      (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.shelves t where t.user_id = v_uid),
      'sotd',         (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.sotd t where t.user_id = v_uid),
      'collection',   (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.collection t where t.user_id = v_uid),
      'scentlist',    (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.scentlist t where t.user_id = v_uid),
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
