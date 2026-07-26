-- 0018_family_overviews.sql — RPC éditoriale « Explorer par famille » (1 round-trip)
-- Remplace 6 requêtes PostgREST getFamilyOverview par un seul appel.
-- La taxonomie (paniers de valeurs famille_olfactive) vit côté client et est
-- passée en paramètre (p_buckets) : le SQL est un moteur d'agrégation générique,
-- aucune duplication de la taxonomie en base.
--
-- p_buckets = [{ "key": "boisee", "values": ["woody","oud",...] }, ...]
-- Renvoie, par bucket, les p_top flacons les plus populaires (rotation côté
-- client) + l'effectif total. Index btree parfums_famille déjà présent (0004).

create or replace function public.family_overviews(p_buckets jsonb, p_top int default 5)
returns table(
  bucket_key       text,
  idx              int,
  parfum_id        text,
  image_url        text,
  popularity_score int,
  total            bigint
)
language plpgsql
stable
set search_path = public, extensions
as $$
begin
  if p_buckets is null or jsonb_array_length(p_buckets) = 0 then
    return;
  end if;

  return query
  with b as (
    select
      obj ->> 'key' as key,
      array(select jsonb_array_elements_text(obj -> 'values')) as vals
    from jsonb_array_elements(p_buckets) as obj
  ),
  counts as (
    select b.key, count(p.id)::bigint as total
    from b
    left join public.parfums p
      on p.famille_olfactive = any(b.vals)
     and p.image_url is not null
    group by b.key
  ),
  tops as (
    select
      b.key,
      p.id            as parfum_id,
      p.image_url     as image_url,
      coalesce(p.popularity_score, 0)::int as popularity_score,
      row_number() over (
        partition by b.key
        order by p.popularity_score desc nulls last
      ) as rn
    from b
    join public.parfums p
      on p.famille_olfactive = any(b.vals)
     and p.image_url is not null
  )
  select
    t.key,
    (t.rn - 1)::int,
    t.parfum_id,
    t.image_url,
    t.popularity_score,
    coalesce(c.total, 0::bigint)
  from tops t
  join counts c on c.key = t.key
  where t.rn <= p_top
  order by t.key, t.rn;
end;
$$;

grant execute on function public.family_overviews(jsonb, int) to anon, authenticated;
