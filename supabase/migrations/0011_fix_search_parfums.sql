-- 0011 — Fix search_parfums : la CTE deduped en DISTINCT ON levait
-- « for SELECT DISTINCT, ORDER BY expressions must appear in select list »
-- à l'exécution (ORDER BY score/pop non reconnus via SELECT *).
-- Remplacement par row_number() OVER (PARTITION BY marque+nom normalisés),
-- sémantique identique (garde le meilleur score par groupe marque+nom).

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
    -- row_number() au lieu de DISTINCT ON : évite l'erreur ORDER BY/select list
    select id, marque, nom, search_text, match_score, pop_bonus, score, pop
    from (
      select b.*,
             row_number() over (
               partition by public.norm_txt(b.marque), public.norm_txt(b.nom)
               order by b.score desc, b.pop desc
             ) as rn
      from best b
    ) ranked
    where rn = 1
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
