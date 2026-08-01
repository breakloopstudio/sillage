-- 0045 — Backfill `parfums.type_parfum` depuis le nom officiel.
--
-- Le scrape Fragrantica stockait dans `type_parfum` un mot-clé de concentration
-- tiré du <title> SEO (« cologne » pour les hommes, « perfume » pour les femmes),
-- qui ne reflète pas le flacon réel (ex: « The Most Wanted Parfum » étiqueté
-- « eau de cologne »). Ce bruit faussait le rescoring de type du scan.
--
-- On recalcule `type_parfum` à partir du suffixe du nom officiel — miroir SQL de
-- src/utils/parfum-labels.ts#concentrationFromName (ordre des suffixes identique).
-- Si le nom ne porte aucune concentration, on met NULL (honnête) plutôt qu'un
-- faux-positif SEO. Idempotent : ne réécrit que les lignes dont la valeur change.

WITH computed AS (
  SELECT
    id,
    CASE
      WHEN lower(btrim(nom)) LIKE '% eau de parfum'    THEN 'Eau de Parfum'
      WHEN lower(btrim(nom)) LIKE '% eau de toilette'   THEN 'Eau de Toilette'
      WHEN lower(btrim(nom)) LIKE '% eau de cologne'    THEN 'Eau de Cologne'
      WHEN lower(btrim(nom)) LIKE '% extrait de parfum' THEN 'Extrait'
      WHEN lower(btrim(nom)) LIKE '% parfum'            THEN 'Parfum'
      WHEN lower(btrim(nom)) LIKE '% perfume'           THEN 'Parfum'
      WHEN lower(btrim(nom)) LIKE '% cologne'           THEN 'Eau de Cologne'
      WHEN lower(btrim(nom)) LIKE '% edp'               THEN 'Eau de Parfum'
      WHEN lower(btrim(nom)) LIKE '% edt'               THEN 'Eau de Toilette'
      WHEN lower(btrim(nom)) LIKE '% edc'               THEN 'Eau de Cologne'
      ELSE NULL
    END AS new_type
  FROM public.parfums
)
UPDATE public.parfums p
SET type_parfum = c.new_type
FROM computed c
WHERE p.id = c.id
  AND p.type_parfum IS DISTINCT FROM c.new_type;
