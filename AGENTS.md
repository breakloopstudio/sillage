# Sillage — Environment & Commands (v9.0)

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
npx jest --ci         # 618 tests, 59 suites
npm test              # watch mode
npm run test:ci       # CI mode avec couverture
npm run test:supabase # E2E backend cloud (24 checks)
```

### Lint
Pas de lint configuré (pas d'ESLint). La vérification passe par `npx tsc --noEmit`.

## Stack
react-native 0.86.0 · expo ~57 · expo-router ~57
@supabase/supabase-js · expo-camera ~57 · expo-image ~57 · expo-splash-screen ~57
react-native-gesture-handler ~2.32 · react-native-reanimated ~4.5 · react-native-worklets 0.10
react-native-svg ^15 · react-native-pager-view ^8.0 · react-native-tab-view ^4.3 · @react-native-vector-icons/ionicons ^13
react-native-draggable-flatlist ^4.0 (réordonnancement des étagères, JS pur)
@react-native-async-storage/async-storage · expo-navigation-bar ~57 · expo-system-ui ~57 · typescript ~6.0
react-hook-form ^7.81 · zod ^4.4
expo-speech-recognition ^56 · expo-audio ~57 · expo-file-system ~57 · expo-location ~57

## Variables d'environnement (.env, gitignoré)
| Variable | Usage |
|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | URL projet Supabase cloud |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Clé anon (client) |
| `EXPO_PUBLIC_USE_SUPABASE` | Flag migration (toujours `true`) |
| `SUPABASE_SERVICE_ROLE_KEY` | Scripts d'import/migration uniquement |
| `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` | Google Sign-In iOS |
| `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` | Google Sign-In Android |
| `SCRAPER_PROXY` | Optionnel — proxy résidentiel pour le scraping |

## Architecture actuelle

### Navigation
4 onglets (TopTabs swipeables) + FAB Scan central : **Catalogue | Favoris | Ma Parfumerie | Communauté**.
DockBar custom (verre dépoli, 3 états : expanded/compact/hidden). Accès profil = avatar rond en haut à droite (SearchChrome → route racine `/profile`).

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
- **Edge Functions** (Deno) : `analyze-perfume-image`, `transcribe-voice`, `check-price-alerts`, `send-notification`, `send-weather-notifications`, `delete-user-account`, `share` (landing SSR)
- **Secrets** : `supabase secrets set` (OPENAI_API_KEY, CRON_SERVICE_ROLE_KEY) — jamais en dur dans config.toml
- **Migrations** : `supabase/migrations/0001→0048`

## Règles critiques

1. **Aucun fichier-route utilitaire dans `app/(tabs)/`** — expo-router auto-enregistre tout fichier du groupe comme page swipeable du TopTabs. Les redirects vivent à la racine `app/`.
2. **`supabase.rpc` ne jamais détacher** — toujours appeler en méthode ou `.bind(supabase)` (sinon « Cannot read property 'rest' of undefined »).
3. **`toNum()` obligatoire sur colonnes `numeric`** — PostgREST renvoie les `numeric` en **string** ; `typeof === 'number'` retourne toujours null.
4. **RLS partout** — toutes les tables user ont `auth.uid() = user_id`. Le catalogue `parfums` est en lecture publique, écriture admin-only.
5. **Auth optionnelle** — l'app fonctionne sans compte. Pas de redirection forcée vers `/auth/login`.

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
| Zéro référence Fragella dans les données | Indépendance totale |
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
