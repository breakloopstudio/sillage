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
│   ├── _layout.tsx           # TopTabs (4 onglets swipeables) + DockBar custom (FAB Scan central) + SearchChrome (barre recherche + avatar profil rond en haut à droite) + NavigationChromeProvider
│   ├── index.tsx             # Catalogue (hôte CatalogPage)
│   ├── favoris.tsx           # Favoris (tous les ❤️, section « Tes alertes », pills Tous/À traiter/Alertes, long-press FavoriSheet, prix visibles)
│   ├── collection.tsx        # Ma Parfumerie (user_parfum uniquement, pills statut + filtre ♥, grille ParfumCard prix masqué + badge 🔔, long-press StatuerSheet)
│   └── communaute.tsx        # Communauté (vitrine publique : top aimés, tendances, collections, SOTD, recherche pseudo + « Nez que tu suis » si connecté)
├── auth/
│   ├── login.tsx             # Connexion email + Google
│   └── register.tsx          # Inscription
├── catalog/[id].tsx          # Fiche unifiée v8.1 (DetailHero + section « Ma relation » via RelationSection, section « La communauté » via CommunityVerdicts, CollapsingHeader, StickyBottomBar, pyramide, prix, signature nez, « Quand le porter », « Dans le même esprit »)
├── wardrobe/[parfumId].tsx   # Redirect vers /catalog/[parfumId] (fiche unifiée v8.1)
├── perfumer/[name].tsx       # Créations d'un nez (signature dorée de la fiche détail, grille densité partagée)
├── brand/[name].tsx          # Catalogue d'une maison (chip « La maison » de la fiche détail ; tri cyclique + filtre famille + densité partagée)
├── settings.tsx              # Paramètres (notifications, devise, apparence, soutien, légal, compte)
├── scan.tsx                  # Scan (slide_from_bottom)
├── search.tsx                # Recherche (fade)
├── history.tsx               # Historique des scans (route racine, poussée depuis Profil)
├── runner.tsx                # Flacon Runner (easter egg, slide_from_bottom, route racine)
├── profile.tsx               # Profil (route racine, poussée depuis l'avatar en haut à droite dans SearchChrome — identité, stats, SOTD, navigation, déconnexion)
├── scentlist.tsx             # Redirection /scentlist → /(tabs)/collection (deep links ; JAMAIS dans (tabs)/ — cf. §5)
├── u/[pseudo].tsx            # Profil public d'un membre (lecture seule, sans auth, bouton Suivre si connecté, cible du deep link parfumscan://u/<pseudo>)
├── legal.tsx                 # Mentions légales
├── privacy.tsx               # Politique de confidentialité
├── privacy-center.tsx        # Centre de confidentialité
├── delete-account.tsx        # Suppression de compte
└── admin.tsx                 # Administration

src/
├── services/     (18)        # supabase, catalog, user-data, user-parfum, possessions, profile, community, account, openai-vision, voice-search, weather, storage, push, haptics, theme-storage, catalog-bridge, runner (leaderboard Flacon Runner), perf-votes (votes performance : RPC parfum_perf/cast_vote)
├── services/impl/            # Implémentations Supabase de chaque service (catalog, user-data, user-parfum, possessions, account, push, storage, openai-vision, voice-search) + search-shared.ts (LRU/dedup/SearchError) + sql-utils.ts (toDate/today). Chaque service public = `export * from './impl/<x>.supabase'`.
├── hooks/        (22)        # useAuth, useCatalog, useCommunityHighlights, useDensityPreference, useNetwork, usePriceAlerts, useMyProfile, usePublicProfile, useProfileStats, useScanPipeline, useScanReducer, useScans, useUserParfum, usePossessions, useFavorisViewPreference (vue Favoris/Alertes persistée), useShelfItems (ordre+pin par étagère, temps réel), useParfumerieViewPreference (vue Collection/Étagères persistée), useSotd, useVoicePreference, useVoiceSearch, useWeather, usePerfVotes (votes performance : fetch + vote optimiste + auto-réparation au focus)
├── contexts/     (5)         # AuthContext, FavorisContext, UserParfumContext (source de vérité user_parfum temps réel), PriceAlertsContext (alertes prix temps réel), ShelvesContext (étagères temps réel — remplace useShelves) — ThemeContext est dans src/theme/
├── components/   (24)        # ParfumCard (badges statut/rating/🔔 optionnels, hidePrice, onLongPress), Button, PriceDisplay, SectionHeader, EmptyState, OfflineBanner, AppLoader, ErrorBoundary, AlertPriceToggle, NoteDetailPopup, ActionSheet, ImageViewerPopup, FilterSheet, AuthGate, FavButton, StatuerSheet (long-press Parfumerie : statut + étagères + pin), FavoriSheet (long-press Favoris), PriceAlertSheet (alerte prix canonique), PublicProfileCard (profil public opt-in, mode embedded), AddToShelfSheet (ajout direct à une étagère), PublishShelfGateSheet (gate profil public inline), InspireShelfSheet (copie en lot « M'inspirer »), InfoPopup (popup centrée d'information), VotePickerSheet (sélecteur de vote : options + vote courant + retirer)
├── features/
│   ├── auth/                 # Helpers écrans auth
│   ├── catalog/              # CatalogPage, OlfactoryPyramid v7, PyramidStage, NoteCloud, DetailHero (cœur favori), CollapsingHeader, StickyBottomBar (prix + SaveButton + CTA), SaveSheet (3 chips statut + verdict + possessions), SaveButton, useSaveController (statut/verdict/rating/notes/étagères/signature), RelationSection (section « Ma relation » de la fiche unifiée), CommunityVerdicts (section « La communauté » + sheet profils), BrandCapsules, BrandSheet, CatalogRow, FamilyAmbianceCards, AccordProfile (profil d'accords : barres animées + aphorisme), PerformanceProfile (Tenue & sillage : crans animés + bouton vote 👍), SeasonProfile (Quand le porter : colonnes saisons + moment Jour/Soir + bouton vote 👍)
│   ├── navigation/ (2)       # DockBar (custom tabBar TopTabs : 4 onglets + FAB Scan central) + NavigationChromeContext
│   ├── runner/               # Flacon Runner v2 (pouvoirs/vies/missions/classement, cf. §17) : RunnerGame, useRunnerLoop, RunnerBottle, RunnerBackground, RunnerGround, RunnerObstacles, RunnerPickups, RunnerSpeedLines, RunnerHud, RunnerParticles, runner-sounds, runner-missions, runner-types, runner-storage
│   ├── scan/                 # ScanScreen + sous-états (+ useScanPipeline dans hooks/)
│   ├── scentlist/            # TrySheet (éditeur « Notes détaillées » de la fiche unifiée)
│   ├── search/     (2)       # SearchChrome (barre recherche + voix) + VoiceOverlay
│   └── wardrobe/             # SOTDCard, SOTDPicker, StarRating, ShelfManager (DraggableFlatList), ShelfCard (meuble : rayon teinté, tri ↕, badge globe), BottleThumb (flacon nu, long-press)
├── theme/        (2)         # theme.ts (Theme interface + light/dark), ThemeContext.tsx
├── config/       (3)         # env, index, legal (firebase.config supprimé — migration Supabase)
├── models/       (8)         # Parfum (+searchText, +imageUrl2x), UserParfum (+UserParfumStatus, ScentVerdict, Possession, PossessionType, Shelf (+description/isPublic), ShelfItem, SotdEntry), UserPriceAlert, MyProfile/PublicProfile/PublicCollectionItem/PublicShelf/PublicShelfItem, UserFavori, UserScan, ScanResult, index
├── utils/        (25)        # error-translator (translateSupabaseError), translate-note, note-descriptions, normalize, season, favori-filters, contrast, format-price, suggest, weather-codes, weather-scoring, olfactory-families, status-chips (3 chips statut), verdicts, price-alerts (suggestion cible + variation), share (URLs de partage + validation pseudo), alpha (paliers §2.5, dark ÷2), brand-color, shelf-grouping (vues système + inspireMissing), price-tier, accord-profile (buildAccords), perf-fusion (fusion Fragrantica bornée + votes users), performance-profile (crans 1-4 + ticks), season-profile (profil saisons + occasions + moment), parfum-labels (typeParfumLabel, genderLabel, communityRatingLabel, concentrationFromName, resolveConcentration — labels canoniques + concentration fiable depuis le nom)
└── types/        (1)         # database.types.ts — types Database générés (`supabase gen types typescript --linked`) ; type le client Supabase + payloads d'écriture (M4)

supabase/                     # Backend Supabase (versionné)
├── migrations/   (0001→0045) # extensions, types, tables (dont shelf_items position+pin, parfum_votes votes performance 0042-0044), index, RLS+publication, RPC (search_parfums, reorder_shelves (0038), public_shelf/public_shelf_items (0039), add_to_shelf/remove_from_shelf/pin_shelf_item/reorder_shelf_items (0040), cast_vote/parfum_perf (0042-0044)…), cron pg_cron, stats, image_url_2x, backfill type_parfum (0045)
├── functions/                # Edge Functions Deno : analyze-perfume-image, transcribe-voice, check-price-alerts, send-notification, send-weather-notifications, delete-user-account, share (landing SSR de partage) + _shared/
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
- IA : 4 onglets — Catalogue | Favoris | Ma Parfumerie | Communauté (placeholder) — + FAB central Scan. Accès profil = avatar rond en haut à droite (dans SearchChrome → route racine /profile)
- **Règle d'or (v6.23)** : aucun fichier-route utilitaire (redirect, stub, shim) dans `app/(tabs)/` — expo-router auto-enregistre tout fichier du groupe comme écran du TopTabs, donc comme page swipeable du pager. Les redirects vivent à la racine `app/` (Stack, non swipeable)
- Scan/Recherche : routes racine (`slide_from_bottom` / `fade`), pas des onglets
- Historique : route racine, poussée depuis Profil
- Perfumer : route racine, poussée depuis la signature nez de la fiche détail (slide_from_right)
- Brand : route racine, poussée depuis la chip « La maison » de la fiche détail et les sélecteurs de marques (BrandCapsules, BrandSheet) (slide_from_right)
- Profil public `/u/[pseudo]` : route racine en lecture seule, accessible sans auth (cible du deep link de partage `parfumscan://u/<pseudo>`)
- Étagère publique `/u/[pseudo]/shelf/[shelfId]` : page publique d'une étagère (identique à la privée, sans actions owner ; cible du deep link de partage `parfumscan://u/<pseudo>/shelf/<shelfId>`)
- `NavigationChromeContext` pour le comportement scroll du dock (3 états : expanded / compact / hidden) — chaque écran actif écrit `scrollY.value` (UI thread via `useAnimatedScrollHandler`), le layout réagit sans conflit de gestes ; expose `dockCompact` (collapse des labels) + `dockTranslateY` (hide) + `resetDock()`
- Chrome partagé : `SearchChrome` (barre de recherche + voix) dans le layout des tabs (le profil est une route racine, hors tabs)
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
- **Import de nouveaux scrapes** : `scripts/fragrantica/import-fresh.ts` (`npm run import-fresh`) — depuis `data/clean/`, transforme + télécharge l'image + WebP + upload Storage + upsert Postgres en une passe (idempotent, resumable, bg removal optionnel `--bg`). Laisse `image_url_2x` NULL → `migrate-upscale` prend le relais
- Recherche plein texte : colonnes générées `search_text` (index GIN `pg_trgm`) + `search_vector` (tsvector, config `french_unaccent`)
- `src/utils/normalize.ts` — `normalize()`, `normalizeId()` (utilisés par le dédoublonnage et le rescoring scan)
- RLS : `parfums` en lecture publique, écriture réservée aux admins (table `admins`)
- Images hébergées sur **Supabase Storage** (bucket public `parfum-images`) : `parfums/{parfumId}_{ts}_{name}` ; migration via `scripts/migrate-storage.ts`
- `source: 'seed'` — distingue les données importées des données saisies manuellement (`'manual'`)
- **Concentration** : `type_parfum` dérivé du **nom officiel** (suffixe via `concentrationFromName` de `parfum-labels.ts`), jamais du `<title>` SEO de Fragrantica (mot-clé générique `cologne`/`perfume` bruité) — extraction corrigée (scrape + `parseTitle`) + backfill SQL `0045`
- Pas d'API externe pour les données de catalogue

---

## §13 — Tests

- Suite de tests automatisée : Jest 29 + `jest-expo` + mock `@supabase/supabase-js` (dans `jest-setup.js`)
- 381 tests, 41 suites : `npm test` (watch) / `npm run test:ci` (CI + couverture)
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
- **Background removal** : `scripts/migrate-bgremoval.ts` — `@imgly/background-removal-node` (MODNet), sous-processus Node.js isolé dans `scripts/images/bgremoval/`
- **Migration storage Supabase** : `scripts/migrate-storage.ts` — Firebase Storage → bucket `parfum-images`, 8 parallèles, resumable, réécriture `image_url`
- **Upscale ×4 (HD)** : `scripts/images/migrate-upscale.ts` — workers Python persistants (Real-ESRGAN + CUDA, venv `scripts/images/upscale/`), génère `primary_2x.webp` + colonne `image_url_2x`. ~0,5 img/s, resumable. La fiche détail/lightbox fondent de la 1x vers la 2x ; les listes restent en 1x
- **Commandes** : `npm run migrate-webp`, `npm run migrate-bg`, `npm run migrate-storage`, `npm run migrate-upscale`
- **Dépendances dev** : `sharp`, `tsx`

---

## §17 — Flacon Runner (easter egg)

Mini-jeu endless runner accessible depuis Settings (5 taps sur numéro de version). Architecture entièrement sur le UI thread (Reanimated).

### Architecture des fichiers
```
src/features/runner/
├── useRunnerLoop.ts      # Game loop (useFrameCallback) : physique, collisions, spawn, scoring, pouvoirs, vies
├── RunnerGame.tsx         # Intégration : gestes, cycle de vie, score chase, sons, shake, missions, skins, classement
├── RunnerBottle.tsx       # Flacon joueur : squash/stretch aérien, landing spring, fissures liées aux vies
├── RunnerBackground.tsx   # Ciel/horizon gradients ancrés groundY, skyline de flacons
├── RunnerGround.tsx       # Piste gradient, crête lumineuse, stries 2 plans
├── RunnerObstacles.tsx    # Pool de 8 cristaux (4 types + volant), spawn entry fade
├── RunnerPickups.tsx      # Pool de notes à pouvoirs (Bergamote/Santal/Ambre/Musc), spawn entry fade
├── RunnerSpeedLines.tsx   # Traits de vitesse horizontaux (opacité liée à la vitesse)
├── RunnerHud.tsx          # Chips pouvoirs actifs (barres de temps résiduel, UI thread)
├── RunnerParticles.tsx    # Burst de particules à la collecte (coupé en Reduced Motion)
├── runner-sounds.ts       # 5 WAV synthétisés (jump, pickup, death, record, crack) via expo-audio
├── runner-missions.ts     # 8 missions/succès persistés AsyncStorage
├── runner-types.ts        # Types, constantes (PICKUP_DEFS, MAX_LIVES, SLOW_FACTOR), helpers AABB
└── runner-storage.ts      # High score + skins + mute + missions persistés AsyncStorage
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
- **Pouvoirs** : 4 notes (Bergamote magnet / Santal shield / Ambre double / Musc slow-mo ×0.45), durées bornées
- **Vies** : 3 vies + invulnérabilité 1,2 s après impact (flicker UI-thread) ; le shield absorbe un impact
- **Missions** : 8 succès persistés (`runner-missions.ts`), évalués en fin de partie
- **Classement** : table `runner_scores` (migration 0041) + RPC `submit_runner_score` / `runner_leaderboard` (service `services/runner.ts`)

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

---

## §21 — Votes utilisateurs & fusion performance (v8.10)

- **Table `parfum_votes`** : PK `(parfum_id, user_id, dimension)`, RLS owner, votes individuels **privés** — l'agrégat public passe exclusivement par la RPC `parfum_perf` (SECURITY DEFINER). Dimensions : `longevity`/`sillage` (`'1'..'4'`), `season` (spring/summer/fall/winter), `moment` (day/night). **Jamais saison+moment sous la même dimension** (conflit PK — fix 0044).
- **Fusion Fragrantica bornée** : `_perf_cranks` normalise le breakout en 4 crans UI (longévité : very weak+weak→1, moderate→2, long lasting→3, eternal→4 ; sillage : intimate→1, moderate→2, strong→3, enormous→4) ; `_perf_score` plafonne Fragrantica à `PERF_CAP = 100` équivalents en conservant sa forme (`poids = min(CAP,total)/total`) et ajoute les votes users à plein poids → moyenne pondérée 1..4. À 0 vote user, résultat strictement Fragrantica. Saisons/moment : fusion de comptes (`score_frag × poids + nb_votes_user`), barres relatives.
- **Cron `recompute_perf_strings`** (3h15 UTC) : réécrit `parfums.longevity`/`sillage` des parfums ≥ 1 vote user → propagation aux favoris/filtres/recherche.
- **Client** : `getParfumPerf`/`castVote` (`services/perf-votes.ts`), hook `usePerfVotes` (optimiste + refetch + auto-réparation au focus), affordances 👍 (`VotePickerSheet`), auth requise (`cast_vote` exige `auth.uid()`).
- **Piège `this`** : ne jamais détacher `supabase.rpc` du client — `supabase.rpc.bind(supabase)` obligatoire (sinon « Cannot read property 'rest' of undefined »).
