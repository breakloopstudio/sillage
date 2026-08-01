# Plan d'audit — Recherche Sillage (v6.16)

Légende : **P0** = bug correctitude / fail silencieux · **P1** = perf / coût · **P2** = robustesse · **P3** = cleanup.

---

## P0-1 · Les erreurs Firestore sont déguisées en « aucun résultat »
**Fichiers :** `firestore.ts:370-373`, `firestore.ts:305-309`, `firestore.ts:530-534`, `useScanPipeline.ts:48-60`, `useCatalog.ts:52-57`, `search.tsx:237-243`, `index.tsx:191-194`

- `searchParfumsCached` retourne `[]` sur toute erreur (réseau, index manquant, permission). Le `try/catch` dans `searchParfumFromScan` est du code mort.
- `useScanPipeline` dispatch `SCAN_NO_RESULT` au lieu de `SCAN_ERROR` → contredit la note v6.16.
- `useCatalog` + `search.tsx` affichent « Aucun résultat » pour une erreur réseau.
- Voix (`index.tsx`) : catch → phase `empty` au lieu de `error`.

**Fix :** Typed `SearchError` throwé par `searchParfumsCached` + état `error` dans `useCatalog` + UI error state.

## P0-2 · Mutation des objets du cache par `_scanScore`
**Fichier :** `firestore.ts:541-566`

`searchParfumFromScan` mute en place les objets Parfum du cache LRU via `p as Parfum & {_scanScore}`.

**Fix :** `return { ...p, _scanScore: bonus }`.

## P0-3 · Docs invisibles si `reviewCount`/`popularityScore` absents
**Fichiers :** `import-firestore.ts:449-455`, `firestore.ts:278, 301, 337, 496`

Firestore `orderBy` exclut les docs sans le champ ou avec `null`. `reviewCount` et `ratingCount` n'ont **pas** de fallback `?? 0` à l'import.

**Fix :** Script d'audit `scripts/audit-search-fields.ts` + backfill `?? 0` dans `import-firestore.ts`.

## P1-4 · Prefix cache mono-mot inutilisable + pas de fallback
**Fichier :** `firestore.ts:252-269`

- Garde `rawTokens.length >= 2` bloque le prefix cache pour les requêtes mono-mot (pattern dominant).
- Re-score < 5 → retourne sans tenter Firestore/fuzzy (rappel inférieur).
- Première clé trouvée, pas la meilleure (choisir max `results.length`).

**Fix :** Supprimer garde externe, choisir meilleur préfixe, fallback Firestore si < 5.

## P1-5 · Multi-token: 10 × 300 requêtes Firestore
**Fichier :** `firestore.ts:207, 299-303`

**Fix :** `slice(0, 4)`, `limit(150)`, tri par longueur décroissante.

## P1-6 · Rate limiter: faux vide + budget pour cache hits
**Fichier :** `useCatalog.ts:31-45`

**Fix :** Peek cache avant push, conserver résultats précédents sur limite, ne pas compter les requêtes périmées.

## P2-7 · Timestamp vs Date incohérent
**Fichier :** `firestore.ts:283-291, 314-318` (spread brut) vs `:343` (docToParfum)

**Fix :** Passer le chemin primaire par `docToParfum`.

## P2-8 · Stop words dans les trigrammes fuzzy
**Fichiers :** `firestore.ts:77-86, 336`

**Fix :** `filter(STOP_WORDS)` + cap mots.

## P2-9 · Cache: pas d'invalidation + entries() sans purge
**Fichier :** `firestore.ts:64-72` + absence `clearSearchCache()`

**Fix :** Exporter `clearSearchCache()`, appeler depuis mutations admin, purger dans `entries()`.

## P3-10 · Token mort `${m} ${n}` (espace)
**Fichier :** `normalize.ts:47`

**Fix :** Supprimer la ligne.

## P3-11 · Code mort: `onParfumsByMarque` + `LRUCache.has()`
**Fichiers :** `firestore.ts:147-154`, `firestore.ts:54-62`

**Fix :** Supprimer.

## P3-12 · Mots 1 char dans searchKeywords
**Fichier :** `normalize.ts:32-41`

**Fix :** `if (word.length < 2 || STOP_WORDS.has(word)) return;`

## P3-13 · Divers
| # | Fichier:ligne | Problème | Fix |
|---|---|---|---|
| a | `firestore.ts:447,452` | Log « getSimilarParfums » dans `getPersonalizedSuggestions` | Renommer |
| b | `firestore.ts:288` | Degenerate composite `Math.max` | Doc/comment |
| c | `useCatalog.ts:26` vs `firestore.ts:196` | Threshold 2 vs 3 | Documenter |
| d | `firestore.ts:329` | Fuzzy append sans merge score | Accepter/doc |
| e | `firestore.ts:194` | Pas de dedup in-flight | In-flight Map |

---

## Ordre d'implémentation

| Étape | Items | Effort |
|---|---|---|
| 1 | P0-3 (audit données + backfill) | ½ j |
| 2 | P0-1 (erreurs typées + états UI) + P0-2 (spread copy) | 1 j |
| 3 | P1-4 (prefix cache) | ½ j |
| 4 | P1-5 (cap tokens) + P1-6 (rate limiter) | ½ j |
| 5 | P2-7, P2-8, P2-9 | ½ j |
| 6 | P3-10→P3-13 (hygiène) | ¼ j |
| 7 | Tests | ½ j |
