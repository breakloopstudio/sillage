-- 0019_fix_family_overviews.sql — Réécriture itérative de family_overviews.
-- La version CTE (0018) partait en statement timeout : le prédicat
-- `famille_olfactive = any(<colonne CTE>)` empêchait l'usage de l'index btree
-- parfums_famille et windowait sur l'union complète.
-- Version itérative : pour chaque bucket, `= any(<variable PL/pgSQL>)` + LIMIT
-- → BitmapOr d'index scans + top-N borné. 6 buckets × 2 requêtes indexées.

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
declare
  b       jsonb;
  v_key   text;
  v_vals  text[];
  v_total bigint;
  r       record;
  i       int;
begin
  if p_buckets is null then
    return;
  end if;

  for b in select value from jsonb_array_elements(p_buckets)
  loop
    v_key  := b ->> 'key';
    select array_agg(x) into v_vals
    from jsonb_array_elements_text(b -> 'values') as x;

    if v_vals is null or array_length(v_vals, 1) is null then
      continue;
    end if;

    select count(*)::bigint into v_total
    from public.parfums p
    where p.famille_olfactive = any(v_vals)
      and p.image_url is not null;

    i := 0;
    for r in
      select p.id, p.image_url, coalesce(p.popularity_score, 0)::int as ps
      from public.parfums p
      where p.famille_olfactive = any(v_vals)
        and p.image_url is not null
      order by p.popularity_score desc nulls last
      limit p_top
    loop
      bucket_key       := v_key;
      idx              := i;
      parfum_id        := r.id;
      image_url        := r.image_url;
      popularity_score := r.ps;
      total            := v_total;
      return next;
      i := i + 1;
    end loop;
  end loop;
end;
$$;
