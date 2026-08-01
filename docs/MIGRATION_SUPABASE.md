# Plan de migration Firebase → Supabase — Sillage

**Statut** : migration **terminée** (25/07/2026). Phases 0→4 complètes : schéma **12 migrations** (0001→0012), données (24 627 parfums + images), couche services 100 % Supabase (deps + code Firebase retirés), 6 Edge Functions + 3 crons déployés, **E2E cloud 24/24 stable** (3 runs consécutifs), tsc 0 (src/app), 217 tests unitaires, app fonctionnelle sur émulateur (`EXPO_PUBLIC_USE_SUPABASE=true`). Config dashboard effectuée (Google provider 2 client IDs + confirmation email off) + **projet expo.dev lié** (`eas init`, push débloqués au prochain build).
**Contexte** : app **pas en production** → migration « fresh start », aucune donnée utilisateur à préserver. Seuls le catalogue (~25 100 parfums) et les images sont migrés.

**Projet cloud** : `zrifarygomoljwhdjcbh` (Europe) — URL + clé anon dans `.env`. Data API activée, auto-expose désactivée (GRANTs explicites dans 0003), auto-RLS activée.
**Phase 1 cloud validée** (24/07/2026) : migrations poussées (`supabase db push`), 24 627 parfums importés via API service_role (16 s, 0 erreur), recherche cloud OK (54–330 ms). **Images migrées** : 24 447 WebP Firebase Storage → bucket `parfum-images` (public), `image_url` réécrites (12,7 min via `npm run migrate-storage`, reprenable ; 3 échecs = CDN Fragella mort, déjà cassées avant migration).

**Bugs trouvés** : (1) wrappers `language sql` inlinés → colonnes générées rejetées, fix plpgsql ; (2) `array_to_string` STABLE → wrapper `immutable_array_to_string` ; (3) `SET LOCAL` interdit en fonction STABLE → seuils trgm via `ALTER DATABASE` ; (4) `gin_trgm_ops` non résolu sur l'hébergé → qualification `extensions.` ; (5) service_role sans GRANTs (projet sans auto-expose) → migration 0007 ; (6) revue Edge Functions : jointure PostgREST sans FK → 2 requêtes + jointure JS ; `last_price` non mis à jour → re-notifications ; rows snake_case au scoring météo camelCase ; claim `auth_time` inexistant dans les JWT Supabase → `amr[].timestamp`/`iat` ; `includes('service_role')` sur JWT base64 → comparaison exacte ; `cron.timezone` verrouillé → double schedule UTC + idempotence ; secret `SUPABASE_*` refusé par la CLI → `CRON_SERVICE_ROLE_KEY` (migration 0009) ; (7) `search_parfums` cassé *à l'exécution* par `SELECT DISTINCT w … ORDER BY length(w)` (sous-requête tokens) + `DISTINCT ON` (deduped) → 0011 (dedup `row_number`) + 0012 (tokens `GROUP BY`).
**Leçon** : `create or replace function` ne valide le corps SQL qu'à l'*exécution* → un `db push` peut être « vert » avec une fonction cassée ; **toujours appeler les RPC en local** (`supabase start`) avant de pousser. Et le flaky apparent du test E2E venait d'un **filtre console `❌` rendu invisible par l'encodage Windows cp1252** → forcer `[Console]::OutputEncoding = UTF8` pour lire les bilans.

---

## 0. Décisions actées

| Sujet | Décision | Justification |
|---|---|---|
| Push notifications | **Expo Push Notifications** (`expo-notifications`) | Maintenabilité long terme : zéro SDK Firebase natif, zéro OAuth service-account dans les Edge Functions (un simple POST JSON vers `exp.host`), purge des tokens morts via les receipts standard. FCM n'avait d'intérêt que pour préserver des tokens existants — sans production, ce critère tombe. |
| Auth | **Supabase Auth** (email/mdp + Google `signInWithIdToken`) | Pas de comptes à migrer → **pas** de table `user_id_map`, **pas** d'import de hash Firebase, **pas** de fonction `ensure-user-mapping`. Plan B en annexe §10 si jamais requis un jour. |
| Couche service | `supabase.ts` (noyau) + modules domaine **mêmes signatures** | Un fichier unique serait ~1500 lignes et violerait rules.md §2. Les hooks ne changent pas d'imports. |
| Recherche | RPC `search_parfums()` : `tsvector` (unaccent) + `pg_trgm` | pg_trgm fait nativement ce que les trigrammes `~` + Jaccard font à la main. |
| IDs parfums | `id text` (slugs seed conservés) | Toutes les références (wardrobe, favoris, storage, scans) restent intactes. |
| Cutover | Big-bang par version d'app | Pas de double backend à synchroniser. |
| Sous-collections Firestore | Aplaties en tables avec `user_id uuid FK auth.users` | Modèle relationnel naturel ; suppression RGPD = `ON DELETE CASCADE`. |

**Limites connues acceptées** : (1) Firestore a une persistance offline native, Supabase non — l'app a déjà `OfflineBanner` + caches partout ; (2) `postgres_changes` envoie des événements de mutation, pas des snapshots — l'adaptateur realtime (§4.2) gère ça.

---

## 1. Cartographie Firestore → Postgres

| Firestore | Postgres | Notes |
|---|---|---|
| `parfums/{id}` | `parfums` (PK `id text`) | `searchKeywords` **abandonné** → `search_text` (trgm) + `search_vector` (tsvector) générés |
| `admins/{uid}` | `admins(user_id uuid PK)` | |
| `rateLimits/{date}/users/{uid}` | `rate_limits(user_id, day)` PK composée | Server-only (RLS sans policy) |
| `users/{uid}/favoris/{parfumId}` | `favoris` PK `(user_id, parfum_id)` | doc id déterministe → contrainte unique + `upsert on conflict` (parité `setDoc(merge)`) |
| `users/{uid}/scans/{autoId}` | `scans` PK `id uuid` | |
| `users/{uid}/collection/{parfumId}` | `collection` PK `(user_id, parfum_id)` | |
| `users/{uid}/scentlist/{parfumId}` | `scentlist` PK `(user_id, parfum_id)` | enums `scent_status`, `scent_verdict` |
| `users/{uid}/wardrobe/{parfumId}` | `wardrobe` PK `(user_id, parfum_id)` | enum `ownership_type`, `shelf_ids uuid[]` |
| `users/{uid}/shelves/{autoId}` | `shelves` PK `id uuid` | colonne `"order"` (quotée, mot réservé) |
| `users/{uid}/sotd/{YYYY-MM-DD}` | `sotd` PK `(user_id, day date)` | |
| `users/{uid}/priceAlerts/{parfumId}` | `price_alerts` PK `(user_id, parfum_id)` | |
| `users/{uid}/settings/preferences` | `user_settings` PK `(user_id)` | |
| `users/{uid}/fcmTokens/{autoId}` | `push_tokens` PK `id uuid`, `token unique` | tokens **Expo** (`ExponentPushToken[...]`) |
| `users/{uid}/usage/{runId}` | `notification_runs` PK `(user_id, run_id)` | idempotence cron, server-only |

**Types imbriqués** : `offers`, `main_accords_percentage`, `season_ranking`, `occasion_ranking`, `season_scores` → `jsonb` (typés côté client). `notes_*`, `main_accords`, `perfumers`, `general_notes`, `similar_ids`, `all_notes` → `text[]`.

**Enums** : `ownership_type`, `scent_status`, `scent_verdict`, `scan_status`, `parfum_source` — miroirs des unions TS des modèles.

---

## 2. Schéma SQL — fichiers livrés

```
supabase/migrations/
├── 0001_extensions.sql   # pg_trgm, unaccent, pg_cron, pg_net, pgcrypto
│                         # immutable_unaccent() + norm_txt() (miroir de normalize.ts)
│                         # config FTS french_unaccent (unaccent + simple, sans stemming — parité app)
├── 0002_types.sql        # 5 enums + table search_stop_words (38 mots, seed = STOP_WORDS de normalize.ts)
├── 0003_tables.sql       # 15 tables (parfums + 14 user/système), colonnes générées search_text/search_vector
│                         # + GRANTs explicites (projet créé SANS « auto-expose new tables »)
├── 0004_indexes.sql      # GIN trgm + GIN FTS + GIN arrays + btree tri (cf. §3)
├── 0005_rls.sql          # RLS complète (cf. §3) + publication realtime (6 tables)
└── 0006_functions.sql    # search_parfums, similar_parfums, personalized_suggestions,
                          # check_and_increment_quota, set_sotd, move_* (4), delete_shelf, export_user_data
```

Après application : `npx supabase gen types typescript --local > src/models/database.types.ts` — devient la source de vérité des types DB ; `src/models/*.interface.ts` restent les modèles domaine (mappers §4.3). `FirestoreDate` (duck-typing Timestamp) devient obsolète : `timestamptz` arrive en string ISO → `new Date(...)`.

---

## 3. Index & RLS (traduction de firestore.indexes.json + firestore.rules)

### Index

| Index Firestore | Index Postgres |
|---|---|
| `searchKeywords CONTAINS + reviewCount DESC` | `gin (search_text gin_trgm_ops)` + `gin (search_vector)` + `btree (review_count desc)` |
| `mainAccords CONTAINS + popularityScore DESC` | `gin (main_accords)` + `btree (popularity_score desc nulls last)` |
| `perfumers CONTAINS + popularityScore DESC` | `gin (perfumers)` |
| — (getPersonalizedSuggestions `in`) | `btree (famille_olfactive)` |
| — (tri snapshots) | `favoris(user_id, added_at desc)`, `scans(user_id, scanned_at desc)`, `scentlist(user_id, status)`, `push_tokens(token)` |

### RLS (parité exacte des règles)

| Règle | Policy |
|---|---|
| `parfums` read `if true` | `for select using (true)` — anon + authenticated |
| `parfums` write admin | `for all using (exists (select 1 from admins where user_id = auth.uid()))` |
| `admins` read auth / no write | `for select to authenticated using (true)`, aucune policy write |
| 10 tables user | `for all using (auth.uid() = user_id) with check (auth.uid() = user_id)` |
| `rate_limits`, `notification_runs` | RLS activée, **zéro policy** (= `if false` — service role only) |

**Realtime** : publication `supabase_realtime` sur les 6 tables écoutées par `onSnapshot` (`favoris`, `scans`, `collection`, `scentlist`, `wardrobe`, `shelves`). Replica identity par défaut suffisante (DELETE envoie la PK composite). Les policies SELECT filtrent le flux par utilisateur.

---

## 4. Couche service

### 4.1 Structure

```
src/services/
├── supabase.ts        # NOYAU : client, adaptateur realtime, mappers, erreurs
├── catalog.ts         # ex firestore.ts — mêmes exports (onParfums, getParfumById,
│                      #   searchParfumsCached, searchParfumFromScan, getSimilarParfums,
│                      #   getPopularParfums, getPersonalizedSuggestions, getParfumsByPerfumer,
│                      #   peekSearchCache, clearSearchCache, SearchError...)
├── user-data.ts       # signatures inchangées (upsert on conflict = setDoc merge)
├── wardrobe.ts        # signatures inchangées (setSotd → RPC transactionnelle)
├── scentlist.ts       # signatures inchangées
├── account.ts         # httpsCallable → supabase.functions.invoke
├── push.ts            # ex fcm.ts — expo-notifications, même surface (requestPermission,
│                      #   startFcmRegistration → startPushRegistration, channels Android)
├── storage.ts         # supabase.storage.from('parfum-images')
├── openai-vision.ts   # invoke('analyze-perfume-image'), timeout 90 s conservé
├── voice-search.ts    # invoke('transcribe-voice')
└── firebase.ts        # SUPPRIMÉ
```

Init : `createClient(url, anonKey, { auth: { storage: AsyncStorage, persistSession: true, autoRefreshToken: true } })` + `react-native-url-polyfill`. Config dans `src/config/env.ts` (`SUPABASE_URL`, `SUPABASE_ANON_KEY`).

### 4.2 Adaptateur realtime (remplacement `onSnapshot`)

```ts
function subscribeUserTable<T>(opts: {
  table: string; userId: string;
  order?: { column: string; ascending?: boolean };
  mapRow: (row: unknown) => T;        // snake_case → modèle TS
  sort?: (a: T, b: T) => number;      // tri final (ex: scentlist toTry→tried)
  cb: (items: T[]) => void;
}): () => void
```

1. `SELECT … WHERE user_id=eq ORDER BY` → émission initiale (parité snapshot initial).
2. `supabase.channel(...).on('postgres_changes', { event:'*', schema:'public', table, filter:'user_id=eq.<uuid>' }, applyDelta).subscribe()`.
3. `applyDelta` : INSERT → ajout si absent ; UPDATE → remplacement par PK ; DELETE → retrait. Ré-émission d'une copie triée à chaque delta.
4. Cleanup : `removeChannel` → retourne l'unsubscribe, comme `onSnapshot`.
5. `supabase.realtime.setAuth(token)` au login et au refresh de session (sinon RLS refuse le canal).
6. Re-subscribe au retour foreground (AppState) — websocket coupée en background mobile.

### 4.3 Mappers

`rowToParfum`, `rowToWardrobeItem`, `rowToShelf`, etc. — remplacent `docToParfum`/`docToWardrobeItem`. `timestamptz` → `new Date(string)`. `season_scores`/`offers` jsonb → cast typé.

### 4.4 Batches Firestore → transactions Postgres

| Actuel (`writeBatch`) | Cible |
|---|---|
| `moveToCollection` / `moveFavori` / `moveToScentList` | RPC `move_to_collection` / `move_favori` / `move_to_scentlist` (atomique — mieux que Firestore) |
| `moveScentToWardrobe` (3 appels) | RPC `move_scent_to_wardrobe` |
| `setSotd` (set + `FieldValue.increment`) | RPC `set_sotd` (upsert sotd + `sotd_count + 1` en une transaction) |
| `deleteShelf` (delete + cascade shelfIds) | RPC `delete_shelf` (`array_remove`) |

### 4.5 AuthContext / useAuth

- Type `AppUser { uid: string; email: string | null; displayName: string | null; photoURL: string | null }` — `uid` = UUID Supabase → tous les call sites (`user.uid`) compilent sans changement.
- `register/login` → `supabase.auth.signUp` / `signInWithPassword`.
- `loginWithGoogle` : même package `@react-native-google-signin/google-signin` → `supabase.auth.signInWithIdToken({ provider: 'google', token: idToken })` (flow RN officiel).
- `isAdmin` → `select 1 from admins where user_id = auth.uid()`.
- Réauth (delete-account) → `supabase.auth.reauthenticate()`.
- Erreurs : `translateSupabaseError()` ajouté à `error-translator.ts` (codes PostgREST `PGRST*`, `23505`, `42501`, messages gotrue → FR).

---

## 5. Recherche catalogue : `array-contains` → `tsvector` + `pg_trgm`

### 5.1 Traduction des couches (reference.md §7)

| Couche actuelle | Postgres |
|---|---|
| Tokens normalisés + 38 stop words | `norm_txt()` (miroir SQL de `normalize()`) + table `search_stop_words` |
| Index mots/préfixes/trigrammes `searchKeywords` | `search_text` généré (GIN trgm) + `search_vector` généré (GIN FTS, config `french_unaccent` sans stemming) |
| Requête mono/multi-token `array-contains` | `search_text %> token` (word-similarity trgm, ≤ 4 tokens, nested-loop index per token) |
| `matchScore` = Σ token.len/bestKw.len | `Σ word_similarity(token, search_text)` — même échelle 0..1/token |
| `exactMatch` +10 (multi-token, query complète) | `+10` si `search_text like '%'||nq||'%'` et ≥ 2 tokens |
| `popBonus` = log(max(review,rating,pop)+1)/2 | `ln(greatest(...)+1)/2` — formule identique |
| Fuzzy Jaccard > 0.25 si < 5 résultats | `similarity(search_text, nq) > 0.25` — pg_trgm **est** du Jaccard trigramme |
| Tri pertinence + tiebreak pop, top 50 | `order by score desc, pop desc limit 50` |
| Dédoublonnage marque+nom normalisé | `distinct on (norm_txt(marque), norm_txt(nom))` |
| LRU + prefix cache client | **inchangé** (wrappe la Promise, source agnostique) |
| `searchParfumFromScan` (+50/+25/+15/+8) | **100 % inchangé** — rescoring JS pur au-dessus de `searchParfumsCached` |

### 5.2 RPC livrées (0006)

- `search_parfums(q text, max_results int default 50) returns setof parfums` — stable, grants anon+authenticated.
- `similar_parfums(accords text[], exclude_id text, lim int default 6)` — intersection `main_accords & accords` (cardinality), `&&` via GIN, top 40 puis shuffle journalier déterministe (`setseed(hashtext(current_date))`) — remplace le Lehmer RNG.
- `personalized_suggestions(lim int default 16)` — family/brand scores calculés en SQL sur favoris+scans (1 round-trip au lieu de 3 requêtes), exclusion des vus, `image_url not null`.

`getParfumsByPerfumer` → PostgREST direct (`perfumers.cs.{name}` + order) côté client, pas de RPC.

**Gain attendu** : fini les ~600 docs candidats transférés puis scorés en JS — l'RPC retourne 50 lignes scorées. Tuning Phase 1 : `explain analyze` sur données réelles, ajustement seuils (`word_similarity_threshold = 0.3`, `similarity_threshold = 0.25`).

---

## 6. Les 7 Cloud Functions → Edge Functions (Deno)

Layout : `supabase/functions/<name>/index.ts` + `supabase/functions/_shared/`. Secrets : `supabase secrets set OPENAI_API_KEY=... EXPO_ACCESS_TOKEN=...` (token Expo optionnel mais recommandé).

| # | Actuel | Edge Function | Changements clés |
|---|---|---|---|
| 1 | `analyzePerfumeImage` | `analyze-perfume-image` | Prompts GPT-4o + retry `detail:high` copiés tels quels ; `npm:openai` sous Deno ; quota → RPC `check_and_increment_quota('scan', 30)` (UPDATE conditionnel atomique — remplace la transaction Firestore) ; wall-clock 150 s > 120 s actuel |
| 2 | `transcribeVoice` | `transcribe-voice` | Whisper + prompt 37 marques conservé ; quota `('voice', 60)` ; limite 10 Mo conservée |
| 3 | `checkPriceAlerts` (cron 6 h) | `check-price-alerts` + pg_cron | **Simplification majeure** : 1 requête `price_alerts ⋈ parfums` (fini pagination 500 + `getAll` par 30) ; `evaluatePriceDrop` porté ; idempotence `insert … on conflict do nothing` sur `notification_runs` ; envoi Expo Push (batch 100/requête) ; purge tokens `DeviceNotRegistered` |
| 4 | `sendNotification` | `send-notification` | Check admin via `admins` ; tokens depuis `push_tokens` (user ciblé ou broadcast paginé) |
| 5 | `sendWeatherNotifications` (cron 7 h Paris) | `send-weather-notifications` + pg_cron | Éligibles = 1 SELECT sur `user_settings` ; scoring météo porté quasi tel quel (`weather-scoring.ts` est quasi pur) ; `alter database postgres set cron.timezone = 'Europe/Paris'` pour gérer le DST |
| 6 | `deleteUserAccount` | `delete-user-account` | Vérif `auth_time` < 300 s du JWT ; `supabase.auth.admin.deleteUser(uid)` → **CASCADE** sur les 12 tables user (remplace `recursiveDelete`) |
| 7 | `exportUserData` | `export-user-data` | Enveloppe fine autour de la RPC SQL `export_user_data()` (1 requête `jsonb_build_object` + `jsonb_agg` par table) ; même shape JSON qu'aujourd'hui pour `shareAccountData` |

**Envoi push** : `POST https://exp.host/--/api/v2/push/send` (array de messages, ≤ 100). Receipts via `POST .../getReceipts` → `DeviceNotRegistered` → delete `push_tokens`. Channels Android (`weather_suggestions`, `price_alerts`) créés côté client par `expo-notifications` (parité `createNotificationChannels`).

**Cron** (0006 ou migration 0007 à l'implémentation) :
```sql
select cron.schedule('price-alerts-6h', '0 */6 * * *', $$ select net.http_post(url := '<fn>/check-price-alerts', headers := jsonb_build_object('Authorization','Bearer '||(select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key'))); $$);
select cron.schedule('weather-7h', '0 7 * * *', $$ … $$);  -- cron.timezone = 'Europe/Paris'
```

---

## 7. Auth (fresh start)

- Supabase Auth email/mdp + Google. Aucune donnée de compte à migrer.
- Pré-remplir `admins` avec l'UUID Supabase du compte admin (seed manuel post-création).
- Ancien projet Firebase : suppression pure et simple une fois l'app migrée (plus de FCM à conserver).

---

## 8. Migration des données (~25K parfums + images)

### 8.1 `scripts/export-firestore.ts` (firebase-admin, pattern `service-account.json` existant)

- `parfums` paginé 1000 → `data/migration/parfums.ndjson` (Timestamps → ISO). **Jette** `searchKeywords` (remplacé).
- `admins` → référence seulement (réassignation manuelle).
- Collections user : **non exportées** (fresh start).
- Reprenable (checkpoint par doc id) + dry-run avec compteurs.

### 8.2 `scripts/import-supabase.ts` (client `pg` direct, service role)

1. Transform NDJSON : camelCase → snake_case, ISO → `timestamptz`, objets → `jsonb`, tableaux → `text[]`.
2. `COPY parfums FROM …` — 25K lignes en secondes.
3. Vérification : `count(*)` vs export, échantillon 50 docs comparés champ à champ.

### 8.3 `scripts/migrate-storage.ts` (pattern `migrate-webp.ts` : 8 parallèles, reprenable)

- Download Firebase Storage `parfums/{id}/primary.webp` → upload bucket Supabase `parfum-images` (public, même arborescence) → `update parfums set image_url = <url>` en batch.
- Politiques bucket : lecture publique, écriture service role (upload admin) + authenticated admin (uploadParfumImage).

### 8.4 Smoke tests post-import

`search_parfums('chanel')`, `search_parfums('chanell')` (typo), `search_parfums('jean paul gaultier le male')` (multi-token), `search_parfums('l''idéal')` (accents), `similar_parfums(...)`, login Google E2E, scan GPT-4o E2E.

---

## 9. Phasage & tests

| Phase | Contenu | Gate |
|---|---|---|
| 0 | `supabase init`, migrations 0001→0006 en local, `gen types` | `supabase db reset` propre |
| 1 | Export/import catalogue + storage | 25 100 lignes ; RPC recherche < 300 ms |
| 2 | `supabase.ts` + modules domaine ; mock supabase-js in-memory pour Jest | 227 tests verts (seule la couche mock change), `tsc --noEmit` 0 erreur |
| 3 | 7 Edge Functions + cron + `expo-notifications` client | Scan, Whisper, push, export RGPD, delete OK en staging |
| 4 | Durcissement : re-subscribe foreground, EXPLAIN recherche, tests pgTAP optionnels | Parcours complet device physique |
| 5 | Release + décommission Firebase (projet + deps natives) | — |

**Tests** : la suite actuelle mock `@react-native-firebase/*` — le mock sera réécrit pour `@supabase/supabase-js` (même philosophie in-memory). Signatures identiques → les 227 tests ne changent qu'à la couche mock. Cas SQL à couvrir (pgTAP ou script) : « chanel », « chanell », multi-tokens, accentués, stop words (« eau de »), dédup marque+nom.

**Risques résiduels** : (1) reconnexion realtime mobile (mitigé §4.2-6) ; (2) comportement hors-ligne dégradé vs Firestore (tester en mode avion — caches existants) ; (3) DST cron (résolu via `cron.timezone`) ; (4) `word_similarity` seuils à tuner sur données réelles (Phase 1/4).

---

## 10. Annexe — Plan B auth (si des comptes à préserver un jour)

Réactivation de la stratégie initiale : table `user_id_map(firebase_uid text PK, supabase_uid uuid unique, email, created_at, migrated_at)` ; pré-chargement via `firebase auth:export` ; Google = `signInWithIdToken` (auto-création + mapping par email via Edge Function `ensure-user-mapping`) ; email/mdp = import hash scrypt (spike) ou reset forcé ; script d'import réécrivant `user_id` via la map ; alternative de secours : Firebase Auth en provider tiers Supabase (`auth.jwt()->>'sub'` dans les policies) — fige la dépendance Firebase, déconseillé en cible finale.

---

## Prochaines étapes (à la demande)

1. Phase 0 : `supabase init` + vérification des migrations en local.
2. Phase 2 : implémentation de `src/services/supabase.ts` + modules domaine.
3. Phase 3 : écriture des 7 Edge Functions.
