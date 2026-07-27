# ParfumScan React — Environment & Commands (v8.0)

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
# ⭐ Script tout-en-un (2 modes)
start.bat           # Mode FAST : Metro uniquement (pas de rebuild Gradle)
start.bat build     # Mode BUILD complet : Gradle + install + Metro

# Méthode manuelle :
emulator -avd Pixel_7_Pro
adb wait-for-device
adb shell getprop sys.boot_completed  # doit = 1
npx expo run:android
```
✅ Firebase, GPT-4o Vision, Camera, Haptics, Reanimated
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
# ⚠️ NE PAS utiliser assembleDebug pour un téléphone —
#     le debug nécessite Metro (sinon blocage splash screen).
#     Toujours utiliser assembleRelease pour un APK autonome.

# Android : build release (production) — APK autonome, JS embarqué
.\build_release.bat      # Gradle assembleRelease
```
→ APK release : `android/app/build/outputs/apk/release/app-release.apk`

### Installer sur téléphone (USB)
```bash
# Brancher le téléphone en USB (débogage USB activé)
adb devices                # doit montrer le device

# Option 1 : Development build direct
npx expo run:android       # build + installe en une commande

# Option 2 : Installer un APK déjà buildé
adb install android/app/build/outputs/apk/release/app-release.apk
```

### iOS Development Build (macOS + Xcode requis)
```bash
npx expo run:ios           # development build sur simulateur ou device
npx expo run:ios --configuration Release  # build release
```

### EAS Build (cloud — recommandé pour iOS sans Mac)
```bash
npx eas build --platform ios      # IPA dans le cloud
npx eas build --platform android  # AAB dans le cloud
npx eas submit --platform ios     # soumettre à l'App Store
npx eas submit --platform android # soumettre au Play Store
```

### Cloud Functions
```bash
npm run functions:build
npm run functions:deploy   # → europe-west1
```

### TypeScript
```bash
npx tsc --noEmit     # vérifier la compilation (0 erreur attendu)
```

### Tests
```bash
npx jest --ci         # 194 tests, 15 suites, ~22s
npm test              # watch mode
npm run test:ci       # CI mode avec couverture
```

## Stack
react-native 0.86.0 · expo ~57 · expo-router ~57
@react-native-firebase/* ^25 · expo-camera ~57 · expo-image ~57 · expo-splash-screen ~57
react-native-gesture-handler ~2.32 · react-native-reanimated ~4.5 · react-native-worklets 0.10
react-native-svg ^15 · react-native-pager-view ^8.0 · react-native-tab-view ^4.3 · @react-native-vector-icons/ionicons ^13
@react-native-async-storage/async-storage · expo-navigation-bar ~57 · expo-system-ui ~57 · typescript ~6.0
react-hook-form ^7.81 · zod ^4.4
expo-speech-recognition ^56 · expo-audio ~57 · expo-file-system ~57 · expo-location ~57

## Notes v6.17 — Fiche détail refonte + polices réellement chargées (22/07/2026)

**P0 polices** : Inter/Playfair n'étaient chargées nulle part (fallback système silencieux Android, crash iOS potentiel). Ajout `@expo-google-fonts/inter` + `@expo-google-fonts/playfair-display` + `useFonts` dans `_layout.tsx` (rendu bloqué jusqu'à `fontsLoaded`). Italique `PlayfairDisplay_700Bold_Italic` activée pour la ligne éditoriale.

**Fiche détail** : refonte UX/UI complète. `DetailHero` remplace `HeroPriceOverlay` (prix retiré de l'image). Prix unique dans le flux. Sections renommées : « En résumé » → « Tenue & sillage » (jauge Popularité supprimée, `popularityScore` reste interne), « Toutes les offres » → « Comparer les marchands », « Parfums similaires » → « Dans le même esprit », « Saisonnalité »+« Occasions » → « Quand le porter » (saisons en 4 colonnes verticales, occasions en chips top 3). Bug day/night corrigé : whitelist `normalizeSeasonKey` + `rankAndDedupe`. Ligne éditoriale italique « Hiver · Soirée ». `StickyBottomBar` devient barre d'action flottante (langage DockBar) + icône `flask`. Titres de section à pastille teintée sémantique (plus d'emojis).

**Design system v1.2** : 8 tokens saisonniers (`seasonSpring/Summer/Fall/Winter` + Soft, light+dark), patterns 4.9-4.11 (titre éditorial, colonnes de saison, barre flottante), règle useFonts en checklist.

## Notes v6.18 — Auth v2, Search hardening, OfflineBanner global, Weather simplifié (23/07/2026)

**Auth v2** : validation email regex, toggle visibilité mot de passe, mot de passe oublié (`sendPasswordResetEmail`), gestion `auth/cancelled` silencieux (Google), `textOn()` pour texte dynamique sur fond coloré. `KeyboardAvoidingView` corrigé (plus de `height` sur Android). SafeAreaInsets.

**Search hardening** : `SearchError` typé, limité à 4 tokens (triés par taille décroissante), trigrammes filtrés par stop words. Prefix cache : prend la query la plus peuplée, retombe Firestore si < 5 résultats. `anySucceeded` guard → `SearchError` si toutes les queries échouent (plus de `[]` silencieux). `onParfumsByMarque` (dead code) supprimé. `peekSearchCache()` / `clearSearchCache()` exportés. `docToParfum()` utilisé partout. `searchParfumFromScan` propage les erreurs. `_scanScore` copie spread (plus de mutation).

**useCatalog** : `peekSearchCache()` pour sauter le rate budget sur cache hit. `rateLimited` state + fallback gracieux (résultats précédents conservés). `error` state.

**Weather simplifié** : suppression `getStoredCity`/`setStoredCity` (GPS only, plus de fallback ville). 10s abort timeout fetch. Permission en deux étapes : `getForegroundPermissionsAsync()` d'abord, `requestForegroundPermissionsAsync()` seulement si `undetermined`. Délai initial 1s.

**VoiceOverlay** : safe areas + hauteur max dynamique (42% window, cap 360). Champ `query` dans phases searching/results. Separator line. `pointerEvents="box-none"`. Accessibilité voix.

**TabPager** : vérification réseau avant recherche vocale. `showMicFab` plus précis (caché si overlay visible, pas seulement listening). `textOn()` pour icône micro.

**OfflineBanner global** : `OfflineBanner` dans `_layout.tsx` (visible sur tous les écrans). État `reconnected` avec bannière 2.5s.

**Contrast utility** : `contrast.ts` — `textOn(bgHex)` basé WCAG luminance. Utilisé dans auth, TabPager.

**Theme** : 8 tokens saisonniers `seasonXxx`/`seasonXxxSoft` (light+dark). `dealInk`/`overpricedInk`/`fairInk`. `textMuted` éclairci `#6E6963`.

**Tests** : 194 tests, 15 suites. Test `error-translator` corrigé (unknown code → générique FR).

**Scripts** : `audit-search-fields.ts`, `backfill-search-fields.ts`.

## Notes v6.21 — Page Profil (23/07/2026)

**Page Profil** : nouvelle route `/profile` (push slide_from_right). Accessible depuis le `ProfileAvatar` des 4 onglets (cible modifiée `/settings` → `/profile`). Auth gate inline (non connecté : écran connexion avec bouton retour, pattern maison existant).

**Structure verticale** : header (back + titre « Profil » + rond settings 36 `surface2`/`border`) → identité centrée (avatar 88, displayName ou email local, email `textMuted`) → carte stats 3 colonnes (Favoris · Parfumerie · Scans, chiffres `Inter_700Bold` 24) + ligne chips ownership si parfumerie non vide (couleurs soft/ink dérivées de `WardrobeCard.badgeStyle`) → carte SOTD (parfum du jour avec image 44 → `/wardrobe/[parfumId]`, ou CTA « Choisis » → `/collection`, ou masquée si vide) → section Explorer : 4 rows data-driven (Favoris, Parfumerie, Historique, ScentList) avec icône cercle 36 `primarySoft` + compteur + chevron → déconnexion (bouton outline `overpriced`, `logout()` + `router.replace('/auth/login')`).

**Données** : `useFavoris`, `useWardrobe`, `useScans`, `useSotd`. Loading agrégé (`dataLoading = favLoading || wardLoading || scansLoading`) — identité visible immédiatement, compteurs masqués (—) pendant le chargement, pas de saut de layout. Ownership via `useMemo` sur `items` (pattern `collection.tsx:68-72`). Rond settings → `/settings` (remplace l'ancienne fonction du ProfileAvatar ; la déconnexion est conservée aussi dans settings).

**Évolutivité** : les rows Explorer sont un tableau `NAV_ROWS` (4 entrées) mappé avec `as const` — ajouter une entrée = +1 objet. La streak SOTD est prévue côté structure mais pas implémentée (dates `YYYY-MM-DD` existent en Firestore, requêtables ultérieurement).

**Fichiers** : `app/profile.tsx` (créé, ~280 lignes), `src/components/ProfileAvatar.tsx` (modifié 1 ligne), `app/_layout.tsx` (ajout route).

**Tests** : 193/194 (1 échec préexistant EmptyState.wishlist, inchangé). `npx tsc --noEmit` : 0 erreur sur `profile.tsx`.

## Notes v6.20 — Parfumerie v2 : bannière unifiée, WardrobeCard native, filtres attributs (23/07/2026)

**Bannière unifiée** : fusion de `WeatherWidget` + `SOTDCard` en une carte `primarySoft` compacte d'environ 40 px (économie ~55 px). Météo = icône + température ; SOTD = image + nom·marque + badge score coloré (seuils deal ≥ 70, fair ≥ 40) ; les deux segments coexistent avec un dot séparateur. États dégradés : pas de SOTD → label météo complet + CTA ; pas de météo → segment masqué ; ni l'un ni l'autre → carte masquée (`null`). `WeatherWidget.tsx` supprimé (usage unique).

**WardrobeCard native** : reconstruction sans wrapper `ParfumCard` pour corriger les bugs d'overlay. Système de zones strictes : top-left = signature (secondarySoft), top-right = ownership (couleurs existantes), bottom-left = rating « ★ n » compact sur image. Notes perso déplacées dans le corps (inline). Hauteur image 136 px, corps ~66 px → `CARD_HEIGHT` = 212. Pas de ligne prix (non pertinente pour la parfumerie). Helper `brandColor` dupliqué localement.

**Filtres attributs** : `FilterSheet` déplacé de `features/favorites/` → `components/FilterSheet.tsx` et généralisé (`items: FilterableItem[]`). `FilterBar` gagne un bouton « Filtres » (ligne recherche, badge compteur) + ligne conditionnelle de chips actifs (couleurs saisonnières). La page `collection.tsx` intègre `attrFilters`/`showAttrSheet`/`FilterSheet` + empty state + reset global owner/shelf/recherche. Recherche étendue aux notes (EN + FR, via `favoriMatchesSearch` + `allNotes`). Ownership/étagères restent en pills inline (axe primaire quotidien), les attributs en sheet (découverte occasionnelle) — barre hybride justifiée.

**`favori-filters.ts` généralisé** : `FilterableItem` (interface minimale acceptée par `UserFavori` et `WardrobeItem`), signatures basées sur `FilterableItem` au lieu de `UserFavori`. Nouveaux helpers `buildActiveChips(f)` + `removeActiveChip(f, chip)` partagés entre `favorites.tsx` et `FilterBar`.

**Dénormalisation** : 4 champs sur `WardrobeItem` (miroir `UserFavori` : `longevity`, `sillage`, `seasonScores`, `allNotes` — note: `allNotes` pour éviter la collision avec les notes personnelles texte `notes: string | null`). `addToWardrobe` accepte `parfum?: Parfum` optionnel ; si absent, fetch best-effort `getParfumById` (pattern `moveFavori`). Un seul call site modifié (`catalog/[id].tsx` passe `parfum`), les 2 autres (`favorites.tsx`, `history.tsx`) couverts par le fetch interne. `docToWardrobeItem` lit les 4 champs avec fallback `null`.

**Tests** : 194 tests, 15 suites (inchangé). Tests `user-data.test.ts` fixés pour les nouveaux champs `Parfum` obligatoires.

## Notes v6.19 — Filtres avancés des favoris (23/07/2026)

**Filtres Favoris** : nouveau `FilterSheet` multi-facettes (Famille / Saison / Tenue / Sillage) avec chips multi-sélection, compteurs et application live. Barre de filtres simplifiée (bouton unique « Filtres » + badge compteur, chips actifs dismissibles, recherche texte étendue aux notes EN/FR).

**Dénormalisation** : 4 nouveaux champs dans `UserFavori` (`longevity`, `sillage`, `seasonScores`, `notes`) peuplés par `buildFavoriFilterFields()` au moment de l'ajout. `addFavori()` refactorée avec une signature `(uid, parfum: Parfum)` — le call site unique (`catalog/[id].tsx`) mis à jour. `moveFavori()` enrichi (fetch best-effort du Parfum). `useFavoris` hook débarrassé du wrapper `addFavori` inutilisé.

**Utils** : `src/utils/season.ts` (SeasonKey, SEASON_META, normalizeSeasonKey, seasonScoresFromRanking) extrait de la fiche détail — partagé avec les filtres. `src/utils/favori-filters.ts` (FavoritesFilters, prédicats, buckets, LONGEVITY_OPTIONS, SILLAGE_OPTIONS, favoriMatchesSearch).

**Option B** : pas de backfill, pas de heal. Favoris anciens sans les champs exclus des facettes actives (ré-ajout manuel accepté).

**Tests** : 195 tests, 15 suites. Tests `addFavori` mis à jour pour le nouvel objet Parfum (assertions sur les 4 champs filtres). Hook `useFavoris` nettoyé.

## Notes v6.16 — Scan stability, BrandSheet, Pager gestures (22/07/2026)

**Scan stability** : phase 1–3 du diagnostic (15 bugs). Auth obligatoire sur `analyzePerfumeImage` (CF), payload state-driven (plus de `pendingAnalysis` ref), bouton Annuler sur ScanLoading, resize images `expo-image-manipulator` → 1024px (~100-300KB au lieu de 4MB), timeouts client 90s / serveur 120s, JSON mode GPT-4o + retry JSON invalide. Erreurs réseau Firestore → `SCAN_ERROR` (plus de `[]` silencieux), chemin `low-confidence` → `ScanClarify`, analyse immédiate (plus de délai 2.5s), suppression `step`/`STEP_1`/`STEP_2`/`SCAN_STEPS` (dead code), volumeMl correctement passé. Compteur burst visible ("1/3"), burst 1-appel `analyzeMultipleImages`, retry sans re-capture depuis `ScanError`, `KeyboardAvoidingView` sur `ScanClarify`. Dépendances : `expo-image-manipulator`.

**BrandSheet** : refonte complète (11 bugs). Strip en colonne sibling (plus d'overlay absolu), hauteurs fixes `ROW_H=48`/`HEADER_H=40` → offsets exacts via `scrollToOffset` (plus de dérive `getItemLayout`), mapping y→lettre exact via cellules `flex:1`, active = pill primary (plus de `fontSize` change → zéro jitter), loupe Reanimated (zéro `setState` 60fps), highlight de la lettre visible via `onScroll`, haptics sur changement de lettre, strip masquée en recherche, état vide.

**BrandCapsules** : `useRouter()` dead code retiré, `borderStyle: 'dashed'` cassé Android → fond `primarySoft` + icône flèche.

**Pager gestures** : `onHorizontalScrollActive` câblé de bout en bout (auparavant code mort v6.9). Le pager se désactive pendant le drag d'une rangée horizontale interne (BrandCapsules, CatalogRow, FamilyAmbianceCards, FilterBar pills). `.enabled(!sheetOpen && !rowScrollActive && !overlayVisible)`. Garde-fou `setRowScrollActive(false)` dans `goTo()`. 4 fichiers modifiés : `index.tsx`, `collection.tsx`, `FilterBar.tsx`, `reference.md`.

**Tests** : 185 tests, 14 suites. Tests `useScanReducer` mis à jour (suppression `SCAN_STEPS`/`STEP_1`/`STEP_2`, ajout 2 tests payload images/scanResult). Nouveaux tests `useScanPipeline` : 15 tests sur le pipeline analyse→recherche (GPT, recherche, clarify, erreurs, garde-fous, historique).

**Architecture** : `useScanPipeline` extrait le pipeline métier (GPT-4o → recherche Firestore → historique), testable via `renderHook` + mock des services. `ScanScreen` passe de ~300 lignes à ~140 lignes (rendu + handlers UI uniquement).

## Notes v6.15 — Flacon Runner (endless runner, 22/07/2026)

**Easter egg** : mini-jeu Flacon Runner accessible depuis Settings (5 taps sur le numéro de version). Endless runner vertical avec saut/double-saut, obstacles (cristaux), bonus réduction, combo aérien, near-miss, score chase lisse, countdown 3·2·1, palette progressive, speed lines, sons WAV synthétisés, skins déblocables, pause auto AppState, milestones (Nez confirmé / Expert / Maître parfumeur / Légende). Toute la logique est sur le UI thread (SharedValues + useFrameCallback + useAnimatedStyle), zéro `setState` en boucle.

**Architecture** : `src/features/runner/` — 10 fichiers :
- `useRunnerLoop.ts` — game loop via `useFrameCallback` (physique, collisions, spawn, scoring)
- `RunnerGame.tsx` — intégration (gestes, cycle de vie, score chase, sons, shake, milestones, skins)
- `RunnerBottle.tsx` — flacon joueur (squash/stretch aérien, landing spring, death flash)
- `RunnerBackground.tsx` — 2 couches parallaxe seamless avec wrapping périodique
- `RunnerGround.tsx` — sol défiant avec marques
- `RunnerObstacles.tsx` — pool de 8 cristaux (4 types + volant), rendus via opacity toggling
- `RunnerPickups.tsx` — pool de 4 badges réduction (altitudes variables)
- `RunnerSpeedLines.tsx` — traits de vitesse horizontaux (opacité liée à la vitesse)
- `runner-sounds.ts` — 4 WAV synthétisés (jump, pickup, death, record) via `expo-audio`
- `runner-types.ts` — types, constantes, helpers AABB, altitudes
- `runner-storage.ts` — high score + skins persistés AsyncStorage

**Dépendances** : `react-native-reanimated` (useFrameCallback, SharedValue, useAnimatedStyle), `react-native-gesture-handler` (Gesture.Tap), `expo-audio` (useAudioPlayer), `@react-native-async-storage/async-storage`.

## Notes v6.13 — Scan search & dedup
**Recherche scan** : nouvelle fonction `searchParfumFromScan()` — wrapper au-dessus de `searchParfumsCached` qui exploite la sortie structurée de GPT-4o (champs marque+nom séparés). Rescoring : +50 nom exact, +25 nom partiel, +15 marque exacte, +8 marque partielle. Le +50 garantit que le match exact écrase les variants/flankers plus populaires.

**ScanResults** : ne trie plus par prix — préserve l'ordre de pertinence de `searchParfumFromScan` (avant, le tri par bestPrice noyait le match exact derrière les EDT/Cologne moins chers).

**Dédoublonnage** : nouvelle fonction `_dedupByMarqueNom()` — filtre les résultats par `normalize(marque)+'_'+normalize(nom)`, conserve le 1er (meilleur score). Appliqué dans `searchParfumsCached` (catalogue+scan), prefix cache, et `searchParfumFromScan`. Élimine les doublons Firestore (même parfum importé plusieurs fois avec des IDs différents).

## Notes v6.12 — Quality hardening & testing
Refactoring qualité final : `console.log` wrappés dans `if (__DEV__)` (3 occurrences firestore search). 12 `catch {}` vides remplacés par `console.warn` (CatalogPage, firestore, useAuth, fcm, user-data, favorites, history, \_layout). `ProfileAvatar` refactoré en `getStyles(t: Theme)` + `useMemo`. Design guide v1.1 finalisé (accessibilité, StyleSheet.create, TextInput, radius, Reanimated, couleurs invariantes). 2e passe d'audit : 0 `fontWeight`, 0 `as any`, 0 `StyleSheet.create` thématique, 8/8 `onSnapshot` error callbacks, 100% `getStyles` + `useMemo`.

**Suite de tests** : 166 tests, 13 suites, ~6s. Infrastructure Jest 29 + `jest-expo` + mock Firestore in-memory. Couvre : 5 utils (normalize, translate-note, error-translator, ownership, note-descriptions), 3 hooks (useScanReducer 26 tests, useCatalog 12 tests, useDensityPreference 13 tests), 3 composants (Button 12 tests, PriceDisplay 17 tests, EmptyState 11 tests), 2 services (user-data 14 tests, wardrobe 14 tests). `npm test` / `npm run test:ci`. `npx tsc --noEmit` clean sur src/ et app/.

## Notes v6.11
Refactoring qualité : `useCallback` sur tous les handlers passés aux enfants (16 fichiers, 30+ handlers). `try/catch` + `console.warn` sur toute la couche service (12 fonctions `user-data.ts`, 7 fonctions `wardrobe.ts`, `storage.ts`). Hooks `useWardrobe` et `useShelves` : méthodes wrappées dans `useCallback`. `useEffect` deps corrigées (`catalog/[id].tsx` similars, `ScanScreen.tsx` scan steps). `.catch()` ajoutés sur 22 appels Firestore non protégés dans 7 écrans. `getStyles` + `useMemo` systématique (1 oubli corrigé dans `OlfactoryPyramid`). Couleurs hardcodées remplacées par tokens (6 dans `catalog/[id]`, 2 dans `admin`). `gridKey` ne change plus au changement de thème. Design guide mis à jour v1.1 : accessibilité texte, `StyleSheet.create` clarifié, `TextInput` styling, couleurs invariantes documentées, `lg`/`xl` retirés de la grille de spacing.

## Notes v6.10
Recherche refaite : cache Map (prefix cache local + hit complet), dual query Firestore (1 token → `array-contains` + `orderBy reviewCount`, 2+ tokens → `array-contains-any`), `exactMatch` réservé aux queries multi-mots, signal composite `Math.max(reviewCount, ratingCount, popularityScore)`, bonus `/2`, scoring single-pass (boucle for), tri pop-first pour 1 token, 50 résultats, debounce 150ms, requestIdRef anti-race. Barre de recherche fixe en haut (ne disparaît plus au scroll). Parfums similaires : scoring par accords partagés (`mainAccords`, `array-contains-any`) + `orderBy popularityScore`, ParfumCard compact. Cache TTL 24h sur `similarIds`. Auth : `KeyboardAvoidingView` sur Android (login + register). Réimport 46 nouvelles marques → ~25 100 parfums, `popularityScore` backporté sur tous les docs. Nouveaux index Firestore composites : `searchKeywords` + `reviewCount` et `mainAccords` + `popularityScore`. Déployer les index avec `firebase deploy --only firestore:indexes`.

## Notes v6.9
Favoris : chips famille remplacés par bouton unique « Famille » → ActionSheet + chip dismissible, densité partagée avec le catalogue via `useDensityPreference`. Historique : `ScanHistoryCard` refactorée en wrapper — scans réussis délèguent à `ParfumCard` + overlay (dot statut + date + compteur ×N), no-result/error en layout compact natif. Densité applicable aux scans réussis. `BrandSheet` : bottom sheet alphabétique A-Z (60+ marques, barre de recherche, index latéral). Pager remplacé : `GestureDetector` + Reanimated au lieu de `react-native-pager-view` — résolution native des conflits de swipe avec `activeOffsetX(30)` + `failOffsetY(15)`. « Voir tout → » scroll à la grille via `scrollToIndex` au lieu de push vers recherche. `GRID_MODES` centralisé dans `useDensityPreference`.

## Notes v6.8
Refonte catalogue v2 — structure hybride rangées éditoriales + grille filtrable. Suppression chips famille olfactive (remplacés par dilution dans sections nommées + cartes d'ambiance « Explorer par famille »). Capsules marques rectangulaires (top 10 + « Toutes → »). `ParfumCard` 4 modes : `compact` (rangées, 140px), `comfortable` (grille défaut, tags+notes+price dot), `compactPlus` (grille dense, image 90px), `list`. Price dots colorés deal/fair/overpriced. Densité persistée AsyncStorage (`@parfumscan/catalog-density`), partagée catalogue + recherche. Recherche : chips famille supprimées, contrôles de densité identiques à la grille. Nouveaux composants : `BrandCapsules`, `CatalogRow` (collapse/expand), `FamilyAmbianceCards` (6 cartes theme-aware avec Ionicons). Nouveau hook : `useDensityPreference`.

## Notes v6.7
Parfumerie (ex « Garde-robe ») — icône `flask`. Favoris en grille (filtres famille, tri, ActionSheet). Historique groupé par période (Aujourd'hui/Hier/Cette semaine...), scans sauvegardés dans tous les états (no-result, error). `ActionSheet` bottom sheet custom. Dénormalisation `bestPrice`/`referencePrice`/`annee` dans UserFavori/UserScan. Back gesture edge-pan (40px strip gauche) sur fiche détail catalog. SOTDPicker ancré au-dessus de la carte (position absolute, sans Reanimated). `ImageViewerPopup` : tap sur la photo du parfum → popup plein écran. Recherche en grille 2 colonnes (`compact`). Images en `contain` (pas de crop). Parfums similaires triés par popularité + shuffle journalier. Recherche par préfixes (scoring `startsWith` + bonus `reviewCount`).

## Notes v6.22 — Swipe horizontal entre onglets + fix indicateur DockBar (24/07/2026)

**Navigation swipe** : remplacement du navigateur déprécié `Tabs` (expo-router) par `TopTabs` (`expo-router/js-top-tabs` — vendorisé dans expo-router 57). C'est un navigateur material-top-tabs basé sur `react-native-tab-view` (v4.3.2) + `react-native-pager-view` (8.0.2, déjà installé SDL-pinned). Swipe horizontal natif entre les 4 onglets avec indicateur doré continu piloté par `position` (Animated.Value). Navigation cross-tab (`router.push`), deep links, `useFocusEffect`, `useLocalSearchParams` préservés.

**DockBar** : bug fixé — l'indicateur doré subissait un off-by-one pour les onglets 2 (Parfumerie) et 3 (Profil) : la formule `state.index < 2 ? state.index : state.index - 1` tronquait les indices 2→1 et 3→2. Maintenant `visualIdx = state.index`. Ajout du helper `getIndicatorLeftAtProgress(screenWidth, progress)` pour l'indicateur continu. Le `spring` existant devient le fallback (si `position` absente). La prop `position` (RN Animated.Value) est pontée vers `indicatorLeft` SharedValue via `addListener`.

**NavigationChromeContext** : nouveau `resetDock()` — réaffiche le dock après un changement d'onglet (tap ou swipe). Utilisé via `screenListeners={{ focus: resetDock }}`. Utile surtout au swipe : si le dock était caché après scroll profond, il réapparaît automatiquement sur le nouvel onglet.

**`tabBarPosition="bottom"`** : obligatoire sur TopTabs. Sans ça le DockBar (position absolute) se résout contre le parent top (conteneur hauteur 0 en haut de l'écran) → barre invisible en haut.

**Dépendance** : `react-native-tab-view@^4` (JS pur), peer `react-native-pager-view` satisfait par la version SDL 8.0.2.

**Tests** : 227 tests, 17 suites (inchangé). `npx tsc --noEmit` : 0 erreur sur `app/` et `src/`.

## Notes v6.23 — Fix page fantôme TopTabs + resync docs (24/07/2026)

**Bug** : swipe droite→gauche depuis l'onglet Profil révélait une 5e page blanche (seule SearchChrome visible). Cause : `app/(tabs)/scentlist.tsx` (stub redirect `return null`) auto-enregistré par expo-router comme 5e écran du TopTabs — `getSortedChildren` (expo-router `useScreens.js`) ajoute les routes du dossier non déclarées après les écrans déclarés → 5 pages natives dans le pager ViewPager2. Latent sous l'ancien `Tabs` (non swipeable), exposé par la migration TopTabs v6.22. Le `router.replace` du shim tirait une seule fois et perdait la course contre le settle du swipe → page blanche stable.

**Fix** : shim déplacé `app/(tabs)/scentlist.tsx` → `app/scentlist.tsx` (Stack racine, non swipeable, `animation: 'none'`). Call site `collection.tsx` branché en direct sur `/(tabs)/selection?segment=carnet` (pattern `profile.tsx`). Clamp `Math.min(state.index, 3)` sur l'indicateur DockBar (2 spots).

**Règle verrouillée** : aucun fichier-route utilitaire (redirect, stub, shim) dans `app/(tabs)/` — tout fichier du groupe devient une page swipeable du TopTabs. Les redirects vivent à la racine `app/`.

**Rappel chemins** : la page Profil vit dans `app/(tabs)/profile.tsx` depuis v6.22 — la note v6.21 fait référence à l'ancien chemin `app/profile.tsx`. `ProfileAvatar.tsx` n'existe plus : l'avatar utilisateur est rendu dans la DockBar (onglet Profil, photo si `user.photoURL`).

**Docs resynchronisées** : rules.md §2 (arborescences réelles : 14 services, 17 hooks, 13 components, 10 utils, 8 models, 10 dossiers features), §13 (227 tests / 17 suites), §15 (météo GPS-only, bannière unifiée — WeatherWidget supprimé v6.20), §19 (onboarding supprimé). reference.md : weather.ts GPS-only, +`scentlist.ts`, +`account.ts`, +`useScentList`, +`UserScentItem`, suppression du bloc DockBar pré-v6.22 (5 positions), FilterSheet `items: FilterableItem[]`, EmptyState 5 variantes.

## Notes v7.4 — Curation en masse : cœur sur les cartes + FavorisContext + définition depuis Favoris (26/07/2026)

**Modèle produit verrouillé** : curation (❤️ en masse, rapide, dans les listes) → qualification (définir l'état, lent, sur la fiche). L'onglet Favoris = pivot/file d'attente entre les deux. La boucle se ferme : les favoris nourrissent la RPC `personalized_suggestions` (0006_functions.sql) → « Pour vous » s'améliore.

**FavorisContext** (`src/contexts/FavorisContext.tsx`, monté dans `_layout.tsx` sous AuthProvider) : source de vérité unique — 1 subscription `onFavoris`, expose `favoris`, `favIds: Set`, `isFav(id)`, `toggleFav(parfum)` (optimiste + rollback), `removeFavori(parfumId)`. Remplace 3 états éclatés supprimés : hook `useFavoris` (fichier supprimé), `isParfumFavori` + état local `isFav`/`favoriId` de la fiche détail, et l'effect `Promise.all` fav/wardrobe/scent de `[id].tsx`. Un cœur tapé n'importe où se synchronise instantanément (catalogue ↔ onglet Favoris ↔ hero fiche).

**FavButton** (`src/components/FavButton.tsx`) : cœur auto-contenu (lit le contexte, pop spring `withSequence`+`withSpring`, `hapticsSuccess` ajout / `hapticsLight` retrait, auth gate → login, coupé en Reduced Motion). 3 tailles : `xs` (liste 26px), `sm` (cartes 32px), `lg` (hero 40px). Se positionne en absolute top-right.

**Cœur sur ParfumCard** : rendu dans les 4 modes (compact/comfortable/compactPlus/liste), top-**right** (le badge promo est top-**left** dans le code, contrairement au guide §4.4). `ParfumCard` étant la surface universelle (9 écrans : catalogue grille + 4 rangées, recherche ×3, scan, voix, similaires, nez, historique, favoris), un seul changement = cœur partout. Placeholders passés en `position: 'relative'`.

**useSaveController** (`src/features/catalog/useSaveController.ts`) : hook qui encapsule toute la logique d'enregistrement (wardrobeItem + scentItem + saveLabel + handlers SaveSheet/TrySheet, état optimiste). Réutilisé par la fiche détail ET l'onglet Favoris — zéro duplication. La fiche `[id].tsx` perd ~150 lignes d'état/handlers.

**Bug de perte de données corrigé (Favoris)** : le menu long-press « Déplacer vers Parfumerie » appelait `moveToCollection` qui écrit dans la table `collection` **morte** (plus aucun consommateur UI depuis v7.1 ; l'onglet Parfumerie lit `wardrobe`) → le parfum disparaissait. Remplacé, ainsi que « Ajouter à ma parfumerie » (ownership 'have' codé en dur) et « Déplacer vers le carnet », par une action unique **« Définir »** qui ouvre la `SaveSheet` (choix complet d'ownership + carnet). Menu réduit à 3 actions : Voir le détail / Définir / Retirer. (Les fonctions service `moveToCollection`/`moveToScentList` restent en base, testées, mais ne sont plus appelées par l'UI — la voie de perte est fermée.)

**Fichiers** : `FavorisContext.tsx`, `FavButton.tsx`, `useSaveController.ts` (créés) ; `ParfumCard.tsx`, `DetailHero.tsx`, `FavoritesContent.tsx`, `app/catalog/[id].tsx`, `app/_layout.tsx` (modifiés) ; `src/hooks/useFavoris.ts` (supprimé). Tests : 221/221, 19 suites. `tsc` : 0 erreur app/ + src/.

## Notes v7.3 — Fiche détail : barre d'action refondue + SaveSheet unifiée (26/07/2026)

**Barre d'action flottante** : les 3 icônes non labelisées (cœur/pipette/fiole) supprimées — layout refondu `[prix −X%] [Enregistrer] [Voir l'offre]`. `SaveButton` à état (`src/features/catalog/SaveButton.tsx`) : vide = « Enregistrer » (surface2), enregistré = statut affiché (« Possédé », « À essayer », « Coup de cœur »…, primarySoft + bookmark plein). Décliné en variante `bar` (flex:1) et `flow` (pleine largeur, ajouté dans le flux sous la section prix — l'action est accessible avant l'apparition de la barre).

**Cœur favori sur le hero** : pattern Airbnb/Vinted — pastille 40px top-right de `DetailHero`, pop spring (withSequence timing 110ms → spring damping 10/stiffness 500) + `hapticsSuccess` à l'ajout / `hapticsLight` au retrait, coupé en Reduced Motion.

**SaveSheet** (`src/features/catalog/SaveSheet.tsx`) : sheet content §4.16 (radius top 24, entrée withTiming 250 cubic-out + backdrop fade, sortie 200ms) unifiant les deux dimensions d'enregistrement, à application live (pas de bouton confirmer global) :
- « Ta parfumerie » : 5 chips ownership (Possédé/Souhaité/Ancien/Échantillon/Décant — principe d'organisation conservé, upsert via `addToWardrobe` qui préserve rating/notes au conflit 23505) ; Décant → input ml inline + validation ; liens « Ouvrir dans ma parfumerie » / « Retirer ».
- « Carnet d'essais » : chip « À essayer » + 4 chips verdict (réutilisation de `VERDICT_OPTIONS` exporté de TrySheet) ; lien « Notes détaillées… » → TrySheet (édition riche conservée).

**Câblage** : `[id].tsx` — `saveLabel = useMemo` (priorité parfumerie > carnet), `handleSavePress` (auth gate), `handleSetVerdict` (markScentTried si to_try, updateScentItem si tried), `handleRemoveWardrobe` (rollback optimiste). `handleWardrobePress`/`handleScentPress`/`showWardrobeSheet` supprimés ; `WardrobeAddSheet` reste utilisé par `ScentListContent`.

**Fichiers** : `SaveSheet.tsx` + `SaveButton.tsx` (créés), `StickyBottomBar.tsx` (réécrit), `DetailHero.tsx` (cœur), `TrySheet.tsx` (export VERDICT_OPTIONS), `app/catalog/[id].tsx` (câblage). Tests : 209/209, 18 suites. `tsc` : 0 erreur app/ + src/.

## Notes v7.2 — Nettoyage héritage Firestore (26/07/2026)

**Audit + suppression des règles héritées de Firestore** (obsolètes depuis la migration Supabase) :

- **Seuil recherche 3→2 caractères** : le seuil 3 était une optimisation coût Firestore (lectures par document). Le RPC Postgres `search_parfums` (tsvector + pg_trgm) traite les queries courtes sans surcoût. Aligné partout : `useCatalog`, `search.tsx` (4 endroits). "CK", "Y" fonctionnent maintenant.
- **Rate limiter 30/min supprimé** : protection anti-quota Firestore (lectures par document). Supabase facture au niveau infra (pool de connexions), pas par requête. `peekSearchCache`, `rateLimited`, `prevParfumsRef`, bannière UI — tout supprimé.
- **Prefix cache + tokenisation client supprimés** (~70 lignes) : `scoreDocs`, max 4 tokens, `STOP_WORDS`, `multiToken` — dupliquait le scoring du RPC côté client. Le RPC tokenise, score, fuzzy-match et déduplique côté serveur.
- **Code mort supprimé** : `buildSearchKeywords`, `generateTrigrams`, `STOP_WORDS` (normalize.ts), `searchKeywords` (interface Parfum), `translateFirebaseError` + 3 maps d'erreurs Firebase (error-translator.ts), `LRUCache.entries()` (search-shared.ts).
- **Renommage** `src/services/firestore.ts` → `src/services/catalog.ts` (17 imports mis à jour).
- **Conservé** : LRU cache exact (200 entrées, 10 min), debounce 150ms, rescoring scan (+50/+25/+15/+8 — le RPC ne distingue pas nom vs marque), `dedupByMarqueNom`, `rowToParfum`/`WRITE_MAP`.

**Fichiers** : `normalize.ts` (58→12 lignes), `catalog.supabase.ts` (427→351), `useCatalog.ts` (90→53), `search.tsx` (−bannière rateLimited), `error-translator.ts` (94→38), `search-shared.ts` (−entries()), `parfum.interface.ts` (−searchKeywords). Tests : 209 tests, 18 suites (4 réécrits, 1 supprimé, 1 créé).

## Notes v7.1 — Catalogue éditorial, images HD, scroll UI-thread, durcissement (26/07/2026)

**Images HD (upscale ×4)** : pipeline `scripts/migrate-upscale.ts` (`npm run migrate-upscale`) — pool de workers Python **persistants** (Real-ESRGAN + CUDA, venv isolé `scripts/upscale/`, modèle chargé une fois, jobs en JSON-lines stdin/stdout). Génère `primary_2x.webp` (1500×2000) + colonne `parfums.image_url_2x` (migration 0017). Débit ~0,5 img/s (sériel : GPU + I/O 1500×2000 + 3 allers-retours Supabase ; la concurrence n'accélère pas) → ~24K images en ~10h, resumable. Setup venv : `uv venv --python 3.10` + torch cu124 + realesrgan + `patch_basicsr.py` (torchvision≥0.17). **Câblage app** : `DetailHero` + `ImageViewerPopup` affichent la 1x (déjà en cache) puis fondent vers la 2x (`transition` expo-image, `key={imageUrl2x}`) ; listes/grilles restent en 1x. Champ `Parfum.imageUrl2x`, mappé dans `rowToParfum`/`WRITE_MAP`.

**Taxonomie familles** : `src/utils/olfactory-families.ts` — 6 familles FR (boisée/florale/hespéridée/ambrée/gourmande/aromatique) regroupant ~46 valeurs anglaises. `FamilyAmbianceCards` v2 data-driven (flacon réel + effectif via `getFamilyOverview`, RPC `family_overviews` migrations 0018/0019), recherche mode famille (`/search?family=<key>`, `getParfumsByFamily`).

**Catalogue** : nouvelles rangées « Parfaits pour {saison} » (RPC `seasonal_parfums`, migration 0015, `currentSeason()`) + « Les mieux notés » (`getTopRatedParfums`) ; compteur dynamique (`getParfumCount`). Nouvelles fonctions : `getTopRatedParfums`, `getParfumsByFamily`, `getFamilyOverview`, `getSeasonalParfums`, `getParfumCount`. Code mort supprimé (`onParfums`, `createParfum`, `deleteParfum`, `deleteAllCachedParfums`, `isInCollection`).

**Scroll UI-thread** : `reportScroll(y)` (JS) → `SharedValue scrollY` (`NavigationChromeContext`) écrite via `useAnimatedScrollHandler` dans toutes les listes (CatalogPage, FavoritesContent, ScentListContent, WardrobeGrid, collection, selection, index, catalog/[id]). `CollapsingHeader` 100% UI thread (crossfade interpolate, plus de `LayoutAnimation`).

**Auth** : nouveau composant partagé `src/components/AuthGate.tsx` (dé-duplique les gates inline de profile, collection, favoris, carnet). **`useCollection` supprimé** (concept « Collection » abandonné → Parfumerie unifiée ; le service `onCollection` existe encore mais n'a plus de consommateur UI).

**Durcissement Edge Functions** : suppression de `getUserIdFromAuth` (ne vérifiait PAS la signature JWT) → `verifyUserToken` ; scan limité à 5 images / 5 Mo ; whitelist MIME audio + timeout 60s (transcribe) ; pagination alertes prix (chunks 1000) ; météo en batch `Promise.allSettled` ; `purgeDeadTokens` en 1 requête. **Realtime** : `subscribeUserTable` bufferise les événements arrivant avant la fin du fetch initial + canaux uniques (`channelSeq++`).

**Config** : auth Supabase durcie (`config.toml` : mot de passe 8 car. `letters_digits`, confirmation email) ; retrait des variables d'émulateurs Firebase de `env.ts`. `season.ts` : `currentSeason()` + `SEASON_META.withArticle`. Copy généralisé au tutoiement.

**Sécurité** : token Supabase retiré de `opencode.json` (le MCP lit `SUPABASE_ACCESS_TOKEN` depuis l'env).

**Tests** : 227 tests, 18 suites (+ `__tests__/utils/season.test.ts`).

## Migration Supabase (en cours — l'app tourne toujours sur Firebase)

**Statut** : Phase 0 validée (24/07/2026). Aucun code app modifié.
**Plan complet** : `MIGRATION_SUPABASE.md` (décisions, cartographie, phasage).
**Décisions verrouillées** : Expo Push (pas FCM) · auth Supabase fresh-start (pas de mapping UID, pas de comptes à migrer) · recherche tsvector + pg_trgm · IDs parfums = slugs texte · cutover big-bang par version.
**Schéma** : `supabase/migrations/0001_extensions.sql` → `0006_functions.sql` — validé par `supabase db reset` + `supabase/smoke-test.sql` (12 tests, rejouable via `Get-Content supabase/smoke-test.sql | docker exec -i supabase_db_ParfumScan_react psql -U postgres -d postgres`).
**Projet cloud** : `zrifarygomoljwhdjcbh` (Europe). Clés dans `.env` (`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` à renseigner pour les scripts).
**Local** : `supabase start` (Docker Desktop requis) · `supabase db reset` · Studio http://127.0.0.1:54323 · DB postgresql://postgres:postgres@127.0.0.1:54322/postgres
**CLI** : installé globalement (`npm i -g supabase`) — sur cette machine, lancer via `cmd /c` (ExecutionPolicy PowerShell).
**Phases restantes** : ~~1~~ ✅ ~~2~~ ✅ ~~3~~ ✅ ~~4 = USE_SUPABASE + E2E~~ ✅ (25/07) — flag activé, E2E cloud 24/24 stable (3 runs), `search_parfums` réparé (0011 dedup row_number + 0012 tokens `GROUP BY`), **12 migrations**, projet expo.dev lié (`eas init`) — 5 = release : rebuild app (`npx expo run:android` pour embarquer le code + `projectId` Expo Push) + retrait éventuel des deps Firebase résiduelles. Remarques non bloquantes : `analyze`/`transcribe` utilisent encore `getUserIdFromAuth` (`verifyUserToken` préférable, mais rate-limit RPC sécurise) ; dette infra préexistante : `tsc --noEmit` *global* bruyant car `__tests__` n'a pas `@types/jest` et `supabase/functions/**` est du Deno hors scope → exclure `supabase/functions` du `tsconfig.json`.

## Docs
Expo SDK 57: https://docs.expo.dev/versions/v57.0.0/
React Native Reanimated: https://docs.swmansion.com/react-native-reanimated/
Design system « Luxe malin » : `.clinerules/design-guide.md`

## Données — Pipeline d'import

### Catalogue seed (~25 100 parfums, 239 marques)

Le catalogue est importé depuis un scrape Fragrantica Apify, puis nettoyé et hébergé en autonome.
Zéro dépendance à l'API Fragella pour les données de base.

```
data/raw/ (1.27 GB, non versionné) → data/clean/ (31 MB) → Firestore parfums/{id}
```

### Scripts

| Commande | Fichier | Rôle |
|---|---|---|
| `npm run clean-data` | `scripts/clean-apify.ts` | Nettoie les 193 JSON scrapés : débruite, déduplique, strip champs traçants |
| `npm run import-data` | `scripts/import-firestore.ts` | Import Firestore + upload images → Firebase Storage |
| `npm run clean-fragella` | `scripts/clean-fragella.ts` | Supprime tous les parfums importés via l'ancienne API Fragella (`source: 'fragella-cached'`) |

### Authentification import

Nécessite un compte de service Firebase :
1. Console Firebase → Project Settings → Service Accounts → Generate key
2. Sauvegarder le JSON → `service-account.json` à la racine (gitignoré)
3. Le script le lit via `firebase-admin` (v13+, API modulaire)

### Décisions clés

| Décision | Raison |
|---|---|
| Zéro référence Fragella dans les données | Indépendance totale |
| Images : 1 JPG 375×500 par parfum (pas de PNG transparent) | Seule source dispo dans le scrape (vignettes, pas full-size) |
| Images hébergées sur Firebase Storage | Pas de dépendance CDN externe (fimgs.net) |
| `imageUrlTransparent` = null, `imageFallbacks` = [] | Non disponibles dans le scrape, non nécessaires pour l'UI |
| `source` = `'seed'` | Distingue les données importées des données API live |
| Photos communauté (`images[]`, photogram) supprimées | Contenu utilisateur, risque légal, jamais affiché |

## Notes v8.0 — Modèle unifié user_parfum + possessions (26/07/2026)

**Refonte du modèle de données utilisateur.** Fusion de `wardrobe` + `scentlist` en une seule table `user_parfum` (parcours unifié). Les objets physiques (flacon, décant, échantillon) deviennent des `possessions` multiples par parfum. Le cœur (`favoris`) reste une table séparée et indépendante.

**Nouveau modèle :**
- `user_parfum` (PK: user_id + parfum_id) — statut (`to_try | tried | want | have | had`), verdict, rating, notes, tried_at, shelf_ids, sotd_count, is_signature + champs dénormalisés
- `possessions` (PK: uuid, FK → user_parfum) — type (`bottle | decant | sample`), size_ml, quantity, for_sale, notes
- `favoris` — inchangé (cœur léger, indépendant du statut)

**Principes :**
- Un parfum = une seule ligne dans `user_parfum`, son statut avance dans le temps (transitions libres, pas linéaires)
- Possessions multiples : 1 flacon 100ml + 2 décants 5ml = 3 rows
- Le cœur est orthogonal au statut (on peut aimer sans posséder, posséder sans aimer)
- Plus de "déplacement" entre tables — un changement de statut est un simple UPDATE
- `had` garde tout en mémoire (verdict, rating, étagères, SOTD) — utile pour les algos de reco

**Migration SQL** : `0021_unified_user_parfum.sql` — nouvelles tables + backfill depuis wardrobe/scentlist + RPCs mises à jour (set_sotd, delete_shelf, export_user_data v3, personalized_suggestions v3) + suppression des RPCs move_* obsolètes. Appliquée sur le cloud (`supabase db push`).

**Fichiers créés** : `src/models/user-parfum.interface.ts`, `src/services/impl/user-parfum.supabase.ts`, `src/services/impl/possessions.supabase.ts`, `src/services/user-parfum.ts`, `src/services/possessions.ts`, `src/hooks/useUserParfum.ts`, `src/hooks/usePossessions.ts`, `__tests__/services/user-parfum.test.ts`

**Fichiers supprimés** : `wardrobe.interface.ts`, `user-scent.interface.ts`, `user-collection.interface.ts`, `wardrobe.supabase.ts`, `scentlist.supabase.ts`, `wardrobe.ts` (service), `scentlist.ts` (service), `useWardrobe.ts`, `useScentList.ts`, `ownership.ts`, `ownership.test.ts`, `wardrobe.test.ts`

**Fichiers réécrits** : `useSaveController.ts` (1 état au lieu de 2), `SaveSheet.tsx` (statuts + verdict + possessions), `ScentListContent.tsx` (useUserParfum), `collection.tsx`, `profile.tsx`, `wardrobe/[parfumId].tsx`, `history.tsx`, `useProfileStats.ts`, `useShelves.ts`, `useSotd.ts`, + 10 composants wardrobe (WardrobeCard, WardrobeGrid, WardrobeQuickSheet, WardrobeAddSheet, FilterBar, SOTDPicker, SOTDCard, ShelfManager, ScentCard, TrySheet)

**Scripts images** : inchangés (opèrent sur `parfums.image_url`/`image_url_2x`, pas sur les tables user).

**Tests** : 18 suites, 204 tests. `tsc --noEmit` : 0 erreur app/ + src/.

## Notes v8.1 — Refonte UX : 2 onglets, fiche unifiée, « Ma Parfumerie » (26/07/2026)

**Refonte UX majeure** (aucun changement de modèle de données — v8.0 inchangé). Objectif : réduire la charge cognitive, unifier les surfaces qui faisaient doublon (cœur vs statut `want`, Carnet vs Parfumerie, fiche catalogue vs fiche perso).

**Navigation : 4 onglets → 2 onglets + FAB + avatar.**
- Onglets : **Catalogue** | **Ma Parfumerie** + **FAB Scan** central (DockBar = 2 onglets + FAB uniquement, sans avatar).
- `DockBar` : géométrie recalculée pour 2 onglets + FAB centré symétrique (`getIndicatorLeft` 2 tabs).
- **Accès profil** : avatar rond (photo Google ou icône `person-outline`) en haut à droite de la page, dans `SearchChrome` (à droite de la barre de recherche) → pousse la route racine `/profile`. Visible sur les 2 onglets.
- **Profil** : déplacé `app/(tabs)/profile.tsx` → `app/profile.tsx` (route racine Stack, `slide_from_right`, bouton retour). `NAV_ROWS` simplifié (Ma Parfumerie + Historique), chips de statut sur le modèle 3 chips, sans `useNavigationChrome` (hors tabs).
- **Supprimé** : l'onglet `selection.tsx` (Favoris/Carnet segmentés).

**Modèle de statut : 5 statuts DB → 3 chips UI.**
- `src/utils/status-chips.ts` : `STATUS_CHIPS` = **À sentir** (`to_try`) / **Je l'ai** (`have`) / **Fini** (`had`). `chipForStatus()` mappe les 5 statuts DB vers 3 chips (`want` + `tried` → « À sentir ») ; `statusChipMeta()`. Le modèle DB (v8.0) ne change pas, `want` devient invisible en UI.
- `src/utils/verdicts.ts` : `VERDICT_OPTIONS` relocalisé hors de `TrySheet` (+ helper `verdictLabel`).
- `STATUS_LABELS` (useSaveController) aligné sur le nouveau vocabulaire (À sentir / Senti / Je l'ai / Fini).

**Fiche unifiée.**
- `app/catalog/[id].tsx` absorbe la fiche personnelle : nouvelle section **« Ma relation »** (`src/features/catalog/RelationSection.tsx`, conditionnelle à l'existence d'une relation) — 3 chips statut inline, verdict, rating (`StarRating`), notes éditables, possessions, étagères, signature, SOTD, retirer.
- `app/wardrobe/[parfumId].tsx` → **redirect** vers `/catalog/[parfumId]` (tous les liens existants — SOTDCard, profil — continuent de fonctionner).
- `useSaveController` étendu : `setRating`, `setNotes`, `toggleShelf`, `toggleSignature` (optimistes avec rollback). Le bouton « Enregistrer » flow n'apparaît que s'il n'y a pas encore de relation.

**Ma Parfumerie (onglet `collection.tsx` réécrit).**
- `src/utils/my-parfums.ts` : `buildMyParfums(favoris, userParfums)` — **union** favoris + user_parfum (dédup `parfumId`, `user_parfum` source du statut, le favori comble l'affichage et pose `isFav`), `pillOfItem`/`filterByPill`, `myParfumToCard`, `MY_PARFUM_PILLS`. Structurellement compatible `FilterableItem` (réutilise `matchesFavoriFilters`/`favoriMatchesSearch`).
- **5 pills** : Tous · ❤️ À statuer · À sentir · Je l'ai · Fini (avec compteurs). « À statuer » = favoris sans ligne `user_parfum`.
- Grille `ParfumCard` (densité partagée) + **badge statut/rating** dans le body (props optionnelles `status`/`rating`, modes comfortable/compactPlus/list).
- **Long-press universel** : `src/components/StatuerSheet.tsx` — Voir la fiche / 3 chips statut inline / Retirer (« Retirer des favoris » si `status === null`, sinon « Retirer de ma parfumerie »).
- Préservés : SOTD + météo (bannière `SOTDCard`), étagères (`ShelfManager`), `FilterSheet` attributs, recherche, tri (Récents / Mieux notés / A–Z / Z–A). **Tri « Météo » de la grille retiré** (le scoring exige `sotdCount`, absent de l'union) — scoring météo conservé pour le SOTD/`SOTDPicker`.

**Fichiers créés** : `src/utils/status-chips.ts`, `src/utils/verdicts.ts`, `src/utils/my-parfums.ts`, `src/features/catalog/RelationSection.tsx`, `src/components/StatuerSheet.tsx`, `app/profile.tsx`, `__tests__/utils/my-parfums.test.ts`

**Fichiers supprimés** : `app/(tabs)/selection.tsx`, `app/(tabs)/profile.tsx`, `src/features/favorites/FavoritesContent.tsx` (+ dossier `favorites/`), `src/features/scentlist/ScentListContent.tsx`, `ScentCard.tsx`, `ScentListEntry.tsx`, `src/features/wardrobe/WardrobeGrid.tsx`, `WardrobeCard.tsx`, `WardrobeQuickSheet.tsx`, `FilterBar.tsx`

**Code mort retiré** : check `pathname === '/profile'` + `usePathname` dans `SearchChrome` (le profil n'est plus un onglet), style `avatarActive` du DockBar.

**Conservés** : `TrySheet`, `useSaveController`, `SaveSheet` (toujours utilisés par la fiche pour « Notes détaillées ») ; `wardrobe/` garde `ShelfManager`, `SOTDCard`, `SOTDPicker`, `StarRating` ; `scentlist/` garde `TrySheet`.

**Lacune connue (à traiter)** : un favori « à statuer » qu'on statue crée une ligne `user_parfum` sans champs de filtre (tenue/sillage/saison) → non filtrable par attributs tant que non backfillé.

**Tests** : 19 suites, 218 tests (+14 `my-parfums`). `tsc --noEmit` : 0 erreur app/ + src/.

## Notes v8.2 — Ma Parfumerie : vocabulaire statuts, densité en icônes, prix masqué, filtre ♥ (27/07/2026)

**Refonte UX de l'onglet Ma Parfumerie** (aucun changement de modèle de données — v8.0/v8.1 inchangés). Objectif : lever la confusion entre le cœur (intérêt) et le statut (relation), et alléger un header qui empilait 4 rangées de contrôles ambigus.

**Vocabulaire des statuts — « À statuer » supprimé.** La pill `to_stat` est retirée de `MY_PARFUM_PILLS` et de `PillId` (`my-parfums.ts`). `pillOfItem` perd sa branche `status === null` : un cœur sans ligne `user_parfum` tombe désormais dans « À sentir » (`chipForStatus(status) ?? 'to_try'`) — un seul geste = une seule case, plus d'étape administrative « statuer ». Les 4 pills deviennent **Tous · À sentir · Je l'ai · Fini**. Renommage « Je l'ai eu » → **Fini** (lève l'ambiguïté avec « Je l'ai »). Icônes : « À sentir » `eyedrop-outline` → `eye-outline` (à *voir/sentir*, pas à *saisir*) ; « Fini » `flag-outline` → `archive-outline`. Le libellé de section « Statuer » de `StatuerSheet` devient **« Ton statut »**. Le vocabulaire est désormais unique et partagé pills = chips fiche (`STATUS_CHIPS`) = badges carte.

**Sélecteur de densité en icônes (Ma Parfumerie).** Les 3 segments texte `Confort/Compact/Liste` (qui mangeaient ~210 px et tassaient les pills) deviennent 3 boutons icônes via `DENSITY_ICON` (`grid-outline`/`apps-outline`/`list-outline`), conforme au design-guide §4.17. *Dette assumée* : Catalogue/Recherche/Perfumer conservent le toggle texte (inchangé, pas de régression) — à aligner plus tard si uniformité souhaitée.

**Prix masqué en contexte perso.** Nouvelle prop `hidePrice?: boolean` sur `ParfumCard` (sans effet sur les 8 autres écrans). `collection.tsx` la passe → plus de `— €` ni de badge `-X%` dans Ma Parfumerie (vue de relation, pas d'achat ; pas de tri par prix ni de total).

**Badge statut cohérent.** `renderItem` passe `status={item.status ?? (item.isFav ? 'to_try' : null)}` : un cœur sans statut affiche le badge « À sentir », identique à sa pill — plus de décalage visuel cœur-rouge-vs-badge.

**Filtre ♥ transversal.** Bouton `favOnly` ajouté dans la `searchRow` (à droite du tri/filtres) : `heart-outline` gris (éteint) / `heart` rouge sur `favoriteSoft` (actif). C'est un filtre qui se **cumule** avec la pill active, l'étagère et la recherche (ex. « Je l'ai » + ♥ = coups de cœur possédés) — pas un onglet, donc zéro doublon et modèle `isFav`/`status` indépendant préservé. Inclus dans `handleGlobalReset`.

**Fichiers** : `src/utils/status-chips.ts`, `src/utils/my-parfums.ts`, `src/components/ParfumCard.tsx`, `app/(tabs)/collection.tsx`, `src/components/StatuerSheet.tsx` (modifiés) ; `__tests__/utils/my-parfums.test.ts` (2 tests réécrits : `pillOfItem(null) → to_try`, `filterByPill('to_try')` regroupe statués + cœurs).

**Docs** : `rules.md` (§2 arborescence + components), `reference.md` (§5 `my-parfums`/`PillId`/`pillOfItem`, §6 `StatuerSheet`/`ParfumCard.hidePrice`), `README.md` (tableau + arborescence + components + récap v8.1) resynchronisés.

**Tests** : 19 suites, 218 tests. `tsc --noEmit` : 0 erreur app/ + src/.

## Notes v8.3 — Tab Favoris restauré + Alertes prix v2 (4 onglets) (22/08/2026)

**Refonte navigation + alertes** (aucun changement du modèle `user_parfum`/`favoris` v8.0 — les deux tables restent orthogonales). Objectif : redonner aux favoris leur rôle de couche *intention* (convoitise + alertes) et faire de la Parfumerie la couche *collection* (organisation à la Fragrantica). La fusion v8.1 (favoris ⊂ Ma Parfumerie) est revenue en arrière : elle mélangeait deux concepts que la v8.2 a dû patcher, et masquait les alertes prix (aucun écran de gestion).

**Navigation : 2 onglets → 4 onglets + FAB.**
- **Catalogue | Favoris [FAB] Parfumerie | Communauté** — géométrie symétrique 2+2, FAB Scan centré (mémoire du geste préservée). `DockBar.getIndicatorLeft` réécrit (4 slots), `TAB_MAP` 4 entrées (`book`/`heart`/`flask`/`people`).
- **Communauté = placeholder** « Bientôt » (`app/(tabs)/communaute.tsx`, sans auth) — le slot est prêt ; l'aspect communautaire (follow, partage de collection, « nez compatibles » via overlap des verdicts) est brainstormé mais non construit.

**Tab Favoris restauré** (`app/(tabs)/favoris.tsx`) — tous les ❤️, rien ne disparaît jamais (modèle orthogonal v8.0 enfin reflété en UI) :
- Grille `ParfumCard` (densité partagée, **prix visibles** — couche intention = achat) + badges **statut** (si statué) et **🔔 −X%** (si alerte).
- Section **« Tes alertes »** en haut (si ≥ 1) : rangée horizontale, prix actuel vs prix à l'activation, variation, cible, tri par plus grosse baisse, toggle off rapide.
- Pills **Tous · À traiter · Alertes** (« À traiter » = l'inbox en *filtre*, pas en règle structurelle) + recherche.
- Long-press → `FavoriSheet` : **Voir la fiche · Alerte prix · Envoyer dans ma parfumerie** (chips statut ; graduation = set statut, l'item *reste* dans Favoris avec son badge) **· Retirer des favoris**.

**Alertes prix v2 :**
- **Prix cible custom pré-rempli** : `price_alerts.target_price` (nullable ; null = logique historique −10%/−5€) + `initial_price` (ancre « −X% depuis l'alerte »). `suggestTargetPrice()` : proche de l'officiel → `référence × 0.75`, déjà en promo → `best_price × 0.9`, arrondi au palier de 5 €.
- **`price_history`** (1 ligne/parfum/jour, alimentée par le cron) — ancre « Plus bas constaté : X € » dans la sheet, futur graphe d'évolution.
- **`onPriceAlerts(uid)`** : subscription realtime (la table rejoint la publication `supabase_realtime`), hook `usePriceAlerts` (`byParfumId` Map).
- **`PriceAlertSheet`** (composant canonique) : toggle + mode « Une baisse / Sous X € » + stepper ±5 € + plus bas constaté. **Surface d'alerte unique** — utilisée par le tab Favoris ET la fiche détail (`AlertPriceToggle` devient une row qui l'ouvre).
- **Edge Function `check-price-alerts`** : déclenche si `best_price ≤ target_price` (sinon baisse ≥10%/≥5€), écrit `price_history`, push différencié (« 🎯 Prix cible atteint » vs « 💰 Baisse de prix »). Helper `targetReached()`.

**Tab Parfumerie simplifié** (`collection.tsx` réécrit) : source = `user_parfum` uniquement (**fin de l'union `buildMyParfums`**), pills statut (Tous · À sentir · Je l'ai · Fini), filtre ♥ conservé (coups de cœur de la collection), badge 🔔 ajouté, SOTD/météo/étagères/FilterSheet/tri préservés. `my-parfums.ts` + son test supprimés.

**Fichiers créés** : `supabase/migrations/0022_price_alerts_v2.sql`, `src/models/user-price-alert.interface.ts`, `src/hooks/usePriceAlerts.ts`, `src/utils/price-alerts.ts`, `src/components/PriceAlertSheet.tsx`, `src/components/FavoriSheet.tsx`, `app/(tabs)/favoris.tsx`, `app/(tabs)/communaute.tsx`, `__tests__/utils/price-alerts.test.ts`.
**Fichiers modifiés** : `check-price-alerts/index.ts`, `_shared/helpers.ts`, `user-data.supabase.ts` (`onPriceAlerts`/`setPriceAlert` étendu/`getLowestObservedPrice`), `models/index.ts`, `DockBar.tsx`, `(tabs)/_layout.tsx`, `collection.tsx`, `ParfumCard.tsx` (prop `priceAlert`), `AlertPriceToggle.tsx`, `catalog/[id].tsx`.
**Fichiers supprimés** : `src/utils/my-parfums.ts`, `__tests__/utils/my-parfums.test.ts`.

**⚠️ Migration à appliquer** : `supabase db push` (0022 — `target_price`, `initial_price`, `price_history`, publication realtime de `price_alerts`).

**Tests** : 19 suites, 215 tests. `tsc --noEmit` : 0 erreur app/ + src/.

## Notes v8.4 — Communauté Phase 1 : profils publics & partage (landing SSR) (15/09/2026)

**Amorce de l'aspect communautaire** (aucun changement du modèle `user_parfum`/`favoris`). Parti pris : commencer par la brique la plus sûre — **pas de feed, pas d'UGC modéré, pas de follow** — profils publics opt-in + partage via un landing SSR qui fait l'acquisition (aperçu riche + store). Les agrégats anonymes et les « nez compatibles » (taste twins) sont reportés (cold-start : 0 utilisateur réel, pas encore de matière).

**Profils publics (opt-in)** :
- Table `profiles` (migration 0023) : `pseudo` unique (slug 3-20 car., `^[a-z0-9][a-z0-9_-]{1,18}[a-z0-9]$`), `avatar_url` (photo Google — **pas d'upload**, zéro modération image), `bio` (≤ 140), `is_public` (défaut `false`). RLS : owner-all + lecture publique des profils publics uniquement.
- RPC `public_profile(pseudo)` + `public_collection(pseudo)` (`SECURITY DEFINER`, filtrées `is_public = true`) : identité + statut + verdict + rating + best_price, **notes personnelles exclues**.
- Service `profile.ts` (`getMyProfile`, `upsertMyProfile`, `getPublicProfile`, `getPublicCollection`), hooks `useMyProfile` / `usePublicProfile`, modèle `profile.interface.ts`.

**Partage & landing** :
- Edge Function `share` (`--no-verify-jwt`, publique) : `?type=parfum&id=` / `?type=profile&pseudo=` → HTML SSR on-brand + **balises OG/Twitter** (aperçu riche iMessage/WhatsApp/Instagram) + bouton « Ouvrir dans ParfumScan » (deep link `parfumscan://`) + mention store. Valeurs échappées (anti-XSS), données publiques uniquement. **Déployée + testée** (404 brandé pour un profil privé/introuvable).
- Util `share.ts` : `parfumShareUrl` / `profileShareUrl` (landing https), `parfumDeepLink` / `profileDeepLink`, `isValidPseudo` / `normalizePseudo`.
- 3 surfaces de partage : **fiche détail** (`handleShare` → landing, remplace l'ancien deep link brut qui ne touchait que les installés) · **Ma Parfumerie** (bouton header, visible seulement si profil public) · **SOTD** (long-press sur la bannière, message « Aujourd'hui je porte… »).

**UI** :
- `PublicProfileCard` (section « PROFIL PUBLIC » de `profile.tsx`) : pseudo + bio + toggle « Collection publique » + validation (code 23505 → « Ce pseudo est déjà pris ») + boutons Partager / Voir mon profil.
- Route publique `app/u/[pseudo].tsx` (lecture seule, **accessible sans auth**) : en-tête profil + grille `ParfumCard` (statut/rating du propriétaire ; le cœur reste l'action du visiteur), état « Profil privé ou introuvable ». Cible du deep link `parfumscan://u/<pseudo>`.

**Fichiers créés** : `supabase/migrations/0023_public_profiles.sql`, `src/models/profile.interface.ts`, `src/services/impl/profile.supabase.ts` + `src/services/profile.ts`, `src/hooks/useMyProfile.ts`, `src/hooks/usePublicProfile.ts`, `src/utils/share.ts` (+test), `src/components/PublicProfileCard.tsx`, `app/u/[pseudo].tsx`, `supabase/functions/share/index.ts`.
**Fichiers modifiés** : `models/index.ts`, `profile.tsx`, `collection.tsx` (partage collection + SOTD), `catalog/[id].tsx` (`handleShare` landing), `SOTDCard.tsx` (prop `onShare`), `_layout.tsx` (route `u/[pseudo]`).

**⚠️ Déploiement** (fait en session) : `supabase db push` (0023) + `supabase functions deploy share --no-verify-jwt`.

**Note cold-start** : le partage sert d'abord l'acquisition (boucle virale au lancement). Le bouton « Télécharger » du landing est un placeholder tant que l'app n'est pas en store ; les URLs store réelles seront à renseigner dans `share/index.ts` (`STORE_NOTE`).

**Tests** : 20 suites, 222 tests. `tsc --noEmit` : 0 erreur app/ + src/.