-- 0010 — Fix set_sotd (décrément ancien parfum) + search_parfums (tri tokens)

-- ═══════════════════════════════════════════════════════════════════════════
-- set_sotd v2 : décrémente le sotd_count de l'ancien parfum si le SOTD change
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

  update public.wardrobe
  set sotd_count = sotd_count + 1,
      updated_at = now()
  where user_id = v_uid and parfum_id = p_parfum_id;
end;
$$;

grant execute on function public.set_sotd(text, text, text, text) to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- search_parfums v2 : ORDER BY length(w) DESC avant LIMIT 4
-- (parité avec la tokenisation client : les 4 tokens les plus longs)
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
  if nq is null or length(nq) < 2 then
    return;
  end if;

  select coalesce(array_agg(t order by length(t) desc), '{}')
    into tokens
  from (
    select distinct w as t
    from regexp_split_to_table(nq, '\s+') as w
    where length(w) >= 2
      and not exists (select 1 from public.search_stop_words s where s.word = w)
    order by length(w) desc
    limit 4
  ) sub;

  if cardinality(tokens) = 0 then
    return;
  end if;

  return query
  with cand as (
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
    order by score desc, pop desc
    limit max_results * 2
  ),
  deduped as (
    select distinct on (public.norm_txt(marque), public.norm_txt(nom)) *
    from best
    order by public.norm_txt(marque), public.norm_txt(nom), score desc, pop desc
  ),
  fuzzy as (
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
