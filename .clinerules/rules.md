# ParfumScan React — Règles du projet

## §1 — Vue d'ensemble

Projet React Native (Expo 57, RN 0.86), ~30 écrans, design « Luxe malin ». Architecture file-based routing via Expo Router. **Backend : Supabase** (Postgres + Auth + Storage + Realtime + Edge Functions) depuis la migration de juillet 2026 (cf. `MIGRATION_SUPABASE.md`). Le code Firebase a été retiré.

---

## §2 — Architecture

```
app/
├── _layout.tsx               # Root : ThemeProvider → GestureHandlerRootView → AuthProvider → AuthGuard → ErrorBoundary
├── index.tsx                 # Splash → redirection tabs
├── (tabs)/
│   ├── _layout.tsx           # TopTabs (4 onglets swipeables) + DockBar custom + SearchChrome + NavigationChromeProvider
│   ├── index.tsx             # Catalogue (hôte CatalogPage)
│   ├── selection.tsx         # Sélection segmentée Favoris/Carnet (param ?segment=carnet)
│   ├── collection.tsx        # Parfumerie
│   └── profile.tsx           # Profil (identité, stats, SOTD, navigation rapide, déconnexion)
├── auth/
│   ├── login.tsx             # Connexion email + Google
│   └── register.tsx          # Inscription
├── catalog/[id].tsx          # Fiche détail v7 (DetailHero, CollapsingHeader, StickyBottomBar, pyramide v7, prix unique, signature nez, « Quand le porter », « Dans le même esprit »)
├── wardrobe/[parfumId].tsx   # Fiche personnelle (notes, rating, SOTD, étagères)
├── perfumer/[name].tsx       # Créations d'un nez (signature dorée de la fiche détail, grille densité partagée)
├── settings.tsx              # Paramètres (notifications, devise, apparence, soutien, légal, compte)
├── scan.tsx                  # Scan (slide_from_bottom)
├── search.tsx                # Recherche (fade)
├── history.tsx               # Historique des scans (route racine, poussée depuis Profil)
├── scentlist.tsx             # Redirection /scentlist → /(tabs)/selection?segment=carnet (deep links ; JAMAIS dans (tabs)/ — cf. §5)
├── legal.tsx                 # Mentions légales
├── privacy.tsx               # Politique de confidentialité
├── privacy-center.tsx        # Centre de confidentialité
├── delete-account.tsx        # Suppression de compte
└── admin.tsx                 # Administration

src/
├── services/     (14)        # supabase, catalog, user-data, wardrobe, scentlist, account, openai-vision, voice-search, weather, storage, push, haptics, theme-storage, catalog-bridge
├── services/impl/            # Implémentations Supabase de chaque service (catalog, user-data, wardrobe, scentlist, account, push, storage, openai-vision, voice-search) + search-shared.ts (LRU/dedup/SearchError) + sql-utils.ts (toDate/today). Chaque service public = `export * from './impl/<x>.supabase'`.
├── hooks/        (16)        # useAuth, useCatalog, useDensityPreference, useFavoris, useNetwork, useProfileStats, useScanPipeline, useScanReducer, useScans, useScentList, useShelves, useSotd, useVoicePreference, useVoiceSearch, useWardrobe, useWeather
├── contexts/     (1)         # AuthContext (ThemeContext est dans src/theme/)
├── components/   (14)        # ParfumCard, Button, PriceDisplay, SectionHeader, EmptyState, OfflineBanner, AppLoader, ErrorBoundary, AlertPriceToggle, NoteDetailPopup, ActionSheet, ImageViewerPopup, FilterSheet, AuthGate
├── features/
│   ├── auth/                 # Helpers écrans auth
│   ├── catalog/              # CatalogPage, OlfactoryPyramid v7, PyramidStage, NoteCloud, DetailHero, CollapsingHeader, StickyBottomBar, BrandCapsules, BrandSheet, CatalogRow, FamilyAmbianceCards
│   ├── favorites/            # FavoritesContent (onglet Sélection, segment Favoris)
│   ├── navigation/ (2)       # DockBar (custom tabBar TopTabs — l'avatar utilisateur vit ici, pas de ProfileAvatar) + NavigationChromeContext
│   ├── profile/              # Contenu onglet Profil
│   ├── runner/               # Flacon Runner (easter egg, cf. §17)
│   ├── scan/                 # ScanScreen + sous-états (+ useScanPipeline dans hooks/)
│   ├── scentlist/            # ScentListContent, ScentCard, ScentListEntry, TrySheet (onglet Sélection, segment Carnet)
│   ├── search/     (2)       # SearchChrome (barre recherche + voix, masquée sur /profile) + VoiceOverlay
│   └── wardrobe/             # WardrobeAddSheet, WardrobeCard, WardrobeGrid, WardrobeQuickSheet, SOTDCard, SOTDPicker, FilterBar, StarRating, ShelfManager
├── theme/        (2)         # theme.ts (Theme interface + light/dark), ThemeContext.tsx
├── config/       (2)         # env, index (firebase.config supprimé — migration Supabase)
├── models/       (8)         # Parfum (+searchText, +imageUrl2x), WardrobeItem (+Shelf, SotdEntry), UserFavori, UserScan, UserScentItem (+ScentVerdict), UserCollectionItem, ScanResult, index
└── utils/        (12)        # error-translator (translateSupabaseError), translate-note, note-descriptions, normalize, ownership, season, favori-filters, contrast, weather-codes, weather-scoring, olfactory-families, alpha

supabase/                     # Backend Supabase (versionné)
├── migrations/   (0001→0019) # extensions, types, tables, index (trgm/FTS), RLS+publication, fonctions SQL (RPC search_parfums, seasonal_parfums, family_overviews…), cron pg_cron, image_url_2x
├── functions/                # Edge Functions Deno : analyze-perfume-image, transcribe-voice, check-price-alerts, send-notification, send-weather-notifications, delete-user-account + _shared/
├── config.toml               # Config projet (secrets via `env(...)`, JAMAIS en dur)
└── smoke-test.sql            # Tests SQL rejouables
```

> **Note v6.7** : Parfumerie (ex « Garde-robe ») — icône `flask`. Favoris en grille (filtres multi-facettes via FilterSheet, tri, ActionSheet pour le menu contextuel). Historique groupé par période (Aujourd'hui/Hier/Cette semaine...), scans sauvegardés dans tous les états (no-result, error). `ActionSheet` bottom sheet custom. Dénormalisation `bestPrice`/`referencePrice`/`annee` dans UserFavori/UserScan. Back gesture edge-pan (40px strip gauche) sur fiche détail catalog. SOTDPicker ancré au-dessus de la carte (position absolute, sans Reanimated). `ImageViewerPopup` : tap sur la photo du parfum → popup plein écran. Recherche en grille 2 colonnes (`compact`). Images en `contain` (pas de crop). Parfums similaires triés par popularité + shuffle journalier. Recherche par préfixes (scoring `startsWith` + bonus `reviewCount`).

---

## §3 — Langage

- TypeScript strict, pas de `any` (sauf exceptions justifiées par un commentaire)
- Composants = fonctions React, pas de classes (sauf `ErrorBoundary`)

---

## §4 — Style

- `StyleSheet.create()` autorisé uniquement pour les styles **statiques** (layout pur, pas de couleurs thème). Pour les styles thématiques, utiliser `getStyles(t: Theme)` + `useMemo`.
- Pattern obligatoire : `getStyles(t: Theme)` (fonction pure hors composant) → `useMemo(() => getStyles(theme), [theme])` dans le composant
- 0 `fontWeight` — tout en `fontFamily` (Inter_400Regular, Inter_600SemiBold, etc.)
- Pas de couleurs hardcodées hors du thème (exceptions documentées dans le design guide §2.3 : `#FFFFFF`, `#1F1A2E`, overlays)
- Toujours `useTheme()` dans les composants — jamais `import { theme } from '.../theme/theme'`

---

## §5 — Navigation

- Expo Router file-based, **TopTabs + custom tabBar** (DockBar en verre dépoli)
- Navigation : swipe horizontal natif entre les 4 onglets (TopTabs = material-top-tabs vendored, react-native-tab-view + pager-view 8.0.2)
- IA : 4 onglets — Catalogue | Sélection (Favoris/Carnet segmentés) | Parfumerie | Profil — + FAB central Scan
- **Règle d'or (v6.23)** : aucun fichier-route utilitaire (redirect, stub, shim) dans `app/(tabs)/` — expo-router auto-enregistre tout fichier du groupe comme écran du TopTabs, donc comme page swipeable du pager. Les redirects vivent à la racine `app/` (Stack, non swipeable)
- Scan/Recherche : routes racine (`slide_from_bottom` / `fade`), pas des onglets
- Historique : route racine, poussée depuis Profil
- Perfumer : route racine, poussée depuis la signature nez de la fiche détail (slide_from_right)
- `NavigationChromeContext` pour le hide-on-scroll du dock — chaque écran actif écrit `scrollY.value` (UI thread via `useAnimatedScrollHandler`), le layout réagit sans conflit de gestes
- Chrome partagé : `SearchChrome` (barre de recherche + voix) dans le layout des tabs, masqué sur l'onglet Profil
- Swipe-back : natif (React Navigation), pas de geste custom → **0 conflit de swipe**
- `router.push()` pour navigation avant, `router.back()` / `router.dismissTo()` pour retour
- `setPendingParfum()` / `consumePendingParfum()` pour le pont inter-écrans scan → détail

---

## §6 — Authentification

- **Supabase Auth** (email + Google Sign-In via `signInWithIdToken`)
- Auth optionnelle — l'app fonctionne sans compte, aucune redirection forcée vers `/auth/login`
- `useAuth` retourne un `AppUser` (`uid` = UUID Supabase, `email`, `displayName`, `photoURL`, `providers`) — type commun aux écrans
- `AuthContext` fournit `user: AppUser | null`, `authReady`, `isAuthenticated`, `isAdmin`, `login`, `register`, `loginWithGoogle`, `logout`
- `isAdmin` = présence dans la table `admins` (`auth.uid()`)
- `AuthGuard` bloque uniquement l'accès aux routes `/auth/*` si déjà connecté (`isAuthenticated && inAuth → /(tabs)`)
- Sécurité données : **Row Level Security** sur toutes les tables user (`auth.uid() = user_id`) ; catalogue `parfums` en lecture publique
- Les écrans protégés (admin, actions favoris/wardrobe) ont leurs propres vérifications inline

---

## §7 — Scan

- Flux : Idle → Camera → Burst (3 photos) → GPT-4o Vision (Edge Function `analyze-perfume-image`) → `searchParfumFromScan()` (wrapper scan-spécifique avec bonus nom/marque structurés) → Résultats
- `searchParfumFromScan` score : +50 nom exact, +25 nom partiel, +15 marque exacte, +8 marque partielle (écrase le scoring catalogue pour garantir le match exact en tête)
- `ScanResults` affiche les résultats dans l'ordre de pertinence (pas de tri par prix)
- Import galerie : même pipeline, sans permission caméra
- États : `idle | camera | scanning | results | no-result | clarify | error`
- Reducer géré par `useScanReducer`

---

## §8 — Catalogue

- Recherche via **RPC Postgres `search_parfums`** (tsvector + pg_trgm, ~25K parfums), cache LRU client (200 entrées, 10 min), debounce 150ms, seuil 2 caractères
- **Taxonomie 6 familles** (`src/utils/olfactory-families.ts`) : regroupe ~46 valeurs anglaises de `famille_olfactive` en familles FR (boisée, florale, hespéridée, ambrée, gourmande, aromatique). `FamilyAmbianceCards` data-driven, recherche en mode famille (`/search?family=<key>`)
- Rangées éditoriales : « Parfaits pour {saison} » (RPC `seasonal_parfums`), « Les mieux notés » (`getTopRatedParfums`), « Pour vous » (personnalisé) / populaires (fallback)
- Fonctions catalogue : `getParfumCount`, `getTopRatedParfums`, `getParfumsByFamily`, `getFamilyOverview`, `getSeasonalParfums`, `getPersonalizedSuggestions`, `getSimilarParfums`
- Tri : pertinence / prix croissant / prix décroissant
- Dédoublonnage automatique par `marque+nom` normalisé (côté RPC + sécurité client)
- **Images HD** : `image_url_2x` (upscale ×4, fiche détail/lightbox uniquement) — cf. §16b

---

## §9 — Design System

> **Guide détaillé** : `.clinerules/design-guide.md` — mapping token→contexte, hiérarchie typo, patterns UI, spec animations, dark mode, checklist conformité.
> En cas de conflit, le guide de design prime sur cette section.

### Palette « Luxe malin »

| Token | Light | Dark | Usage |
|---|---|---|---|
| `background` | `#F8F6F2` | `#0B0712` | Fond principal |
| `surface` | `#FFFFFF` | `#15101E` | Carte, modale |
| `surface2` | `#F3F1ED` | `#1D1728` | Fond secondaire |
| `border` | `#E8E4DE` | `#2A2238` | Bordures |
| `text` | `#1A1520` | `#EDE8F5` | Texte principal |
| `textMuted` | `#6E6963` | `#988EA8` | Texte secondaire |
| `primary` | `#6C3ED9` | `#8B6CF6` | Violet |
| `secondary` | `#C8945A` | `#D4A960` | Doré |
| `deal` | `#0D9488` | `#2DD4BF` | Teal (bonne affaire) |
| `overpriced` | `#E04444` | `#EF4444` | Rouge (trop cher) |
| `fair` | `#D97706` | `#F59E0B` | Orange (prix correct) |

**Polices** : Playfair Display (display) + Inter (body). Pas de 3e police.

### Dark Mode

- **Architecture** : `src/theme/ThemeContext.tsx` — `ThemeProvider` + `useTheme()` hook
- **Double palette** : `src/theme/theme.ts` exporte `lightTheme` et `darkTheme` (objets complets identiques, seuls `colors` et `shadow` diffèrent)
- **Persistance** : `src/services/theme-storage.ts` — AsyncStorage, clé `@parfumscan/theme`
- **3 modes** : `system` (défaut, suit `Appearance`/`useColorScheme()`), `light`, `dark`
- **Pattern composant** : `getStyles(t: Theme)` (fonction pure hors composant) + `const s = useMemo(() => getStyles(theme), [theme])` dans le composant
- **Ombres** : remplacées par des bordures subtiles en dark mode (`borderWidth` + `borderColor` rgba)
- **StatusBar** : gérée automatiquement par `ThemeProvider` (texte clair en dark, foncé en light)
- **Toggle UI** : segmented control 3 segments (Clair / Système / Sombre) dans `app/settings.tsx`
- **Règle** : pas de couleurs hardcodées hors du thème — tout passe par `t.colors.xxx`

---

## §10 — Conventions React

- Toujours `useTheme()` dans les composants — jamais `import { theme } from '.../theme/theme'`
- `export const theme = lightTheme` dans `theme.ts` est un alias de rétrocompatibilité — à ne plus utiliser dans le nouveau code
- Composants = fonctions nommées (pas de `export default function()`, pas de classes sauf `ErrorBoundary`)
- Hooks personnalisés préfixés par `use`
- `useMemo` pour les styles dynamiques quand le thème est impliqué
- Pas de `StyleSheet.create()` au niveau module pour les styles dépendant du thème
- `StyleSheet.hairlineWidth` est autorisé (valeur statique)
- `useCallback` obligatoire sur tous les handlers passés en props à des enfants (évite les re-renders cascade)
- Appels async Supabase protégés par `try/catch` + `console.warn` (couche service) ou `.catch(() => {})` (écrans)

---

## §11 — Backend Supabase

- Auth, Postgres (RLS), Storage, Realtime (`postgres_changes`), Edge Functions (Deno)
- `src/services/supabase.ts` — client `@supabase/supabase-js` (AsyncStorage, `react-native-url-polyfill`) + `subscribeUserTable()` (adaptateur realtime : fetch initial + deltas INSERT/UPDATE/DELETE → même contrat qu'`onSnapshot`) + `isSupabaseReady()`
- Chaque service public (`catalog.ts`, `user-data.ts`, …) = `export * from './impl/<x>.supabase'` ; l'implémentation vit dans `src/services/impl/`
- Schéma/RLS/fonctions SQL dans `supabase/migrations/` ; Edge Functions dans `supabase/functions/`
- Secrets via `supabase secrets set` (Vault) — **jamais** en dur dans `config.toml` (références `env(...)` uniquement)

---

## §12 — Catalogue de données

- Catalogue 100% autonome : ~25 100 parfums dans la table Postgres `parfums` (migrés depuis Firestore via `scripts/export-firestore.ts` + `scripts/import-supabase.ts`)
- Recherche plein texte : colonnes générées `search_text` (index GIN `pg_trgm`) + `search_vector` (tsvector, config `french_unaccent`)
- `src/utils/normalize.ts` — `normalize()`, `normalizeId()` (utilisés par le dédoublonnage et le rescoring scan)
- RLS : `parfums` en lecture publique, écriture réservée aux admins (table `admins`)
- Images hébergées sur **Supabase Storage** (bucket public `parfum-images`) : `parfums/{parfumId}_{ts}_{name}` ; migration via `scripts/migrate-storage.ts`
- `source: 'seed'` — distingue les données importées des données saisies manuellement (`'manual'`)
- Pas d'API externe pour les données de catalogue

---

## §13 — Tests

- Suite de tests automatisée : Jest 29 + `jest-expo` + mock `@supabase/supabase-js` (dans `jest-setup.js`)
- 209 tests, 18 suites : `npm test` (watch) / `npm run test:ci` (CI + couverture)
- Les fichiers de test sont dans `__tests__/` (hors `src/` et `app/`)
- Test E2E backend cloud : `npm run test:supabase` (`scripts/test-supabase-e2e.ts`, 24 checks : recherche, auth, RLS, realtime, RPC, CASCADE RGPD)
- Tests manuels sur émulateur Android (`Pixel_7_Pro`) et device physique
- Build debug : `npx expo run:android`
- Build release : `.\build_release.bat`

---

## §14 — Recherche vocale

- **Architecture dual-mode** : STT on-device (`expo-speech-recognition`) + fallback OpenAI Whisper-1 (Edge Function `transcribe-voice`)
- **Trigger** : long-press 400ms sur la barre de recherche (TabPager) ou bouton micro (écran `/search`)
- **Enregistrement parallèle** : `expo-audio` enregistre en continu pendant que le STT tourne — l'audio brut est disponible pour le fallback
- **VoiceOverlay** : panneau overlay 5 phases (listening/searching/results/empty/error), intégré dans la page Catalogue
- **Contextual strings** : 60+ marques de parfum fournies à `expo-speech-recognition` pour améliorer la précision
- **Permission** : `NSMicrophoneUsageDescription` (iOS) + `RECORD_AUDIO` (Android) via le plugin `expo-speech-recognition`
- **Dépendances** : `expo-speech-recognition`, `expo-audio`, `expo-file-system`

---

## §15 — Météo & Scoring

- **API** : Open-Meteo (gratuit, sans clé, `GET /v1/forecast`)
- **Localisation** : `expo-location` — GPS uniquement (`getLastKnownPositionAsync` rapide → `getCurrentPositionAsync` fallback), pas de fallback ville (supprimé v6.18)
- **Cache** : 30 min en mémoire, keyé par `lat.toFixed(2),lon.toFixed(2)`, déduplication des appels parallèles
- **Scoring client** : `weather-scoring.ts` — 12 familles olfactives × 31 codes WMO × saisons × jour/nuit × signature × sotdCount
- **Widget** : bannière unifiée météo + SOTD (`SOTDCard`, v6.20 — `WeatherWidget.tsx` supprimé) : segment météo (icône + température), segment SOTD (image + nom·marque + badge score)
- **Tri météo** : option "Météo" dans la `FilterBar`, tri par `scoreWardrobeItemForWeather()` décroissant
- **SOTD suggéré** : `SOTDPicker` pré-trié par score météo, badge `85%` coloré (deal/fair/textMuted)
- **Notification push** : Edge Function `send-weather-notifications` (cron pg_cron 7h Paris via double schedule UTC + idempotence) → fetch Open-Meteo → scoring serveur → Expo Push
- **Persistance coordonnées** : `saveWeatherCoords(uid, lat, lon)` écrit dans `user_settings`
- **Toggle settings** : "Suggestions météo" → `weatherNotifs` bool
- **Dépendance** : `expo-location`

---

## §16 — Pipeline d'images (WebP + background removal)

- **WebP migration** : `scripts/migrate-webp.ts` — batch conversion JPEG/PNG → WebP (`sharp` quality 82), upload Storage, 8 parallèles, resumable
- **Background removal** : `scripts/migrate-bgremoval.ts` — `@imgly/background-removal-node` (MODNet), sous-processus Node.js isolé dans `scripts/bgremoval/`
- **Migration storage Supabase** : `scripts/migrate-storage.ts` — Firebase Storage → bucket `parfum-images`, 8 parallèles, resumable, réécriture `image_url`
- **Upscale ×4 (HD)** : `scripts/migrate-upscale.ts` — workers Python persistants (Real-ESRGAN + CUDA, venv `scripts/upscale/`), génère `primary_2x.webp` + colonne `image_url_2x`. ~0,5 img/s, resumable. La fiche détail/lightbox fondent de la 1x vers la 2x ; les listes restent en 1x
- **Commandes** : `npm run migrate-webp`, `npm run migrate-bg`, `npm run migrate-storage`, `npm run migrate-upscale`
- **Dépendances dev** : `sharp`, `tsx`

---

## §17 — Flacon Runner (easter egg)

Mini-jeu endless runner accessible depuis Settings (5 taps sur numéro de version). Architecture entièrement sur le UI thread (Reanimated).

### Architecture des fichiers
```
src/features/runner/
├── useRunnerLoop.ts      # Game loop (useFrameCallback) : physique, collisions, spawn, scoring
├── RunnerGame.tsx         # Intégration : gestes, cycle de vie, score chase, sons, shake, milestones, skins
├── RunnerBottle.tsx       # Flacon joueur : squash/stretch aérien, landing spring, death flash
├── RunnerBackground.tsx   # 2 couches parallaxe seamless (wrapping périodique)
├── RunnerGround.tsx       # Sol défilant avec marques
├── RunnerObstacles.tsx    # Pool de 8 cristaux (4 types + volant), rendus via opacity toggling
├── RunnerPickups.tsx      # Pool de 4 badges réduction (altitudes variables)
├── RunnerSpeedLines.tsx   # Traits de vitesse horizontaux (opacité liée à la vitesse)
├── runner-sounds.ts       # 4 WAV synthétisés (jump, pickup, death, record) via expo-audio
├── runner-types.ts        # Types, constantes, helpers AABB, altitudes
└── runner-storage.ts      # High score + skins persistés AsyncStorage
```

### Règles
- **Zéro `setState` en boucle** — toute la logique temps réel est en SharedValues + `useAnimatedStyle`
- **Pools fixes** — pas de mount/unmount pendant le jeu (pré-alloué en SharedValues)
- **Collisions** : `checkAABB()` (worklet), hitbox obstacle = `width - 4`, bottle = `width-8 × height-6`
- **Score chase** : JS-side rAF lissant les sauts de score (bonus pickups jusqu'à +800)
- **Sons** : générés en base64 inline (zéro asset binaire), via `expo-audio` `useAudioPlayer`
- **Persistance** : high score + skins dans AsyncStorage, clé `@parfumscan/runner-*`
- **Ouverture** : 5 taps sur le numéro de version dans Settings, minuterie 2s de reset
- **Skins déblocables** : 500→Ambre, 1500→Frost, 3000→Noir, auto-équipés sur game over

---

## §18 — Environnement

- Windows 11, PowerShell 5.1 (ExecutionPolicy restreinte → `cmd /c` pour npm/supabase)
- ANDROID_HOME = `C:\Users\Pierre-Louis\AppData\Local\Android\Sdk`
- Émulateur AVD : `Pixel_7_Pro`
- Variables d'environnement dans `.env` (`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_USE_SUPABASE`, `SUPABASE_SERVICE_ROLE_KEY`, clés Google) — **jamais committées**
- Secrets Edge Functions via `supabase secrets set` (`OPENAI_API_KEY`, `CRON_SERVICE_ROLE_KEY`)
- Supabase CLI : `npm i -g supabase` ; instance locale `supabase start` (Docker Desktop requis), Studio http://127.0.0.1:54323

---

## §19 — Contraintes verrouillées

- ✅ JetBrains Mono retiré — Inter uniquement, `tabular-nums` pour les prix
- ✅ Pas de gamification dans le profil
- ✅ Scan = FAB (pas un onglet)
- ✅ Pas de swipe/drag — menu contextuel "Déplacer vers…"
- ✅ Auth optionnelle (app fonctionne sans login)
- ✅ EUR uniquement en V1
- ✅ 3 boutons distincts sur fiche détail
- ✅ Onboarding supprimé (fichier effacé, index → tabs directement)
- ✅ 0 `fontWeight` — tout en `fontFamily`
- ✅ `allowFontScaling={false}` sur badges/chips, `maxFontSizeMultiplier={1.3}` sur descriptions
- ✅ Cibles tactiles ≥ 44 px (ou `hitSlop` explicite)
- ✅ Appels async protégés (`try/catch` services, `.catch()` écrans)
- ✅ `useCallback` systématique sur handlers passés aux enfants

---

## §20 — Règles cross-platform

- iOS : `Platform.OS === 'ios'` pour les comportements spécifiques (KeyboardAvoidingView padding)
- Android : `Platform.OS === 'android'` + `UIManager.setLayoutAnimationEnabledExperimental(true)`
- SafeAreaView de `react-native-safe-area-context` (pas celui de React Native)
- `expo-camera` pour la caméra (pas `react-native-camera`)
- `expo-image` pour les images (pas `react-native-fast-image`)
