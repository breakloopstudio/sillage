-- 0001_extensions.sql — Extensions + helpers de normalisation + config FTS
-- Sillage : migration Firebase → Supabase (cf. MIGRATION_SUPABASE.md)
--
-- Convention Supabase : extensions dans le schéma `extensions` (présent dans
-- le search_path par défaut). Si les extensions sont déjà installées dans un
-- autre schéma sur un projet existant, ajuster les qualifications ci-dessous.

create extension if not exists pg_trgm  with schema extensions;
create extension if not exists unaccent with schema extensions;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Wrapper IMMUTABLE autour d'unaccent() (qui est STABLE) — requis pour les
-- colonnes générées et les index fonctionnels.
-- ⚠️ DOIT être plpgsql, pas sql : une fonction `language sql` est INLINÉE dans
-- les colonnes générées, et le vérificateur voit alors unaccent() (STABLE) →
-- erreur "generation expression is not immutable". plpgsql n'est jamais inliné,
-- sa déclaration IMMUTABLE est prise telle quelle.
create or replace function public.immutable_unaccent(t text)
returns text
language plpgsql
immutable
strict
parallel safe
as $$
begin
  return extensions.unaccent('extensions.unaccent'::regdictionary, t);
end;
$$;

-- norm_txt : miroir SQL fidèle de src/utils/normalize.ts → normalize()
--   NFD strip accents ≈ unaccent · lowercase · [^a-z0-9]+ → ' ' (au lieu de '_'
--   car pg_trgm découpe sur les non-alphanumériques de toute façon) · trim
-- plpgsql pour la même raison (colonnes générées).
create or replace function public.norm_txt(t text)
returns text
language plpgsql
immutable
strict
parallel safe
as $$
begin
  return trim(regexp_replace(public.immutable_unaccent(lower(t)), '[^a-z0-9]+', ' ', 'g'));
end;
$$;

-- array_to_string() est STABLE (pas IMMUTABLE) → interdite dans une colonne
-- générée. Même traitement : wrapper plpgsql IMMUTABLE (jamais inliné).
create or replace function public.immutable_array_to_string(arr text[], sep text)
returns text
language plpgsql
immutable
parallel safe
as $$
begin
  return array_to_string(arr, sep);
end;
$$;

-- Config FTS insensible aux accents, SANS stemming ni stop words Postgres :
-- parité avec le comportement de l'app (matching préfixe/littéral, le filtrage
-- des stop words reste côté requête via search_stop_words — cf. 0002).
do $$
begin
  if not exists (
    select 1 from pg_ts_config
    where cfgname = 'french_unaccent' and cfgnamespace = 'public'::regnamespace
  ) then
    create text search configuration public.french_unaccent (copy = simple);
    alter text search configuration public.french_unaccent
      alter mapping for hword, hword_part, word
      with extensions.unaccent, simple;
  end if;
end;
$$;
