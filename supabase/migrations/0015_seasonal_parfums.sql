-- 0015_seasonal_parfums.sql — RPC éditoriale : parfums dont la saison passée
-- est la saison DOMINANTE (argmax des 4 saisons, day/night exclus).
-- Alimente la rangée « Parfaits pour l'été » du catalogue (saison dynamique).
--
-- season_ranking = jsonb [{name, score}] où score = nombre de votes bruts
-- (centaines/milliers), name ∈ {spring, summer, autumn, winter, day, night}.
-- NB : la donnée utilise « autumn » ; on accepte aussi « fall » en entrée.

create or replace function public.seasonal_parfums(season text, lim int default 12)
returns setof public.parfums
language plpgsql
stable
set search_path = public, extensions
as $$
declare
  v_season text := lower(trim(coalesce(season, '')));
begin
  if v_season = 'fall' then v_season := 'autumn'; end if;
  if v_season not in ('spring', 'summer', 'autumn', 'winter') then
    return;
  end if;

  return query
  with parsed as (
    -- Une seule expansion JSONB : score de la saison cible + max des 4 saisons
    -- (day/night exclus de l'argmax via la liste blanche).
    select p.id,
           p.popularity_score,
           max(case when e->>'name' = v_season
                    then (e->>'score')::numeric end) as target_score,
           max(case when e->>'name' in ('spring', 'summer', 'autumn', 'winter')
                    then (e->>'score')::numeric end) as max_season_score
    from public.parfums p
    cross join lateral jsonb_array_elements(p.season_ranking) e
    where p.season_ranking is not null
      and p.image_url is not null
    group by p.id, p.popularity_score
  )
  select p.*
  from parsed s
  join public.parfums p on p.id = s.id
  where s.target_score is not null
    and s.target_score >= s.max_season_score   -- la saison cible est dominante
  order by s.target_score desc, s.popularity_score desc nulls last
  limit lim;
end;
$$;

grant execute on function public.seasonal_parfums(text, int) to anon, authenticated;
