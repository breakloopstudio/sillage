# Sillage — Environment & Commands (v9.1)

## Environnement local (Windows)
| Variable | Valeur |
|---|---|
| ANDROID_HOME | `C:\Users\Pierre-Louis\AppData\Local\Android\Sdk` |
| ADB | `%ANDROID_HOME%\platform-tools\adb.exe` |
| Émulateur AVD | `Pixel_7_Pro` |
| PowerShell | ExecutionPolicy restreinte → utiliser `cmd /c` ou `Start-Process` |

## Commandes

### Development Build (mode complet — recommandé)
```bash
start.bat           # Mode FAST : Metro uniquement (pas de rebuild Gradle)
start.bat build     # Mode BUILD complet : Gradle + install + Metro
```
✅ Supabase, GPT-4o Vision, Camera, Haptics, Reanimated
🔄 Fast Refresh automatique après le 1er build (~3-5 min)
⚠️ Sur Windows : le script `.bat` évite les problèmes d'ExecutionPolicy PowerShell

### Expo Go (mode dégradé)
```bash
npx expo start           # QR code → Expo Go
npx expo start --web     # navigateur
```
⚠️ Modules natifs NON disponibles

### Build Release
```bash
.\build_release.bat      # Gradle assembleRelease → APK autonome
```
→ APK : `android/app/build/outputs/apk/release/app-release.apk`

### Installer sur téléphone (USB)
```bash
adb devices                # doit montrer le device
npx expo run:android       # build + installe
# ou : adb install android/app/build/outputs/apk/release/app-release.apk
```

### EAS Build (cloud)
```bash
npx eas build --platform ios
npx eas build --platform android
npx eas submit --platform ios
npx eas submit --platform android
```

### Supabase (backend)
```bash
# CLI global (npm i -g supabase) — lancer via cmd /c sur cette machine
supabase db push                          # appliquer les migrations au cloud
supabase db reset                         # reset local (Docker Desktop requis)
supabase gen types typescript --linked    # régénérer src/types/database.types.ts
supabase functions deploy <name> --no-verify-jwt   # déployer une Edge Function
supabase start                            # instance locale (Studio http://127.0.0.1:54323)
```

### TypeScript
```bash
npx tsc --noEmit     # 0 erreur attendu (global)
```

### Tests
```bash
npx jest --ci         # 902 tests, 80 suites
npm test              # watch mode
npm run test:ci       # CI mode avec couverture
npm run test:supabase # E2E backend cloud (29 checks)
```

### Lint
Pas de lint configuré (pas d'ESLint). La vérification passe par `npx tsc --noEmit`.

### i18n (traductions)
```bash
npm run i18n:extract   # scanne le code → aligne src/locales/{lang}/{ns}.json (idempotent)
npm run i18n:sync      # propage fr (source) vers les langues secondaires sans écraser l'existant
```
Toute chaîne user-facing passe par `t()` — règles complètes : `.clinerules/rules.md` §23.

## Stack
react-native 0.86.0 · expo ~57 · expo-router ~57
@supabase/supabase-js · expo-camera ~57 · expo-image ~57 · expo-splash-screen ~57
react-native-gesture-handler ~2.32 · react-native-reanimated ~4.5 · react-native-worklets 0.10
react-native-svg ^15 · react-native-pager-view ^8.0 · react-native-tab-view ^4.3 · @react-native-vector-icons/ionicons ^13
react-native-draggable-flatlist ^4.0 (modal ShelfManager ; réordonnancement en vue = chevrons ↕ ShelfCard)
@react-native-async-storage/async-storage · expo-navigation-bar ~57 · expo-system-ui ~57 · typescript ~6.0
react-hook-form ^7.81 · zod ^4.4
expo-speech-recognition ^56 · expo-audio ~57 · expo-file-system ~57 · expo-location ~57
i18next 26 · react-i18next 17 · intl-pluralrules (i18n, §23 rules ; tooling i18next-cli en dev)

## Variables d'environnement (.env, gitignoré)
| Variable | Usage |
|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | URL projet Supabase cloud |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Clé anon (client) |
| `EXPO_PUBLIC_USE_SUPABASE` | Flag migration (toujours `true`) |
| `SUPABASE_SERVICE_ROLE_KEY` | Scripts d'import/migration uniquement |
| `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` | Google Sign-In iOS |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | Google Sign-In Android (webClientId — ID token) |
| `SCRAPER_PROXY` | Optionnel — proxy résidentiel pour le scraping |

## Architecture actuelle

### Navigation
4 onglets (TopTabs swipeables) + FAB Scan central : **Catalogue | Favoris | Ma Parfumerie | Communauté**.
DockBar custom (verre dépoli, 3 états : expanded/compact/hidden). Accès profil = avatar rond en haut à droite (SearchChrome → route racine `/profile`).
Roue chromatique = route racine `/wheel` (exploration par couleur → `/search?color=<key>`, cache mémoire partagé).

### Modèle de données utilisateur
- `user_parfum` (PK: user_id + parfum_id) — statut (`to_try | tried | want | have | had`), verdict, rating, notes, shelf_ids, sotd_count, is_signature
- `possessions` (FK → user_parfum) — type (`bottle | decant | sample`), size_ml, quantity, for_sale
- `favoris` — cœur léger, orthogonal au statut (on peut aimer sans posséder)
- `shelves` — étagères custom (nom, icône, couleur, description, is_public, order)
- `shelf_items` — position + pin par étagère (RPC atomiques)
- `price_alerts` — alertes prix (target_price, initial_price)
- `parfum_votes` — votes performance (longevity/sillage/season/moment)
- `profiles` — profils publics opt-in (pseudo, bio, avatar_url, is_public)

### Backend Supabase
- **Projet cloud** : `zrifarygomoljwhdjcbh` (Europe)
- **Local** : `supabase start` (Docker) · DB `postgresql://postgres:postgres@127.0.0.1:54322/postgres`
- **Edge Functions** (Deno) : `analyze-perfume-image`, `interpret-voice-query`, `transcribe-voice`, `check-price-alerts`, `send-notification`, `send-weather-notifications`, `delete-user-account`, `share` (landing SSR)
- **Secrets** : `supabase secrets set` (OPENAI_API_KEY, CRON_SERVICE_ROLE_KEY) — jamais en dur dans config.toml
- **Migrations** : `supabase/migrations/0001→0060`

## Règles critiques

1. **Aucun fichier-route utilitaire dans `app/(tabs)/`** — expo-router auto-enregistre tout fichier du groupe comme page swipeable du TopTabs. Les redirects vivent à la racine `app/`.
2. **`supabase.rpc` ne jamais détacher** — toujours appeler en méthode ou `.bind(supabase)` (sinon « Cannot read property 'rest' of undefined »).
3. **`toNum()` obligatoire sur colonnes `numeric`** — PostgREST renvoie les `numeric` en **string** ; `typeof === 'number'` retourne toujours null.
4. **RLS partout** — toutes les tables user ont `auth.uid() = user_id`. Le catalogue `parfums` est en lecture publique, écriture admin-only.
5. **Auth optionnelle** — l'app fonctionne sans compte. Pas de redirection forcée vers `/auth/login`.
6. **i18n** — toute chaîne user-facing via `t()` (jamais de FR inline dans le nouveau code), jamais de `t()` au scope module, formatage via `formatPrice`/`formatNumber` (§23 rules).

## Pièges connus

- **numeric → string** : rating, prix, scores, targetPrice/initialPrice/lastPrice arrivent en string depuis PostgREST. Toujours `toNum()`.
- **`this`-binding RPC** : ne jamais extraire `supabase.rpc` dans une constante.
- **Realtime cleanup** : `subscribeUserTable` retourne un unsubscribe — toujours l'appeler au cleanup.
- **Expo Push (pas FCM)** : les notifications push passent par Expo Push (tokens en table `push_tokens`).
- **Images HD** : `image_url_2x` (upscale ×4) réservé à la fiche détail/lightbox. Les listes restent en 1x.
- **Concentration** : `type_parfum` dérivé du **nom officiel** (suffixe), jamais du `<title>` SEO Fragrantica.

## Docs
Expo SDK 57: https://docs.expo.dev/versions/v57.0.0/
React Native Reanimated: https://docs.swmansion.com/react-native-reanimated/
Design system « Luxe malin » : `.clinerules/design-guide.md`
Règles projet : `.clinerules/rules.md`
Référence technique : `.clinerules/reference.md`

## Données — Pipeline d'import

### Catalogue seed (~25 100 parfums, 239 marques)

Le catalogue est importé depuis un scrape Fragrantica Apify, puis nettoyé et hébergé en autonome.

```
data/raw/ (1.27 GB, non versionné) → data/clean/ (31 MB) → Postgres parfums + Storage parfum-images
```

### Scripts

Scripts organisés en `scripts/fragrantica/` (pipeline catalogue), `scripts/images/` (pipeline images) et `scripts/lib/` (helpers partagés).

| Commande | Rôle |
|---|---|
| `npm run clean-data` | Nettoie les JSON scrapés : débruite, déduplique, strip champs traçants |
| `npm run scrape-designers` | Scrape la liste complète des marques Fragrantica → `data/designers.json` |
| `npm run watch-designers` | Snapshot + diff vs run précédent → `data/watch/delta-<date>.json` |
| `npm run diff-brands` | Compare marques à delta vs BDD → file `data/watch/queue-<date>.json` |
| `npm run scrape-perfumes` | Scrape fiches parfums (mode `--format=raw` ou `--format=clean`) |
| `npm run import-fresh` | Import depuis `data/clean/` : transforme + image + WebP + upsert Postgres |
| `npm run import-supabase` | Upsert Postgres (local ou `--target=cloud`) |
| `npm run migrate-upscale` | Upscale HD ×4 (Real-ESRGAN + CUDA) → `image_url_2x` |
| `npx tsx scripts/images/purge-2x.ts` | Purge HD 2x Storage + reset `image_url_2x` (dry-run PAR DÉFAUT ; `-- --write` pour exécuter, `--limit=N` ; régénérable via `migrate-upscale`) |
| `npm run generate-notes` / `upload-notes` | Images de notes olfactives + upload Storage |

**Flux nouveau scrape** : `clean-data` → `import-fresh --target=cloud` → `migrate-upscale`.
**Flux incrémental (veille)** : `scrape-designers` → `watch-designers` → `diff-brands --target=cloud` → `scrape-perfumes` → `clean-data` → `import-fresh --target=cloud` → `migrate-upscale`.

### Authentification import

1. `SUPABASE_SERVICE_ROLE_KEY` dans `.env` (gitignoré)
2. Les scripts lisent `.env` (`EXPO_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`)
3. `migrate-upscale` nécessite le venv `scripts/images/upscale/venv`
4. **Proxy scraping (optionnel)** : `SCRAPER_PROXY` dans `.env` (format `http://[user:pass@]host:port`)

### Décisions clés

| Décision | Raison |
|---|---|
| Zéro référence à un fournisseur tiers dans les données | Indépendance totale |
| Images : 1 WebP 375×500 par parfum | Seule source dispo dans le scrape |
| Images hébergées sur Supabase Storage (bucket `parfum-images`) | Pas de dépendance CDN externe |
| `source` = `'seed'` | Distingue les données importées des données API live |
| Photos communauté supprimées | Contenu utilisateur, risque légal |

## Historique condensé

| Version | Résumé |
|---|---|
| v6.7–v6.23 | Catalogue hybride, favoris filtres, historique, BrandSheet, pager gestures, search RPC, densité, polices, fiche détail refonte, auth v2, weather, VoiceOverlay, OfflineBanner, profil, Parfumerie v2, TopTabs 4 onglets |
| v7.1–v7.4 | Catalogue éditorial + images HD, nettoyage héritage Firestore, SaveSheet unifiée, FavorisContext + cœur sur cartes, useSaveController |
| v8.0–v8.3 | Modèle unifié `user_parfum` + possessions, refonte UX 2→4 onglets, alertes prix v2, Communauté placeholder |
| v8.4–v8.7 | Profils publics + partage SSR, durcissement post-audit + typage Supabase M4, étagères « meuble » + communauté d'étagères |
| v8.8–v8.9 | DockBar refonte (compact/pill/FAB obturateur), accords olfactifs, Flacon Runner v2 (pouvoirs/missions/classement), ShelvesContext, perf optimisations |
| v8.10–v8.12 | Votes utilisateurs performance (RPC parfum_perf), audit perf (virtualisation, memory-disk), check-up architectural (37 corrections) |
| v8.13–v8.18 | Communauté « pouls éditorial » (aggrégats honnêtes, SOTD RPC, seed éditorial), pastilles §4.9, timeline, défi famille, récap « Ta semaine », streak SOTD, chip ♥n, motion |
| v8.19 | Renommage ParfumScan → Sillage (scheme, package, keys, natifs, backend) |
| v8.20–v8.21 | Flacon Runner v3 (game-feel, glissade, fièvre, rétention locale, pont catalogue, obstacles thématisés) |
| v8.22–v8.23 | Fiche détail refonte (cluster prix, hero allégé, 1 accent, RelationSection compacte), alertes prix correctifs + carte riche + notif → fiche |
| v8.24 | Traduction notes/accords 100 % + descriptions popup (pyramide 1 679 notes + 88 accords, catégories `mineral`/`abstract`, `getAccordDescription`), polish a11y/cibles/typo, robustesse dock (reset/`pointerEvents`) + barre flottante, montée couverture tests |
| v9.0 | Perf catalogue cold-start : degating rendu, projections étroites, cache disque SWR + prefetch splash, boot découplé de l'auth, carousels virtualisés, index partiel top-rated (0049) |
| v9.1 | Audit & durcissement BDD (0050→0057) : sécurité RPC (`parfum_perf` force `auth.uid()`, garde propriété shelf, `lim` plafonné), cleanup tables/index/enums morts + `possessions` hors realtime, index manquants, intégrité (`updated_at` 4 tables + CHECK `parfum_votes.value`), vue `parfum_card` (RPC catalogue allégées du tsvector/jsonb), perf serveur (`recompute_perf_strings` set-based, matviews /30min), DROP 4 colonnes mortes + scripts d'import adaptés |
| v9.2 | Longévité sur 5 crans 1:1 Fragrantica (0058) : `_perf_cranks`/`_perf_score`/`_user_cranks`/`_perf_label`/`parfum_perf`/`cast_vote`/`recompute_perf_strings` adaptés (sillage inchangé 4 crans), CHECK `parfum_votes.value` scindé + validé, reset des votes longevity/sillage + normalisation one-shot des strings, cran 1 → `'very weak'`, parsers clients alignés (`longevityLevel` 'very weak' avant 'weak'), e2e +5 checks, 0059 grant SELECT `parfum_card` (fix RPC catalogue invoker 0054) ; étagères & polish UI : réordonnancement ↕ en vue (drag retiré, ShelfManager conservé), tokens `cardShadow`/`cardBorder`/`hairline` + wrapper ombres cartes, `gridKey` sans remount thème, ombre FAB circulaire, race « Pour vous », pop scaleX des crans retiré, script `purge-2x` |
| v9.3 | Voix « identification » alignée sur le scan : Edge Function `interpret-voice-query` (gpt-4o-mini Structured Outputs, confiance forcée serveur) → `searchParfumFromScan` partagé, auto-ouverture fiche sur match confiant (score ≥ 62 + écart ≥ 10 + confiance LLM) + bannière « Ce n'est pas lui ? » (`VoiceUndoBanner`, retour résultats via bridge), voie déconnectée = recherche brute + auto-open match exact, seconde chance Whisper sur 0 résultat (audio persisté), `transcribe-voice` v2 (`gpt-4o-mini-transcribe`, prompt marques synchronisé + vocabulaire parfum), orchestration unifiée SearchChrome/`/search` (`identifyFromVoice`), durcissement (`onError` au rejet module, haptique auto-stop, MIME réel, erreurs spécifiques) + 35 tests voix |
| v9.4 | Flacon Runner détente & polish : abeille + glissade retirées (un seul geste = sauter), difficulté modérée (vitesse max 660, spawn ≥ 220 px, doubles ≤ 35 % à écart 120–200 px, goutte dès 800 pts), allègements (RunnerCombo central, milestones, bannières de phase), HUD/score/vies masqués hors jeu + overlays au-dessus du HUD (zIndex 200/300), scrim accueil, copy rafraîchie (« Saute les éclats · cueille les notes », missions « Prestige »/« Rempart », daily « éclats »/« impacts ») |
| v9.5 | Réparation reconnaissance vocale (noms propres écorchés) : `transcribe-voice` v3 (prompt instructif + 77 marques + top ~250 noms du catalogue via `scripts/voice-vocab.ts`), `interpret-voice-query` v2 (framing « transcript ASR bruité », récupération phonétique, few-shots écorchés réels, hypothèses alternatives), seconde chance gatée sur la QUALITÉ du match (`voiceNeedsSecondChance` : 0 résultat OU interprétation absente/peu confiante, hors requêtes vagues) au lieu du nombre de résultats, `pickBetterVoiceOutcome`, STT on-device enrichi (`CONTEXTUAL_STRINGS` = marques + top ~100 noms, `maxAlternatives: 4` livrées à l'interprétation), matching : alias `casamorati → Casamorati 1888` + lignées `brandsRelated` (Xerjoff ↔ Casamorati), flankers « nom (année) » ignorés en exact (`fuzzyNameBonus`), watchdog 20→35 s, échec re-transcription → repli (pas d'erreur) |
| v9.6 | Voix round 2 (cas réels : « L'Homme Idéal Parfum » ouvrait l'EDT, « Serge Lutens Écrin de Fumée » → « serge lutins écran de », « Electimuss Imperium » → « electimus imper ») : rescoring concentration (candidat « nom + concentration » ajouté, match exact d'une fiche qui ne confirme pas la concentration rétrogradé +50→+25, détection `typeFromNom` par phrase canonique la plus longue — « Eau de Parfum » ne confirme plus « Parfum »), confiance interprétation STRICTE (nom écorché non récupéré → 'low' même marque identifiée → seconde chance, few-shot « serge lutins écran de »), vocabulaire complet : 237 marques du catalogue + top 400 noms (garde budget 7000 car. → ~210 noms retenus) dans `transcribe-voice`, marques niches (Electimuss, Orto Parisi, Ex Nihilo, BDK…) dans `interpret-voice-query`, biasing client = 237 marques ASCII + 100 noms, règle concentration fin d'énoncé dans le prompt d'interprétation |
| v9.7 | Pipeline voix MULTILINGUE (objectif 87 langues du Play Store) : `transcribe-voice` v4 = modèle `gpt-transcribe` (recommandé OpenAI) avec vocabulaire en paramètre `keywords` dédié (237 marques + 400 noms, sanitize `<>`, fallback retry sans keywords sur 400) au lieu du prompt tronqué, `languages` = indices ISO 639-1 de l'appareil (jamais `language` singulier avec ce modèle, réponse JSON `{text, languages}`), prompt d'instruction court en anglais neutre en langue ; `interpret-voice-query` v3 = prompt système réécrit en anglais agnostique de la langue de l'énoncé (FR/EN/ES/IT/…), noms jamais traduits, 2 few-shots non-FR (« baccarat rouge five forty » → Baccarat Rouge 540, « agua de yo » → Acqua di Gio) ; client : `expo-localization` (~57.0.1) + `src/utils/device-locale.ts` (`deviceSttLang` BCP-47, `deviceVoiceLanguages` max 3), `useVoiceSearch` ne force plus `fr-FR` (repli `en-US` unique si locale non supportée par le moteur STT), `transcribeVoice` envoie les langues appareil (3ᵉ paramètre optionnel, 4 call sites inchangés) ; fallback 400 retire keywords ET languages (retry « bare ») |
| v9.8 | Audit global & durcissement + permissions just-in-time + transparence scan : audit 8 subagents + 3 reviewers (`docs/audit-2026-08-04.md`, 0 critique, 1 élevé corrigé) → migration `0060` (`REVOKE` PUBLIC/anon sur `recompute_perf_strings`, CHECK + troncature `runner_scores.skin`, `export_user_data` v3.1.0 complète RGPD), Edge Functions durcies (cron météo paginé `.range()`+`.order()`, `delete-user-account` fail-closed sans repli `iat`, `send-notification` valide title/body/data, `check-price-alerts` POST-only), scripts sécurisés (`purge-2x` dry-run PAR DÉFAUT + `--write`, `import-fresh` checkpoint guardé `!dryRun` + `--refresh`, `readEnvVar` strip quotes, paginations `.order()`), polish client (hitSlop SearchChrome ≥ 44 px, `ScanLoading` Reduced Motion, 1 seul haptique SOTD `success`, `DockBar` via `alpha()`, `.gitignore` `.env.*`, `.env.example` complet) ; **primers de permission** : `PermissionPrimer` + `usePermissionPrimer`/`usePushPrimer` (`permission-primers.ts`, 4 clés camera/mic/location/push, popup explicatif une seule fois au moment de l'intention, flag AsyncStorage `@sillage/primer-*`) — jamais de prompt système à froid, push proposé à la 1ʳᵉ alerte prix (`AlertPriceToggle`) ou au toggle Settings, enregistrement au lancement gaté par le réglage `pushNotifs` + purge des tokens au retrait ; **transparence scan** : `scan-display.ts` (chip héros « Vérifié visuellement / Reconnu à la forme / Correspondance probable », ligne « Lu : / Hypothèse : »), `ScanClarify` guidé par `failureReason` (blur/glare/label_unreadable/bad_framing/not_a_perfume), lecture incertaine + aucun candidat ≥ 50 → saisie assistée pré-remplie ; refus micro définitif → bouton « Réglages » (`VoiceOverlay`) — 816 tests / 74 suites |
| v9.9 | Scan « fiche express » : héros des résultats actionnable sans quitter l'écran — cœur `FavButton lg` sur l'image, CTA primary « Voir la fiche », cloche alerte prix (`PriceAlertSheet` canonique rendue à la racine de `ScanResults` + push primer §22, redirect login si déconnecté, masquée sans prix) ; jest-setup durci (animations d'entrée chainables, `withSequence`, mock `NativeEventEmitter` avec `__esModule` — bug latent FlatList en test) + 8 tests `ScanResults` |
| v9.10 | Scan **mode collection** : toggle « Un flacon / Ma collection » sur l'idle. Une photo d'étagère → Edge Function mode `collection` (schema `bottles[]` + `estimatedCount`, confiance forcée par flacon = texte lu + marque + nom, escalade si 0 détection, re-ranking visuel PLAFONNÉ à 3 flacons en parallèle) → matching catalogue par détection (`searchParfumFromScan`, seuil `_scanScore ≥ 50`) → état `collection-results` (`ScanCollectionResults`) : liste multi-select, VÉRIFIÉS cochés par défaut (les « Correspondance probable » à valider), flacons déjà en collection marqués et exclus, ajout en lot statut `have` (`Promise.allSettled` → écran confirmation). Pas d'entrée `user_scans` par flacon (1 photo ≠ N scans). Helpers purs `collection-scan.ts` + `scanMode.ts` |
| v9.11 | **Roue chromatique** (exploration par couleur) : route racine `/wheel` — anneau SVG (`react-native-svg`) de 12 couleurs-ancres curatées (9 teintes sur l'anneau + 3 neutres au centre noir/blanc/gris, marron traité comme teinte), snap vers l'ancre la plus proche (`hueToAnchor`) ; chaque couleur mappe vers le vocabulaire olfactif du catalogue (accords GIN `main_accords` && + notes FTS `search_vector` @@ + affinité saisonnière, mapping curaté client `chromatic-wheel.ts` — itération éditoriale sans migration) ; RPC `chroma_parfums` (`0061` : BitmapOr sur 2 index GIN existants, scoring sur candidats uniquement, tri intensité chromatique → popularité ; `0062` : branches bornées par popularité AVANT scoring — fix timeout E2E sur notes fréquentes musc/jasmin/rose) ; `getParfumsByColor` + cache mémoire + dédup in-flight PARTAGÉS entre `/wheel` et `/search?color=` (la sélection posée préchauffe la liste, rendu instantané) ; SVG monté après la transition d'ouverture (320 ms, anti drop de frames) + prefetch des 12 premières images ; labels/taglines via i18next (`chroma.*`). **+ util `relative-date.ts`** (`formatRelativeShort` : « à l'instant / il y a N min / N h / N j », absolu Intl au-delà de 7 j) utilisé par la vue Alertes de Favoris (`lastChecked`) |
| v9.12 | Internationalisation (i18n) complète — préparation Play Store/App Store : infrastructure `i18next` 26 + `react-i18next` 17 + `expo-localization` (FR = langue source, `src/locales/fr/common.json` unique, clés typées `src/types/i18next.d.ts`, tooling `i18next-cli` extract/sync idempotent, détection préférence AsyncStorage → locale appareil) ; extraction de TOUTES les chaînes user-facing : 4 onglets, fiche détail, sheets, scan/voix, wardrobe, profil, historique, auth, profils publics, étagères, perfumer, admin, pages légales, Flacon Runner (missions/défi quotidien/skins/pickups), hooks (météo/voix/auth/catalogue/scan), composants (OfflineBanner, ErrorBoundary, ParfumCard a11y, PublicProfileCard, BrandSheet, SaveButton), couche services (erreurs scan/voix/compte/recherche + canaux Android de notification), message de partage ; getters `i18next.t` pour les tables de labels au scope module (§23), timeouts Edge Functions refactorés par code marker (`SCAN_TIMEOUT`/`VOICE_TIMEOUT`) pour préserver les détections d'erreur `.includes()` ; exceptions conservées : noms de marques/parfums, données catalogue (notes/accords/familles), mots-clés de matching — 902 tests / 80 suites |
