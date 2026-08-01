# Sillage — Environment & Commands (v8.0)

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
react-native-draggable-flatlist ^4.0 (réordonnancement des étagères, JS pur — pas de rebuild natif)
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
Refonte catalogue v2 — structure hybride rangées éditoriales + grille filtrable. Suppression chips famille olfactive (remplacés par dilution dans sections nommées + cartes d'ambiance « Explorer par famille »). Capsules marques rectangulaires (top 10 + « Toutes → »). `ParfumCard` 4 modes : `compact` (rangées, 140px), `comfortable` (grille défaut, tags+notes+price dot), `compactPlus` (grille dense, image 90px), `list`. Price dots colorés deal/fair/overpriced. Densité persistée AsyncStorage (`@sillage/catalog-density`), partagée catalogue + recherche. Recherche : chips famille supprimées, contrôles de densité identiques à la grille. Nouveaux composants : `BrandCapsules`, `CatalogRow` (collapse/expand), `FamilyAmbianceCards` (6 cartes theme-aware avec Ionicons). Nouveau hook : `useDensityPreference`.

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

**Images HD (upscale ×4)** : pipeline `scripts/images/migrate-upscale.ts` (`npm run migrate-upscale`) — pool de workers Python **persistants** (Real-ESRGAN + CUDA, venv isolé `scripts/images/upscale/`, modèle chargé une fois, jobs en JSON-lines stdin/stdout). Génère `primary_2x.webp` (1500×2000) + colonne `parfums.image_url_2x` (migration 0017). Débit ~0,5 img/s (sériel : GPU + I/O 1500×2000 + 3 allers-retours Supabase ; la concurrence n'accélère pas) → ~24K images en ~10h, resumable. Setup venv : `uv venv --python 3.10` + torch cu124 + realesrgan + `patch_basicsr.py` (torchvision≥0.17). **Câblage app** : `DetailHero` + `ImageViewerPopup` affichent la 1x (déjà en cache) puis fondent vers la 2x (`transition` expo-image, `key={imageUrl2x}`) ; listes/grilles restent en 1x. Champ `Parfum.imageUrl2x`, mappé dans `rowToParfum`/`WRITE_MAP`.

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
**Schéma** : `supabase/migrations/0001_extensions.sql` → `0006_functions.sql` — validé par `supabase db reset` + `supabase/smoke-test.sql` (12 tests, rejouable via `Get-Content supabase/smoke-test.sql | docker exec -i supabase_db_sillage psql -U postgres -d postgres`).
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
data/raw/ (1.27 GB, non versionné) → data/clean/ (31 MB) → Postgres parfums + Storage parfum-images
```

### Scripts

Scripts organisés en `scripts/fragrantica/` (pipeline catalogue), `scripts/images/` (pipeline images) et `scripts/lib/` (helpers partagés).

| Commande | Fichier | Rôle |
|---|---|---|
| `npm run clean-data` | `scripts/fragrantica/clean-apify.ts` | Nettoie les 193 JSON scrapés : débruite, déduplique, strip champs traçants |
| `npm run scrape-designers` | `scripts/fragrantica/scrape-designers.ts` | Scrape la liste complète des marques Fragrantica + nombre de parfums (11 pages `/designers-N/` + 7 marques commençant par un chiffre absentes de l'index, via curl.exe — le WAF bloque Node fetch) → `data/designers.json` + `.csv` |
| `npm run watch-designers` | `scripts/fragrantica/watch-designers.ts` | **Watch (étage 1)** : snapshot de `designers.json` dans `data/designers-history/` + diff vs run précédent (marques apparues/disparues/deltas de compteur) → `data/watch/delta-<date>.json` |
| `npm run diff-brands` | `scripts/fragrantica/diff-brands.ts` | **Diff marque (étage 2)** : scrape les pages des marques à delta (ou `--brands=`), compare à la BDD (même formule d'id qu'`import-fresh`, lecture seule) → file des nouveaux parfums `data/watch/queue-<date>.json`. Flags : `--target=cloud`, `--brands=a,b`, `--delta=<fichier>`, `--all-new-brands` |
| `npm run scrape-perfumes` | `scripts/fragrantica/scrape-perfumes.ts` | **Scrape fiches (étage 3)** : fiches parfums Fragrantica au format Apify. Deux modes : `--format=raw` (défaut, chaîne `clean-data` → `import-fresh`) ou `--format=clean` (**v2** : écrit directement `data/clean`, merge par id calculée — ⚠️ ne pas relancer `clean-data` derrière ; `--format=both` = les deux). Déchiffre le payload `status` (votes) via `scripts/lib/mfga-fes.js`. Entrées : file queue (défaut), `--brands=`, `--urls=`. Options : `--out-dir=`, `--limit=`, `--refresh`, `--dry-run` |
| `npm run import-fresh` | `scripts/fragrantica/import-fresh.ts` | **Import frais** (depuis `data/clean/`) : transforme, télécharge l'image (URL Fragrantica), bg removal optionnel (`--bg`), WebP, upload Storage + upsert Postgres. Idempotent/resumable. Laisse `image_url_2x` NULL |
| `npm run import-supabase` | `scripts/fragrantica/import-supabase.ts` | Upsert Postgres (local ou `--target=cloud`) |
| `npm run migrate-upscale` | `scripts/images/migrate-upscale.ts` | **Upscale HD ×4** — workers Python Real-ESRGAN + CUDA, génère `primary_2x.webp` + `image_url_2x` (fiche détail/lightbox), resumable |
| `npm run generate-notes` / `upload-notes` | `scripts/images/generate-note-images.ts` / `upload-note-images.ts` | Images de notes olfactives (DashScope Wanx) + upload Storage |

**Flux nouveau scrape** : `clean-data` → `import-fresh --target=cloud` → `migrate-upscale`.
**Flux incrémental (veille)** : `scrape-designers` → `watch-designers` → `diff-brands --target=cloud` → `scrape-perfumes` → `clean-data` → `import-fresh --target=cloud` → `migrate-upscale`.

### Authentification import

Nécessite la clé service_role Supabase (scripts d'import/migration uniquement) :
1. Renseigner `SUPABASE_SERVICE_ROLE_KEY` dans `.env` (gitignoré)
2. Les scripts lisent `.env` (`EXPO_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`)
3. `migrate-upscale` nécessite en plus le venv `scripts/images/upscale/venv` (voir `scripts/images/upscale/README.md`)
4. **Proxy scraping (optionnel)** : `SCRAPER_PROXY` dans `.env` (format `http://[user:pass@]host:port`, résidentiel rotatif recommandé) — utilisé par `fetchFragrantica` (tous les scripts scrape-*/diff-brands), log sans credentials. Vide = connexion directe. Les délais inter-requêtes sont jitterisés (`sleepJitter`, ±~35 %) pour éviter une signature de cadence fixe.

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
- Edge Function `share` (`--no-verify-jwt`, publique) : `?type=parfum&id=` / `?type=profile&pseudo=` → HTML SSR on-brand + **balises OG/Twitter** (aperçu riche iMessage/WhatsApp/Instagram) + bouton « Ouvrir dans Sillage » (deep link `sillage://`) + mention store. Valeurs échappées (anti-XSS), données publiques uniquement. **Déployée + testée** (404 brandé pour un profil privé/introuvable).
- Util `share.ts` : `parfumShareUrl` / `profileShareUrl` (landing https), `parfumDeepLink` / `profileDeepLink`, `isValidPseudo` / `normalizePseudo`.
- 3 surfaces de partage : **fiche détail** (`handleShare` → landing, remplace l'ancien deep link brut qui ne touchait que les installés) · **Ma Parfumerie** (bouton header, visible seulement si profil public) · **SOTD** (long-press sur la bannière, message « Aujourd'hui je porte… »).

**UI** :
- `PublicProfileCard` (section « PROFIL PUBLIC » de `profile.tsx`) : pseudo + bio + toggle « Collection publique » + validation (code 23505 → « Ce pseudo est déjà pris ») + boutons Partager / Voir mon profil.
- Route publique `app/u/[pseudo].tsx` (lecture seule, **accessible sans auth**) : en-tête profil + grille `ParfumCard` (statut/rating du propriétaire ; le cœur reste l'action du visiteur), état « Profil privé ou introuvable ». Cible du deep link `sillage://u/<pseudo>`.

**Fichiers créés** : `supabase/migrations/0023_public_profiles.sql`, `src/models/profile.interface.ts`, `src/services/impl/profile.supabase.ts` + `src/services/profile.ts`, `src/hooks/useMyProfile.ts`, `src/hooks/usePublicProfile.ts`, `src/utils/share.ts` (+test), `src/components/PublicProfileCard.tsx`, `app/u/[pseudo].tsx`, `supabase/functions/share/index.ts`.
**Fichiers modifiés** : `models/index.ts`, `profile.tsx`, `collection.tsx` (partage collection + SOTD), `catalog/[id].tsx` (`handleShare` landing), `SOTDCard.tsx` (prop `onShare`), `_layout.tsx` (route `u/[pseudo]`).

**⚠️ Déploiement** (fait en session) : `supabase db push` (0023) + `supabase functions deploy share --no-verify-jwt`.

**Note cold-start** : le partage sert d'abord l'acquisition (boucle virale au lancement). Le bouton « Télécharger » du landing est un placeholder tant que l'app n'est pas en store ; les URLs store réelles seront à renseigner dans `share/index.ts` (`STORE_NOTE`).

**Tests** : 20 suites, 222 tests. `tsc --noEmit` : 0 erreur app/ + src/.

## Notes v8.6 — Durcissement post-audit + typage Supabase (M4) (16/09/2026)

**Audit du projet** (4 agents en parallèle + vérifs mécaniques grep/tsc) → correction des problèmes trouvés.

**Critiques** :
- **C1** — `0024_missing_grants.sql` : GRANTs client omis sur `profiles`/`price_history` (création de profil public + « plus bas constaté » cassés en fresh DB ; l'auto-exposition des tables est désactivée au niveau projet).
- **C2** — helper `toNum` (sql-utils côté app + `_shared/helpers` côté Deno) généralisé : tous les mappers `numeric`→string corrigés. PostgREST renvoie les colonnes `numeric` en **string** ; `typeof === 'number'` retournait toujours null (rating, prix, scores, `targetPrice`/`initialPrice`/`lastPrice` cassés silencieusement).
- **C3** — rethrow des écritures `user-parfum`/`user-data` (`addUserParfum`, `updateUserParfum`, `markTried`, `removeUserParfum`, `removeFavori`, `setSotd`) → les rollbacks optimistes de `useSaveController`, `FavorisContext`, `useSotd` (qui étaient du code mort) fonctionnent à nouveau.

**Moyen** : **M1** compte RGPD `wardrobe`→`user_parfum` (table morte) · **M3** guards de démontage (`mountedRef`) sur `usePossessions`/`useMyProfile`/`useSotd`/`useProfileStats` · **M5** `renderItem` de `search.tsx` mémoïsé (`useCallback`) · **M6** `rowToUserParfum` dédoublonné (`useProfileStats` réutilise le mapper exporté du service) · **M2** `reference.md` purgé (9 fonctions + 2 modèles + hook `useWishlist` morts retirés).

**Faible** : **F1** 3 exports orphelins supprimés (`isParfumFavori`, `isPriceAlertActive`, `getAllPossessions`) · **F2** `transcribe-voice` (`atob` déplacé dans un try → 400 sur base64 invalide) + `analyze-perfume-image` (whitelist MIME stricte jpeg/png/webp, plus de svg) · **F3** `0025_admins_rls_self_only.sql` (lecture `admins` restreinte à `auth.uid() = user_id`, la liste des admins n'est plus exposée à tout authentifié) · **F6** timer `useWeather` nettoyé (`clearTimeout` via `.finally`). **F7** (hex hardcodés `#0B0712` + PALETTE placeholder) accepté — exceptions invariantes documentées §2.3/§4.1.

**M4 — Typage Supabase** : `src/types/database.types.ts` généré via `supabase gen types typescript --linked`, client typé `createClient<Database>`. Helpers à table dynamique (`subscribeUserTable`, `count`/`deleteAllFrom` d'account) typés via `UserTableName` (type dérivé = tables possédant `user_id`). `as never` retiré de tous les payloads d'écriture : littéraux vérifiés contre `Insert`/`Update` (détection des typos de colonne à la compilation), variables `row` typées (`updateUserParfum`, `updatePossession`), casts précis `as Tables[...]['Insert'/'Update']` pour les cas dynamiques (`addUserParfum`, `saveScan`, `updateParfum`). Param RPC `set_sotd` `p_image_url` null→undefined (défaut NULL équivalent). Ne restent que **4 `as never` justifiés** (3 casts auth-user dans `useAuth` + 1 upsert à clé dynamique `[SETTING_KEY_MAP[key]]`).

**Déploiement** : migrations 0024/0025 appliquées (`db push`) · Edge Functions `check-price-alerts`, `share`, `transcribe-voice`, `analyze-perfume-image` redéployées (`--no-verify-jwt`, vérification JWT interne via `verifyUserToken`).

**Tests** : 24 suites, 259 tests (+ `status-chips`/`verdicts`, service `profile`, hook `usePriceAlerts`, `price-alert-helpers`). `tsc --noEmit` : 0 erreur app/ + src/.

**Reporté** (risque faible / by-design) : **F4** comparaison de secrets constant-time (timing attack théorique sur HTTP, Deno n'a pas de `timingSafeEqual` natif) · **F5** rate-limit sur `share` (mitigé par `Cache-Control` + limites Edge).

## Notes v8.7 — Étagères « meuble » + communauté d'étagères (28/07/2026)

**Transformation de l'onglet Ma Parfumerie en « meuble » visuel** (étagères = conteneurs de flacons posés sur des rayons, inspiré de Fragrantica mais habillé « luxe malin ») **+ couche communautaire par étagère** (visibilité, partage, « M'inspirer »). Le modèle `user_parfum`/`favoris`/`possessions` (v8.0) est inchangé ; on exploite la relation many-to-many `shelf_ids` déjà en base.

**Meuble privé (P0–P1).** Segmented `Collection | Étagères` en haut du tab (`collection.tsx`), vue adaptative par défaut (Étagères si matière, sinon Collection) persistée via `useParfumerieViewPreference` (`@sillage/parfumerie-view`). Mode Étagères = pile de `ShelfCard` : vues système épinglées (**Signature**, **Coups de cœur**), étagères custom, carte **Non classés**. `ShelfCard` : emblème teinté + nom + **ligne éditoriale italique** (note) + compteur + badge `globe` si publique + `⋯` + chevron ; corps = flacons nus (`BottleThumb`, `contain`, vocalisé `marque nom`) posés sur des **rayons** teintés (hairline), replié 2 lignes / déplié en grille (cascade `FadeInDown`, coupée en Reduced Motion). Le composant accepte une interface minimale `ShelfCardItem` → réutilisé privé **et** public sans cast. `ShelfManager` réécrit sur `react-native-draggable-flatlist` (drag = long-press sur poignée, JS pur → pas de rebuild natif) : réordonnancement + édition inline (nom + note + icône + couleur) + création en footer. Assignment depuis le long-press (`StatuerSheet` += section « Étagères » multi-select) + ajout direct via slot `＋` (`AddToShelfSheet`, masquage optimiste + rollback). Persistance du dépliage (`@sillage/parfumerie-shelves-expand`). Les shelf-pills de filtre quittent le mode Collection (séparation nette des axes état / rangement).

**Communauté d'étagères (P2–P3).** Visibilité par étagère (`shelves.is_public`, colonne posée en 0037) via menu `⋯` « Rendre publique / privée ». Activer le partage exige un profil public : `PublishShelfGateSheet` embarque `PublicProfileCard embedded` + `onPublicSaved` (consentement explicite, pas de pseudo auto-imposé). Partage : `shelfShareUrl`/`shelfDeepLink` + landing SSR `share?type=shelf` (OG = nom + ligne éditoriale + identité + grille de flacons). Page publique `app/u/[pseudo]/shelf/[shelfId]` (sans auth) : identité cliquable → profil + `ShelfCard` en lecture + bouton **« M'inspirer »** à 4 états (primary / outline « se connecter » / disabled « déjà dans ta parfumerie » / masqué si own-profile). « M'inspirer » = `InspireShelfSheet` : copie en lot des flacons manquants vers `to_try` via `Promise.allSettled`, diff par `inspireMissing` (ne ré-ajoute jamais un flacon déjà possédé). Sécurité : RPC `public_shelf`/`public_shelf_items` double-filtrées `shelves.is_public AND profiles.is_public`, notes perso exclues, grants `anon`+`authenticated` ; un deep link forgé vers une étagère privée renvoie `null` → « privée ou introuvable ».

**Utils / qualité.** `shelf-grouping.ts` (6 fns pures testées), `alpha.ts` (paliers §2.5, effets lumineux dark ÷2), `brand-color.ts` (extrait de `ParfumCard`). `updateShelf` passe en mapping snake explicite (ferme le piège `isPublic` → `is_public`). Fix préexistant inclus : `ParfumCard` comfortable utilisait la fonction `priceTier` comme index de couleur (point de prix cassé) → corrigé en `tier`.

**Fichiers créés** : `supabase/migrations/0037_shelves_editorial.sql` / `0038_reorder_shelves.sql` / `0039_public_shelves.sql` · `src/utils/{alpha,brand-color,shelf-grouping}.ts` · `src/hooks/useParfumerieViewPreference.ts` · `src/features/wardrobe/{BottleThumb,ShelfCard}.tsx` · `src/components/{AddToShelfSheet,PublishShelfGateSheet,InspireShelfSheet}.tsx` · `app/u/[pseudo]/shelf/[shelfId].tsx` · `__tests__/utils/{alpha,shelf-grouping}.test.ts` · `supabase/migrations/0040_shelf_items_order.sql` · `src/hooks/useShelfItems.ts` · `__tests__/services/shelf-items.test.ts`.
**Fichiers modifiés** : `app/(tabs)/collection.tsx` · `app/_layout.tsx` · `src/features/wardrobe/ShelfManager.tsx` (réécrit draggable) · `src/components/{StatuerSheet,PublicProfileCard,ParfumCard}.tsx` · `src/services/impl/{user-parfum,profile}.supabase.ts` · `src/hooks/useShelves.ts` · `src/models/{user-parfum,profile}.interface.ts` + `index.ts` · `src/types/database.types.ts` · `src/utils/share.ts` · `supabase/functions/share/index.ts` · `package.json` (+ `react-native-draggable-flatlist`).
**Fichiers supprimés** : aucun.

**Ordre & pin des flacons (B-réel).** Table `shelf_items` (position + pin par étagère, 0040) ; `shelf_ids` conservé comme cache d'appartenance maintenu en miroir par 4 RPC atomiques (`add_to_shelf`/`remove_from_shelf`/`pin_shelf_item`/`reorder_shelf_items`) — le client n'écrit plus `shelf_ids` à la main (zéro désync). Hook `useShelfItems` (subscription realtime) → tri « Personnalisé » = pin desc + position asc, avec **fallback** sur l'ordre d'ajout si la migration n'est pas poussée (rien ne casse). `ShelfCard` : bouton ↕ (tri Personnalisé/Nom/Maison/Famille/Récents, options dérivées du variant ; `ShelfCardItem` enrichi de `familleOlactive`/`addedAt`). `StatuerSheet` : section « Épinglé en tête de » (chips par étagère active, icône ★). Les RPC publiques `public_shelf(_items)` lisent désormais `shelf_items` (ordre pin+position respecté côté page publique).

**Tests** : 27 suites, 287 tests (+1 suite `shelf-items` : 5 tests sur les RPC d'ordre/pin). `tsc --noEmit` : 0 erreur app/ + src/.

**⚠️ Dettes / à faire (non bloquantes pour le code, bloquantes pour le réel).**
- **Rendu jamais validé à l'écran** : les 4 paliers sont compilés et testés mais n'ont pas été lancés → `start.bat` (ou `start.bat build`) requis pour vérifier rayons, vignettes détourées en dark, geste de drag, gate sur petit écran.
- **Serveur à déployer** : `0038` + `0039` à pousser (`supabase db push`) et Edge Function à redéployer (`supabase functions deploy share --no-verify-jwt`) pour que le réordre-écriture, la lecture publique, la landing et « M'inspirer » vivent côté serveur. (`0037` déjà poussé → le toggle `is_public` fonctionne déjà.)
- **WIP non committé mélangé** : le working tree contient aussi des travaux antérieurs à cette feature (favoris, fiche détail, scan, possessions, contexts `UserParfumContext`/`PriceAlertsContext` non trackés, `0035`/`0036`…). Notre code importe `UserParfumContext`, donc la feature n'est **pas isolable par commit sélectif propre** → commiter en bloc après validation visuelle, ou tri fin via `git add -p`.
- **Reporté (P3 spéculatif, conditionné aux données)** : follow d'étagère, nez compatibles étagère-par-étagère, frise de port SOTD.
- **Mineur** : `ShelfManager` sans `KeyboardAvoidingView` ; hypothèse d'assets détourés à confirmer visuellement.

## Notes v8.8 — DockBar refonte : compact au scroll, indicateur pill/halo, FAB obturateur (29/07/2026)

**Restylage complet de la DockBar** (aucun changement de modèle de données ni de navigation — les 4 onglets + FAB restent identiques). Objectif : une barre plus premium et toujours utile, inspirée du collapse de Revolut mais signée « luxe malin ».

**Comportement 3 états** (`NavigationChromeContext` : nouvelle machine à états + `dockCompact` SharedValue, en plus de `dockTranslateY`). **Expanded** en haut de page (icônes + labels, hauteur 64). **Compact** dès ~30 px de scroll descendant : les labels s'effondrent (opacité + hauteur → 0, l'icône se recentre), la barre s'amincit (hauteur 50) et le FAB, la barre rétrécissant autour de lui, **émerge** de quelques pixels (retrait de `overflow: 'hidden'` sur la barre ; le flou/overlay sont clipés par leur propre `borderRadius`). **Hidden** si le scroll est rapide (vélocité par frame > seuil) ou profond (y > ~320 px) : la barre glisse hors écran comme avant, mais déclenchée par la vélocité, pas par un seuil bas → le FAB reste tappable en lecture posée. **Reveal** en remontant : la barre réapparaît en *compact* et ne rouvre en *expanded* qu'une fois tout en haut (fini l'effet yo-yo). `resetDock()` (changement d'onglet) force expanded + visible. Deux SharedValues « cible logique » (`compactTarget`/`hideTarget`) évitent de relancer `withTiming` à chaque frame de scroll.

**Indicateur d'onglet actif : le trait doré est retiré.** Raisons : pattern material-top-tab daté, déconnecté des icônes, et surtout violation de la règle « un seul accent par écran » (§2.4 — violet du FAB + violet de l'icône active + doré = conflit interdit). Remplacé par une **pill** `primarySoft` derrière l'icône active qui glisse d'onglet en onglet au spring existant, et se dissout en **halo** `tintLuminous` (palier `hint` outer / `veil` inner, règle §2.5 dark ÷2 automatique) quand la barre se compacte — crossfade piloté par `dockCompact` (la pill fade out sur [0→0.5], le halo fade in sur [0.4→1]). Géométrie : `getIndicatorLeft` renommé **`getTabCenter`** (retourne le centre de l'onglet ; chaque couche déduit son `translateX`). Un seul accent sur la barre : le violet.

**FAB obturateur** (le disque violet plat + pulse faisait « cheap »). Reconstruit en déclencheur d'appareil : anneau `primary` avec un `LinearGradient` vertical (rim light blanc en haut + ombrage en bas = volume, invariants §2.3) cerclant un disque intérieur creux (son propre gradient concave). **Le pulse ring perpétuel est retiré** (un objet premium est calme au repos) ; remplacé par un feedback au touch : enfoncement `withSpring` (scale 0.9) au press, rebond au relâché, snap en Reduced Motion. Le FAB sort de l'inventaire des boucles infinies §7.5.

**Fichiers modifiés** : `src/features/navigation/NavigationChromeContext.tsx` (machine 3 états + `dockCompact`), `src/features/navigation/DockBar.tsx` (réécrit : collapse, pill/halo, FAB obturateur, émergence, hitSlop, `accessible={false}` sur pill/halo). Aucune nouvelle dépendance (`expo-linear-gradient` déjà présent ; halo en Views + `tintLuminous`, pas de `react-native-svg`).
**Docs resync** : `reference.md` (§6 DockBar + NavigationChromeContext), `rules.md` (§5), `design-guide.md` (§2.3 overlays volume, §6.7 + §7.5 retrait pulse DockBar, §7.6, Annexe C).

**Audit (même session, 4 défauts corrigés + 2 finitions)** : relecture hostile du code avant validation. (1) **Centrage vertical cassé en compact** — le `paddingTop` animé (13→15) était redondant avec le centrage flex et décalait l'icône de 7,5 px sous le centre en compact (sans label pour équilibrer) ; retiré, tab passé en `alignSelf:'stretch'` + `justifyContent:'center'` (centrage auto, constantes `ICON_CENTER` recalculées : 24 expanded / 25 compact). (2) **Cible tactile < 44 px en compact** (§6.2) — le tab ne faisait que ~32 px ; le `stretch` le porte à la hauteur de la barre (≥ 44), `hitSlop` retiré. (3) **Yo-yo hide autour de 320 px** — reveal inconditionnel en remontant ; hystérésis ajoutée (`REVEAL_THRESHOLD = 240`). (4) **Reduced Motion non respecté sur le collapse** (§6.7) — `useReducedMotion()` dans le provider, `duration 0` (snap) si réduit, en deps du reaction + de `resetDock` ; `pressOut` FAB en snap aussi. Finitions : **bosse de 3 px sous la barre** en compact (FAB centré dans 50 débordait symétriquement) → `translateY` du `fabOuter` interpolé `0 → -FAB_EMERGE` pour aligner le FAB au bas (émergence haut uniquement) ; **`lineHeight: 12`** sur le label pour que `overflow:hidden` du wrap ne rogne jamais le « g » de *Catalogue*.

**Micro-interaction « alive » (même session)** : la barre est calme au repos (choix de marque conservé) mais *réagit* au geste de sélection — un effet spring borné, coupé en Reduced Motion. **Indicateur stretchy** : `indicatorStretch` SharedValue (séquence spring 1→1.25→1 au changement d'onglet) appliquée en `scaleX` sur la pill et le halo ; le `translateX` compense `(W*sx)/2` pour que l'étirement se fasse autour du centre de l'onglet (formule exacte vérifiée : centre visuel = `indicatorCenter` quel que soit `sx`). Effet gooey/élastique des tab bars premium, déclenché par interaction (tap *ou* settle de swipe) → conforme §7.5 (pas de boucle infinie). Le repos reste à zéro mouvement. (Un pop de l'icône active a été testé puis **retiré** : le rebond alourdissait le geste et contredisait la retenue voulue — l'icône change de forme/couleur sans pulser.)

**⚠️ Rendu jamais validé à l'écran** : la géométrie (centres icône, tailles pill/halo, opacités du gradient FAB, seuils de scroll 30/320/vélocité) est compilée et cohérente mais non lancée → `start.bat` requis pour le tuning fin en light, dark et Reduced Motion. Les constantes sont nommées en tête de `DockBar.tsx` pour un réglage rapide.

**Tests** : 27 suites, 287 tests (inchangés — aucun test ne couvre la dock). `tsc --noEmit` : 0 erreur sur `DockBar.tsx` / `NavigationChromeContext.tsx` (le bruit global `__tests__`/`supabase/functions` reste préexistant et hors scope).

## Notes v8.9 — Accords olfactifs, Flacon Runner v2 (pouvoirs/missions/classement), contextes, performances (30/07/2026)

**Accords olfactifs (fiche détail).** Nouveau composant `src/features/catalog/AccordProfile.tsx` + util `src/utils/accord-profile.ts` — remplace l'ancienne `AccordBar` inline de `catalog/[id].tsx`. Affiche les 5 accords principaux (`buildAccords()` : tri par intensité desc, cap 5) en barres horizontales colorées par famille sémantique (8 groupes `ACCORD_GROUPS` mappés aux tokens `accord0`–`accord7`). Qualificatif FR dérivé du pourcentage (`labelFromScore()`). Le 1er accord (« caractère ») en `PlayfairDisplay_600SemiBold` 20, les nuances en `Inter_500Medium` 14. Sélection : expansion animée (`interpolate` fontSize/color), description olfactive en `FadeInDown`, `hapticsLight()`. Ligne éditoriale italique (`accordAphorism()`, 8 aphorismes) couleur de l'accord actif. 8 nouveaux tokens `accord0`–`accord7` (light + dark) dans `theme.ts`. Reduced Motion respecté. Tests : `__tests__/utils/accord-profile.test.ts` (14 tests).

**Flacon Runner v2 : pouvoirs, vies, missions & classement.** Refonte majeure du mini-jeu. Les badges réduction deviennent 4 **notes à pouvoirs** (`PICKUP_DEFS` : Bergamote = magnet 5s, Santal = shield, Ambre = double score 8s, Musc = slow-mo ×0.45 ; `SLOW_FACTOR = 0.45`, `MAGNET_RADIUS = 240`). Système de **3 vies** (`MAX_LIVES`, `INVULN_DURATION = 1.2s` : impact = vie −1 + invulnérabilité (flicker UI-thread) + son `crack` (nouveau WAV `CRACK_WAV`) + shake ; le shield absorbe un impact). Fissures visuelles liées à `lives`. **Missions** (`runner-missions.ts`) : 8 succès persistés AsyncStorage (`@sillage/runner-missions`), évalués en fin de partie, badges dorés sur l'écran game over. **Classement mondial** : migration `0041_runner_scores.sql` — table `runner_scores` (PK `user_id`, meilleur run, anti-triche cap 50 000, RLS owner) + 2 RPC `SECURITY DEFINER` (`submit_runner_score` upsert `greatest()` + rang mondial ; `runner_leaderboard(lim)` lecture publique join `profiles`, `is_me`). Service `src/services/runner.ts` (`submitRunnerScore`, `getRunnerLeaderboard` cache 5 min, `clearRunnerLeaderboardCache`), soumission opt-in auto si connecté. **Nouveaux composants** : `RunnerHud.tsx` (chips pouvoirs actifs, UI thread), `RunnerParticles.tsx` (burst 8 particules à la collecte, coupé en Reduced Motion). **Refonte visuelle** : `RunnerBackground` + `RunnerGround` réécrits (gradients ancrés `groundY`, skyline de flacons, stries), obstacles/pickups avec spawn entry fade (`SPAWN_ENTRY_DISTANCE`). Bannière de phase (`RUNNER_PHASES` 4 familles) 1.6s. Accueil : sélecteur de skins persisté. Game over : stats + badges missions + rang mondial + « Partager » (`runnerShareUrl` dans `share.ts`). Pause + Mute persistés. Route dédiée `app/runner.tsx`. L'onglet Communauté affiche le top du leaderboard + bouton « Jouer ».

**ShelvesContext + useFavorisViewPreference + InfoPopup.** Nouveau contexte `src/contexts/ShelvesContext.tsx` (monté dans `_layout.tsx` sous `PriceAlertsProvider`) : 1 subscription `onShelves` partagée, expose `shelves`/`create`/`update`/`remove`/`reorder`. **Remplace le hook `useShelves.ts` (supprimé)** — élimine la double subscription quand la fiche détail (`RelationSection`) est ouverte par-dessus l'onglet Parfumerie. Consommateurs : `collection.tsx`, `RelationSection.tsx`. Nouveau hook `src/hooks/useFavorisViewPreference.ts` : persiste la vue du tab Favoris (`@sillage/favoris-view`, `'favoris' | 'alerts'`). Nouveau composant `src/components/InfoPopup.tsx` : popup centrée (backdrop scrim, carte `surface`, icône `primarySoft`, titre Playfair, animation scale+fade, BackHandler, Reduced Motion), utilisé pour l'aide « Non classés ».

**Tab Favoris : segmented Favoris / Alertes.** La pill « Alertes » quitte les pills (reste Tous · À traiter) ; un segmented 2 segments (Favoris | Alertes) bascule entre la grille et une vue dédiée aux alertes (cartes pleine largeur : image, prix actuel, chip variation, cible, toggle off). Préférence persistée via `useFavorisViewPreference`.

**Optimisations de performance.** `ParfumCard` : wrappé dans `React.memo` avec comparateur `arePropsEqual` (11 champs : `parfum.id`/`nom`/`marque`/`imageUrl`/`bestPrice`/`referencePrice`, `mode`, `status`, `rating`, `hidePrice`, `priceAlert.variation`) — fin des re-renders cascade dans les grilles. Toutes les `expo-image` des cartes passent en `cachePolicy="memory-disk"` + `recyclingKey={parfum.id}` (4 modes). `BottleThumb` : `cachePolicy="memory-disk"` + `recyclingKey={item.parfumId}` + `transition={200}`. `CatalogPage` : `Image.prefetch(urls, 'memory-disk')` sur les 24 premières URLs du pool populaire (warm-up du cache au chargement). `app/search.tsx` : virtualisation FlatList (`windowSize={5}`, `initialNumToRender={10}`, `maxToRenderPerBatch={10}`), `key` sans thème (`search-${searchDensity}`), `keyExtractor` stable (`p.id`), `contentContainerStyle` mémoïsé (`resultListContent`).

**Communauté : SOTD + météo intégrés.** L'onglet Communauté gagne le SOTD personnel (`useSotd` + `SOTDPicker`) et la météo (`useWeather` + scoring `scoreWardrobeItemForWeather`), en plus du leaderboard Runner.

**Divers.** `formatPrice()` : garde `!Number.isFinite(value)` → `'— €'`. `priceTier()` : garde `Number.isFinite`. Badge promo `ParfumCard` : typo `−${discount} %` (moins U+2212 + espace fine, §3.7). `FavButton` : prop `inline?: boolean` (cœur hors image en mode liste). Mode liste `ParfumCard` : cœur déplacé vers `trailingList`. `catalog/[id].tsx` : écriture du cache `similarIds` restreinte aux admins (RLS écriture `parfums`). `package.json` : retrait `@react-native-firebase` de `transformIgnorePatterns` Jest.

**Nettoyage héritage Firebase.** Suppression définitive de `functions/` (14 fichiers Cloud Functions), `firebase.json`, `firestore.indexes.json`, et 9 scripts obsolètes (`export-firestore`, `import-firestore`, `migrate-storage`, `migrate-to-webp`, `migrate-bgremoval`, `migrate-search-keywords`, `audit-search-fields`, `backfill-search-fields`, `clean-fragella`). La migration Supabase est complète ; plus aucun consommateur.

**Fichiers créés** : `src/features/catalog/AccordProfile.tsx`, `src/utils/accord-profile.ts`, `src/components/InfoPopup.tsx`, `src/contexts/ShelvesContext.tsx`, `src/hooks/useFavorisViewPreference.ts`, `src/features/runner/RunnerHud.tsx`, `RunnerParticles.tsx`, `runner-missions.ts`, `src/services/runner.ts`, `supabase/migrations/0041_runner_scores.sql`, `app/runner.tsx`, 6 suites de tests (`accord-profile`, `contrast`, `format-price`, `olfactory-families`, `price-tier`, `verdicts`).
**Fichiers supprimés** : `src/hooks/useShelves.ts` (→ `ShelvesContext`), `functions/` (14 fichiers), `firebase.json`, `firestore.indexes.json`, 9 scripts obsolètes.

**⚠️ Déploiement** : pousser la migration `0041_runner_scores.sql` (`supabase db push`) pour le leaderboard, puis régénérer `supabase gen types typescript --linked` (table `runner_scores` + 2 RPC dans `database.types.ts`).

**Tests** : 33 suites, 312 tests. `tsc --noEmit` : 0 erreur app/ + src/ (bruit `__tests__` préexistant hors scope).

## Notes v8.10 — Votes utilisateurs : performance (Tenue & sillage, Quand le porter) + fix RPC bind (31/07/2026)

**Votes utilisateurs sur la performance olfactive** — réappropriation progressive de la base Fragrantica. Table `parfum_votes` (PK `parfum_id, user_id, dimension`, RLS owner, votes individuels **privés** — l'agrégat public passe exclusivement par la RPC `parfum_perf` SECURITY DEFINER). **Fusion Fragrantica bornée** : `_perf_cranks` normalise le breakout en 4 crans UI (longévité : very weak+weak→1, moderate→2, long lasting→3, eternal→4 ; sillage : intimate→1, moderate→2, strong→3, enormous→4) ; `_perf_score` plafonne l'influence Fragrantica à `PERF_CAP = 100` équivalents en conservant sa forme (`poids = min(CAP,total)/total`) puis ajoute les votes users à plein poids → moyenne pondérée 1..4. À 0 vote user, le résultat est strictement Fragrantica (jour 1 identique). Saisons/moment : fusion de comptes (`score_frag × poids + nb_votes_user`), barres relatives. Cron `recompute_perf_strings` (3h15 UTC) réécrit `parfums.longevity`/`sillage` des parfums ≥ 1 vote user → propagé aux favoris/filtres/recherche.

**Migration 0044 — split dimension `moment`.** En 0042, saison ET moment partageaient `dimension='season'` → conflit PK (`(parfum_id, user_id, dimension)`) : voter un moment écrasait le vote saison. `0044_split_moment_dimension.sql` crée la dimension `'moment'` (day/night) : contrainte élargie, `cast_vote` (validation par dimension), `parfum_perf` (lecture `myMoment` + comptes jour/nuit sur `dimension='moment'`, `seasonUserVotes` couvre les deux). Supersède 0043 (fix de boucle `r` conservé). **Déployée sur le cloud** (vérifié par sonde : la contrainte accepte `'moment'`).

**Affordance de vote visible** — le long-press (invisible) est remplacé par des boutons 👍 ouvrant `VotePickerSheet` (sheet sélecteur §4.16 : options + vote courant marqué + « Retirer mon vote ») : un par dimension dans `PerformanceProfile` (crans Longévité/Sillage), un sur l'en-tête de `SeasonProfile` (4 saisons), les chips Jour/Soir passent en **tap direct** (dimension `'moment'`). Auth gate → `/auth/login` si non connecté.

**Bug critique corrigé — `this`-binding RPC.** `perf-votes.ts` extrayait `supabase.rpc` dans une constante → `this` perdu → `this.rest` → « Cannot read property 'rest' of undefined » → `getParfumPerf` plantait **toujours** → `available=false` → le vote n'a jamais marché (depuis l'écriture de la feature). Fix : `supabase.rpc.bind(supabase)`. **Piège documenté** : ne jamais détacher une méthode du client Supabase.

**usePerfVotes auto-réparé** : `useFocusEffect` (expo-router) retente le fetch au focus si la RPC était indisponible au mount (garde anti double-fetch via `initialDoneRef`/`availableRef`) ; `optimisticMyVote` gère `dimension='moment'` explicitement (plus de devinette par valeur).

**Fichiers créés** : `src/services/perf-votes.ts`, `src/hooks/usePerfVotes.ts`, `src/components/VotePickerSheet.tsx`, `src/features/catalog/PerformanceProfile.tsx` + `SeasonProfile.tsx`, `src/utils/perf-fusion.ts` + `performance-profile.ts` + `season-profile.ts`, `supabase/migrations/0042_user_perf_votes.sql` + `0043_fix_parfum_perf.sql` + `0044_split_moment_dimension.sql`, 3 suites de tests (`perf-fusion`, `performance-profile`, `season-profile`).

**⚠️ Déploiement** : `supabase db push` (0042→0044, déjà appliquées sur le cloud) ; après régénération des types (`supabase gen types typescript --linked`), retirer le `rpcUntyped` temporaire de `perf-votes.ts` (RPC typées dans `database.types.ts`).

**Tests** : 36 suites, 340 tests. `tsc --noEmit` : 0 erreur app/ + src/ (bruit `__tests__` préexistant hors scope).

## Notes v8.11 — Audit performance : virtualisation historique, images memory-disk, mémoïsation (31/07/2026)

**Audit perf complet** (5 zones : realtime/contextes, listes/rendu, images, startup/bundle, réseau), valeurs par défaut validées via Context7 (expo-image `cachePolicy='disk'`, `allowDownscaling=true` ; FlatList `windowSize=21`, `initialNumToRender=10`). Constat : couche réseau (5 effects parallèles au mount, pas de waterfall, `sharedPool` dédupliqué, 4 caches actifs LRU/communauté/météo/runner, debounce 150ms + `requestIdRef` + `mountedRef`), realtime (`subscribeUserTable` cleanup `removeChannel`, 7/7 providers mémoïsés) et images (`ParfumCard` memory-disk + recyclingKey, images 2x confinées à la fiche/lightbox, `Image.prefetch` 24 URLs) déjà sains.

**Historique virtualisé** (`history.tsx`) : `ScrollView`+`.map` non borné → **`SectionList`** (`windowSize=5`/`initialNumToRender=10`/`maxToRenderPerBatch=10`, `stickySectionHeadersEnabled={false}`). Fix du **O(n²)** (`sections.slice(0,i).filter(...)` → compteur incrémental). `ScanHistoryCard` mémoïsée (`React.memo` + comparateur custom, pattern `ParfumCard.arePropsEqual`). L'entrée stagger RN Animated (qui ignorait le Reduced Motion — **violation §6.7 corrigée**) est remplacée par `FadeInDown` Reanimated respectueux du Reduced Motion (pattern `ScanResults.tsx:108`). Regroupement refactoré en sections `{ title, data }`.

**Virtualisation FlatList** : `initialNumToRender={10}` sur `brand/[name].tsx` (`windowSize`/`maxToRenderPerBatch` déjà présents — faux positif d'audit corrigé en recheck via `tsc`) ; `windowSize`+`initialNumToRender`+`maxToRenderPerBatch` sur `u/[pseudo].tsx`.

**Images expo-image** : `cachePolicy="memory-disk"` + `recyclingKey` sur `SOTDPicker` (seule image FlatList qui y échappait — prop `recyclingKey` threadée dans `ImageOrPlaceholder`), les cartes no-result de `history`, et les sheets `AddToShelfSheet`/`InspireShelfSheet` (+ `transition`).

**Mémoïsation** : `BrandSheet.contentContainerStyle` (`listContent` useMemo) et `extraData` de la DraggableFlatList de `collection.tsx` (`shelvesExtraData` useMemo).

**Décisions assumées (non faites)** : pas de lazy des providers realtime (casserait la synchro cœur↔grille instantanée v7.4 — décision produit), pas d'`AbortController` sur les RPC (guards `mountedRef` protègent déjà le setState ; gain = bande passante seule), pas de subset polices (~2,4 MB de TTF bloquant le 1er rendu — risque typo, règle `0 fontWeight`), pas de `FavButton` via `useSyncExternalStore` (refactor disproportionné pour des re-renders de cœurs minuscules).

**Tests** : 36 suites, 340 tests (inchangés). `tsc --noEmit` : 0 erreur app/ + src/. **Validé visuellement sur émulateur** (light, dark, Reduced Motion).

## Notes v8.12 — Check-up architectural : crash + sécurité + données + UX (31/07/2026)

**Audit complet en 6 angles** (sécurité backend, hooks/contexts, components, écrans/navigation, services/données, tests/config/docs) → 37 corrections appliquées en 6 lots. Aucun changement de modèle de données ni de navigation.

**Crash (LOT A/B)** : `AccordProfile` hook après early return (Rules of Hooks — crash possible) → `handleSelect` déplacé avant le `return null` ; spinner infini si param `name` absent sur `brand/[name]`/`perfumer/[name]` (deep link malformé) → état erreur ; `search.tsx` garde `Array.isArray` sur le param `q`/`family` (crash `trim` sur tableau) ; `history.tsx` guard `uid` null (crash si logout pendant l'ActionSheet) ; `usePerfVotes` vote optimiste SANS rollback si `castVote` retourne `false` → `refresh()` systématique (le refetch écrase l'optimiste) ; `useProfileStats` vérifie désormais `res.error` (supabase-js ne throw pas — compteurs affichaient silencieusement 0).

**Sécurité backend** : comparaison de secrets **constant-time** (`safeCompare` dans `_shared/supabase.ts` + `send-notification`) ; retry exponentiel (1s→30s, max 5) sur `CHANNEL_ERROR`/`TIMED_OUT` du canal realtime (`supabase.ts` — la subscription mourait silencieusement) ; cron météo `send-weather-notifications` → table **`user_parfum`** (status='have') au lieu de la table morte `wardrobe` (les notifications météo étaient silencieusement mortes depuis v8.0).

**Données (numeric→number)** : `toNum()` appliqué sur `community.ts` (best_price, love_count, activity_count, collection_count — PostgREST sérialise `numeric`/`bigint` en STRING → prix/étoiles cassés), `catalog.supabase.ts` (popularity_score, total family_overviews), `perf-votes.ts` (mapper `mapDim` complet). **Copie défensive** du cache LRU (`search-shared.ts` retourne `[...entry.results]` — plus de mutation du cache par un appelant). Null-guards : `voice-search` (data null → message clair), `openai-vision` (ScanResult partiel normalisé, `confidence`→'low', `alternatives`→[]), `normalize()` (`if (!s) return ''`). Lecture `getParfumsByPerfumer`/`getParfumsByMarque` → try/catch fallback `[]` (incohérence avec les autres lectures corrigée). Écritures `account` (`clearWeatherCoords`, `deleteAllFrom`) → rethrow (rollbacks optimistes réactivés).

**UX/sheets (§4.16, §2.5, §2.6)** : `CommunityVerdicts` gagne une **animation de sortie** (pattern mounted + withTiming, plus de disparition instantanée) ; `ActionSheet` radius top 24 (était 20) ; `SaveSheet` double haptique retirée (1 haptique/geste §2.6) ; `PriceDisplay` badge promo `−X %` (U+2212 + espace fine §3.7) ; `FavButton` hitSlop xs 9 → cible 44 px (§6.2) ; `ShelfManager` scrim `rgba(0,0,0,0.4)` (§2.5) ; `VotePickerSheet` `hapticsLight()` à la sélection ; `PriceAlertSheet` `.catch()` sur la promesse du prix le plus bas.

**Écrans/perf** : `.catch()` sur le `Promise.all` de l'étagère publique `u/[pseudo]/shelf/[shelfId]` ; `translateSupabaseError` sur login/register (login et Google, plus de `e.message` brut) ; virtualisation vue Alertes du tab Favoris (`Animated.FlatList` windowSize 5) + `AddToShelfSheet` (FlatList) ; `renderShelfGroup` de `collection.tsx` wrappé dans `useCallback`.

**Config/docs** : `tsconfig.json` exclut **`__tests__/`** → `tsc --noEmit` passe à **0 erreur global** (le bruit `@types/jest` préexistant est éliminé) ; drift docs corrigés (`reference.md` : signature objet `searchParfumFromScan`, `useShelvesContext` remplace `useShelves`) ; commentaire obsolète `functions/src/weather-scoring.ts` supprimé ; `alpha.ts` valide l'hex (retour `rgba(0,0,0,0)` sur invalide) + clamp du ratio.

**Tests** : **39 suites, 356 tests** (+3 suites : `favori-filters`, `brand-color`, `weather-codes` ; +tests `contrast` hex courts, `format-price` négatifs). `tsc --noEmit` : **0 erreur global**. Aucun changement de données.

**⚠️ À faire (non bloquant)** : migration `parfum_perf` à sécuriser (forcer `auth.uid()`, ne plus accepter `p_user_id` arbitraire — voir v8.10) ; redéployer les Edge Functions modifiées (`send-notification`, `send-weather-notifications`, `_shared/supabase.ts`) ; activer le captcha Turnstile (config.toml) avant mise en store ; rate-limit sur `share` avant exposition publique. Validation visuelle émulateur recommandée pour le drag d'étagères et le scroll Alertes.

## Notes v8.13 — Onglet Communauté P0 : « pouls éditorial », agrégats honnêtes, SOTD en RPC dédiée (01/08/2026)

**Refonte de l'onglet Communauté** (aucun changement du modèle `user_parfum`/`favoris`). Brainstorm orchestré (4 angles × 2 rounds : stratégie / engagement / UX / données) → positionnement verrouillé **« pouls éditorial »** : l'onglet est *utile avant d'être social* (fallback saison/météo + seed éditorial honnête en cold-start), et le signal social monte à l'échelle via des seuils adaptatifs. Le SOTD perso XL dupliqué de l'onglet Parfumerie est retiré ; le prix (couche intention = tab Favoris) est masqué ici.

**Données — agrégats honnêtes (migration `0046_community_honest_aggregates.sql`)** : rewrite de `mv_top_loved`/`mv_trending` en `JOIN parfums` + `GROUP BY parfum_id` seul → corrige le bug « — € » (les matviews lisaient le `best_price` **dénormalisé** stale/null de `favoris`/`scans`) **et** défragmente `love_count`/`activity_count` (l'ancien `GROUP BY` sur `best_price` éclatait un même parfum en plusieurs groupes). Seuil `top_loved` dynamique `GREATEST(2, distinct_users/10)` (l'ancien `HAVING >= 3` était vide en cold-start) ; `trending` exige `count(distinct user_id) >= 2` (plus de miroir de l'activité du visiteur labellisé « communauté »). `sotd_today` extrait de `community_highlights` vers une RPC dédiée **`sotd_community_today()`** (live, cache client 3 min au lieu du cache 1 h qui datait le SOTD « du jour »). Refresh initial des matviews non concurrent (requis avant le cron `CONCURRENTLY`).

**Service/hook** : `getCommunityHighlights()` ne renvoie plus `sotd_today` ; nouvelle `getSotdCommunityToday()` (cache 3 min). `useCommunityHighlights` charge les deux en **`Promise.allSettled`** (le SOTD communautaire est non bloquant — si la RPC échoue, le reste de l'onglet vit). `MyProfile` gagne `followingCount` (colonne déjà en base) → garde client : `followed_highlights` n'est plus appelé à 0 abonnement. `rpcUntyped` temporaire retiré après `supabase gen types typescript --linked` (RPC désormais typée).

**UI (`communaute.tsx` réécrit)** : hero **« L'air du jour »** = ligne éditoriale + météo en chip d'ambiance + rangée « Portés aujourd'hui » (SOTD communautaire + ton SOTD en 1ʳᵉ position avec badge « Toi ») + ligne SOTD perso hairline (routage vers le picker, plus de bloc XL dupliqué). Zone **« Les nez »** = recherche pseudo en **row ghost** distincte (`surface2` + icône `person`, le chrome parfum global reste unique) + activité des suivis + collections à découvrir. Section **« L'air du temps »** = les plus aimés / tendances communautaires, **ou** seed éditorial (`getTopRatedParfums` / `getSeasonalParfums`, chargé **seulement** si la communauté est vide, étiqueté « la sélection de la maison » / « Parfaits pour {saison} »). Cartes `hidePrice` → zéro « — € ». États vides **par section** + empty-state global retenu pendant `seedLoading` (anti-flash). **Footer Runner** hairline permanent avec CTA « Jouer » + ton rang (invitation à jouer ; la section « Flacon Runner / Le classement » en position n°2, rupture de ton, est supprimée — le footer est pensé comme l'entrée d'un futur hub 2-3 jeux).

**Audit relecture hostile** (5 défauts logiques que `tsc`/`jest` ne voient pas, tous corrigés) : seed chargé inconditionnellement → désormais conditionnel (`seedTriggeredRef`) ; flash « Les membres arrivent » en cold-start → retenu par `seedLoading` ; header « L'air du temps » orphelin si aucune rangée → conditionné à `showAnyAir` ; label « Portés aujourd'hui » orphelin → conditionné à `showRow` ; `Promise.all` cassant l'onglet si la nouvelle RPC n'est pas déployée → `Promise.allSettled`.

**Fichiers créés** : `supabase/migrations/0046_community_honest_aggregates.sql`.
**Fichiers modifiés** : `app/(tabs)/communaute.tsx` (réécrit), `src/services/community.ts`, `src/hooks/useCommunityHighlights.ts`, `src/services/impl/profile.supabase.ts`, `src/models/profile.interface.ts`, `src/types/database.types.ts` (regen), `.clinerules/reference.md`, `.clinerules/rules.md`.
**Fichiers supprimés** : aucun.

**Backlog verrouillé (hors P0)** : P1 = chips ♥n/×n gatés ≥3 (compteurs désormais fiables) · pastilles §4.9 sur titres + timeline activité unifiée · récap hebdo perso `weekly_recap` + Share · défi famille hebdo (rotation `OLFACTORY_FAMILIES`) · streak SOTD (chip sur `SOTDCard` **dans Parfumerie**). P2 = « Étagères à découvrir » (`public_shelf_overview`) · taste twins gatés (≥30 profils × ≥10 verdicts) · push « X a aimé un parfum que tu as » · chrome contextuel par onglet · hub jeux.

**Tests** : 41 suites, 383 tests (inchangés — aucun test ne couvre `communaute.tsx`). `tsc --noEmit` : 0 erreur global.

**⚠️ Déploiement** : `0046` poussé + types régénérés + `rpcUntyped` retiré (faits en session). **Rendu jamais validé à l'écran** → `start.bat` requis (light / dark / Reduced Motion) : hero non vide à 1 user, zéro « — € », footer Runner, row ghost distincte du chrome.

## Notes v8.14 — Communauté P1-A : pastilles §4.9, timeline unifiée, défi famille hebdo (01/08/2026)

**Différenciation + rythme de l'onglet Communauté** (front pur, isolé — aucun changement de modèle ni de contrat service/hook). Objectif : donner du rythme éditorial et un rituel jour-1 sans toucher aux composants chauds.

**Pastilles §4.9 sur les titres** : `SectionHeader` gagne une pastille éditoriale **opt-in** (props `icon` + `tint` + `tintBg`, rétrocompatible — sans `icon`, rendu strictement identique, donc 0 impact sur les ~autres écrans). Appliquée aux deux titres de Communauté en `primary`/`primarySoft` (« Les nez » = `people-outline`, « L'air du temps » = `trending-up-outline`) → **un seul accent** sur l'écran (§2.4 respecté, pas de `secondary`).

**Timeline activité unifiée** : les verdicts et les « have » des nez suivis sont fusionnés en **une seule liste triée par récence** (avant : deux `.map` séparés → ordre chronologique cassé). La rangée SOTD des suivis reste en cartes-image au-dessus (plus riche qu'une phrase). Rendu uniforme via un `TimelineRow` normalisé (verbe + suffixe).

**Défi famille hebdo** : carte « Le geste de la semaine » juste après le hero, **toujours visible** (indépendante du seed et de l'empty-state → rituel dès le jour 1, zéro donnée). Rotation déterministe `OLFACTORY_FAMILIES[Math.floor(now / WEEK_MS) % len]`. CTA outline `primary` → `/search?family=<key>` (`encodeURIComponent`, même pattern que `catalog/[id]` + `CatalogPage` ; `search.tsx` résout via `getFamilyByKey`). Sobre « luxe malin » : l'identité de la famille passe par l'icône + le nom + la tagline, **pas** par sa couleur (évite un 2ᵉ accent). Pas d'italique sur la carte (§3.2 : l'unique italique de l'écran reste celle du hero, non adjacente).

**Chip ♥n / ×n reporté** : les compteurs `love_count`/`activity_count` sont désormais **fiables** (matviews défragmentées, 0046) mais l'affichage est gaté ≥3 → **invisible en cold-start**. Modifier `ParfumCard` (composant chaud mémoïsé, 9 écrans, `arePropsEqual`) pour un rendu non validable à l'écran n'est pas justifié ; le chip est **prêt à activer** dès que la masse le permet, sans touché au modèle.

**Fichiers modifiés** : `src/components/SectionHeader.tsx` (pastille opt-in), `app/(tabs)/communaute.tsx` (pastilles + timeline + défi), `.clinerules/rules.md`, `AGENTS.md`.
**Fichiers supprimés / créés** : aucun. `reference.md` inchangé (SectionHeader non documenté ; aucun contrat service/hook/modèle modifié).

**Tests** : 41 suites, 383 tests (inchangés — aucun test ne couvre `communaute.tsx` ni `SectionHeader`). `tsc --noEmit` : 0 erreur global.

**⚠️ Rendu jamais validé à l'écran** → `start.bat` (light / dark / Reduced Motion) : pastilles sur les 2 titres, carte défi famille + CTA fonctionnel vers `/search?family=`, timeline des suivis triée par récence.

**Backlog P1 restant (P1-B)** : récap hebdo perso `weekly_recap` (RPC + bloc « Ta semaine » + Share) · streak SOTD (chip « N j » sur `SOTDCard` **dans Parfumerie**, nécessite l'historique `sotd`). **P2** inchangé : chips ♥n/×n gatés (activation) · « Étagères à découvrir » · taste twins gatés · push « X a aimé un parfum que tu as » · chrome contextuel · hub jeux.

## Notes v8.15 — Communauté : polish visuel + densité cold-start (01/08/2026)

**Brainstorm orchestré sur le rendu réel** du P0+P1-A (4 angles × 2 rounds : polish / densité / rétention / croissance) → corrections des défauts que `tsc`/`jest` ne voient pas, ancrés dans les screenshots. Aucun changement de modèle ni de contrat service.

**Polish visuel.** `SectionHeader` n'a aucune marge horizontale par design (la marge vient du caller via `style`) → les 2 titres de Communauté étaient collés au bord gauche (x=0) alors que le contenu est à 16. Fix **local** : `style={{ paddingHorizontal: 16 }}` sur les 2 headers (pas global : `BrandCapsules`/`FamilyAmbianceCards` passent déjà leur marge, un global doublerait). `subtitle` de `SectionHeader` n'avait pas de `fontFamily` → fallback système ; `Inter_400Regular` ajouté (bénéficie aux 5 consommateurs). Sublabel « Nez que tu suis » → **« Activité de tes suivis »** (le header « Les nez » porte la découverte, le sublabel qualifie le bloc suivi). CTA défi : outline pleine largeur (2ᵉ masse violette, §2.4) → **soft-fill `primarySoft`/`primaryInk` aligné à droite** (affordance du levier → `/search` préservée, 1 seul accent).

**Densité cold-start (deux seuils : SQL vs rendu).** Le P0 avait mis des seuils SQL honnêtes mais à 1-2 users une rangée horizontale de cartes 140 px paraît vide (1 carte = 1/3 de rangée). Règles de rendu : **fusion** « Les plus aimés » + « Tendances » en une seule rangée « L'air du temps » **dédupliquée** (tue la duplication du même parfum sous 2 labels) ; seuil de rendu par conteneur (carousel ≥ 3, grille ≥ 2) ; sous 3 cartes communautaires, les cartes **réelles** passent en **lignes featured `mode=list`** (format vertical plein à 1-2, le signal n'est jamais jeté — flag `USE_FEATURED_ROWS`) complétées en dessous par une rangée seed « la sélection de la maison » (le seed devient un **frère**, jamais un remplaçant d'un vrai signal maigre) ; « Collections à découvrir » gatée **≥ 2 profils** (fin de la demi-carte orpheline). **Miroir hero** : la rangée « Portés aujourd'hui » est masquée si aucun *autre* SOTD public (`showRow = sotdToday.length > 0`) — à 1 user on ne se parle plus à soi-même ; la ligne hairline perso reste. Label adaptatif « par les premiers nez » / « par la communauté » selon Σ `love_count` (< 5).

**Fichiers modifiés** : `app/(tabs)/communaute.tsx`, `src/components/SectionHeader.tsx` (`fontFamily` subtitle), `.clinerules/rules.md`.
**Fichiers créés / supprimés** : aucun.

**Tests** : 41 suites, 383 tests (inchangés). `tsc --noEmit` : 0 erreur global.

**⚠️ Rendu jamais validé à l'écran** → `start.bat` (light / dark / Reduced Motion). Points à vérifier : featured-row `mode=list` à 2 users (si double marge → retirer `marginHorizontal` du wrapper `featuredRow` ; si le rendu ne plaît pas → `USE_FEATURED_ROWS = false` = fallback seed-only en 1 ligne) ; CTA soft-fill droite ; titres alignés 16 ; plus de Versace dupliqué ; hero sans rangée « Toi » seule à 1 user.

## Notes v8.16 — Récap perso « Ta semaine » + streak SOTD + Share v1 (front pur) (01/08/2026)

**Rétention perso jour-1, sans migration ni masse critique.** Réalise le backlog P1-B de v8.14. Le positionnement « pouls éditorial » est *cadré communauté, motorisé perso* : sans moteur perso, l'onglet meurt en cold-start (0 suivi → « Les nez » vide). Le récap est le seul moteur qui fonctionne à 1 user, zéro donnée réseau.

**Récap « Ta semaine »** (Communauté, après le défi, avant « Les nez »). Nouveau service `src/services/recap.ts` + hook `useWeeklyRecap` : `getWeeklyRecap(uid)` = 4 counts `head` PostgREST sur 7 jours glissants (`scans.scanned_at`, `favoris.added_at`, `sotd.day`, `user_parfum.tried_at` avec verdict non null), `Promise.all` + `safe` par requête (1 échec → 0, pas de casse). Bloc row-carte ≤ 60 px : overline « TA SEMAINE » + **une phrase** (segments non nuls joints par ` · ` : « N flacons croisés · N cœurs · porté N jours · N avis posés ») + CTA droite. Seuil **≥ 1 événement**, masqué à 0 (pas d'empty state culpabilisant). **Share v1 front pur** : texte « Ma semaine olfactive — … » + `profileShareUrl(pseudo)`, gaté profil public (sinon CTA → `/profile`, pattern de consentement). La landing SSR dédiée `share?type=recap` (OG riches) est **reportée en P1**, gatée sur le taux de Share mesuré.

**Streak SOTD** (Parfumerie). `getSotdStreak(uid)` = lecture `sotd` `order day desc limit 366` + comptage consécutif (série se terminant aujourd'hui, ou hier si non posé aujourd'hui — la série ne meurt pas à 14 h ; 0 si cassée). `useSotd` retourne `streak` (chargé en parallèle du SOTD, **rechargé après `setTodaySotd`** — refresh juste plutôt qu'optimiste fragile, le cas « série cassée puis pose » rend l'optimiste piégeux). Chip **« N j » ≥ 2** sur `SOTDCard` (`textMuted`/`surface2`, après le nom, avant le badge score, `tabular-nums`, `allowFontScaling={false}`) — **pas de 🔥, pas de palier** (§19 : pas de gamification ; la constance se constate, ne se célèbre pas). Câblé dans `collection.tsx`. `accessibilityLabel` étendu (« porté N jours de suite »).

**Fichiers créés** : `src/services/recap.ts`, `src/hooks/useWeeklyRecap.ts`.
**Fichiers modifiés** : `src/hooks/useSotd.ts`, `src/features/wardrobe/SOTDCard.tsx`, `app/(tabs)/collection.tsx`, `app/(tabs)/communaute.tsx`, `.clinerules/reference.md` (+ service `recap`, + hook `useWeeklyRecap`, `useSotd` += `streak`), `.clinerules/rules.md`.
**Fichiers supprimés** : aucun.

**Limite connue** : « avis posé » se fie à `tried_at` — un verdict édité sans re-`markTried` n'est pas compté (accepté en v1).

**Tests** : 41 suites, 383 tests (inchangés — aucun test ne couvre `communaute.tsx`, `recap`, `useSotd`). `tsc --noEmit` : 0 erreur global.

**⚠️ Rendu jamais validé à l'écran** → `start.bat` (light / dark / Reduced Motion) : bloc « Ta semaine » (≥ 1 événement, CTA Partager/Rendre public), chip streak sur `SOTDCard` Parfumerie (vérifier la troncature du nom sur 360 dp avec nom long + score + streak ; si inacceptable → déplacer le chip dans l'en-tête du `SOTDPicker`).

**Backlog** : P1 = landing SSR `share?type=recap` + RPC `public_weekly_recap` (migration, gatée taux Share). P2 inchangé : reorder mode SOLO/NETWORK (gated visuel) · chips ♥n/×n (de-striper `love_count`, gatés ≥ 3) · « Étagères à découvrir » (`public_shelf_overview`) · taste twins gatés · push « X a aimé un parfum que tu as » · hub jeux.

## Notes v8.17 — Communauté : polish micro-layout + chip social ♥n (brainstorm sur rendu) (01/08/2026)

**Brainstorm orchestré sur le rendu réel** de v8.15/v8.16 (3 angles : micro-layout / cohérence langage cartes / clôture v1) → polish des défauts visibles à l'écran + premier signal social. Aucun changement de modèle ni de contrat service (`love_count` déjà mappé depuis 0046).

**Polish micro-layout (visible à l'écran).** (A) Le CTA « Explorer » du défi était en bas-à-droite d'une **colonne** (`alignSelf:'flex-end'`) → grand trou vertical à gauche ; déplacé **dans** `challengeTop` (3ᵉ enfant de la row, `flexShrink:0`) → la carte passe de ~144 à ~88 px, plus de trou, langage « row + action à droite » uniforme. (B) Hero maigre à 1 user sans météo : **resserré** (`heroMeLine` marginTop 12→10, paddingVertical 8→6 → thumb 32+12 = 44 px exact), **sans voile** §4.14 (une lueur sur 2 lignes = maquillage de vide, refusé ; le plat est l'état jour-1 honnête). (C) CTA « Ta semaine » : **largeur gelée** `minWidth:124` + `justifyContent:'flex-end'` → plus de layout-shift entre « Rendre public » (long) et « Partager » (court) au moment du toggle profil public ; **label conservé** (c'est le levier de consentement, une icône seule l'enterrerait). (D) `recapCard` padding 12→14 → bord gauche de texte aligné à 30 px avec hero/défi.

**Chip social ♥n (dormant en cold-start).** Prop optionnelle `socialLoves?: number` sur `ParfumCard` : gaté **≥ 3 interne**, rendu en tête des chips (carousel + list), `favorite`/`favoriteSoft`, `arePropsEqual` mis à jour → **8 autres écrans strictement inchangés** (la prop n'est passée que depuis Communauté). Passé sur les cartes communautaires (carousel `commFull` + featured `commThin`), **jamais sur le seed** (« maison » ≠ preuve sociale). `love_count` déjà dans le payload (matview 0046) → **0 backend**. Le cœur visiteur (`FavButton`) est **conservé** partout (canon v7.4, boucle communauté→curation). À 1-2 users le gate ≥ 3 n'est pas atteint → **chip invisible à l'émulateur maintenant**, prêt à apparaître dès que la masse arrive.

**Décisions de clôture v1 (brainstorm).** L'onglet est **shippable v1** (aucun bloquant : honnêteté cold-start, rétention jour-1, différenciation vs Catalogue, conformité design, perf, auth optionnelle, zéro « — € » tous ✓). **Reorder SOLO/NETWORK reporté** : le basculement est organique (le bloc social s'allonge et pousse le perso par le scroll) ; le seuil est flou et le risque de casser le cold-start résolu l'emporte. **Partage du défi famille reporté v1.1** : sans landing web `share?type=family`, un partage scheme-only n'acquiert rien hors-app (incohérent avec le pattern maison URL web) → il faut l'Edge, donc pas en front pur. **Carte communautaire dédiée « attribution »** (« aimés par @a, @b ») reportée : la matview ne remonte pas les pseudos des amants (seulement le count) → nécessite une RPC, pas « déjà en base ».

**Fichiers modifiés** : `app/(tabs)/communaute.tsx`, `src/components/ParfumCard.tsx` (prop `socialLoves` + rendu + `arePropsEqual`), `.clinerules/rules.md`, `AGENTS.md`.
**Fichiers créés / supprimés** : aucun.

**Tests** : 44 suites, 404 tests (inchangés — aucun test ne couvre `communaute.tsx` ni `ParfumCard`). `tsc --noEmit` : 0 erreur global.

**⚠️ Rendu** : le **polish** est visible à l'émulateur (`start.bat` light/dark/RM) — trou du défi disparu, hero resserré, CTA « Ta semaine » stable, cartes alignées. Le **chip ♥n est dormant à 1 user** (gate ≥ 3) : il ne se verra pas maintenant, c'est attendu.

## Notes v8.18 — Communauté : motion & micro-interactions (pièce vivante, sobriété conservée) (01/08/2026)

**Passe de « vie » sur l'onglet** (front pur, aucun changement de modèle/contrat/service). Le socle v8.13→v8.17 était honnête mais statique ; cette passe lui donne du mouvement et du feedback **sans trahir la retenue « luxe malin »** (pas de nappe lumineuse, pas d'accent parasite, pas de blob — §1 réduction, §2.4 un accent, §4.14 refusé comme maquillage).

**Reveal d'entrée échelonné.** Composant local `Reveal` (`Animated.View` + `entering={FadeInDown.delay(index*70).duration(420)}`) sur le premier écran : hero (0) → défi (1) → « Ta semaine » (2), pour un dévoilement en cascade à l'ouverture. L'état vide « Les membres arrivent » fond en `FadeIn`. **Tout est coupé en Reduced Motion** (`useReducedMotion()` → `entering={undefined}`, §6.7). Le `onLayout` du wrapper hero (ancre du `SOTDPicker`) est préservé (la transform d'entrée n'affecte pas la box mesurée). Les sections sous le pli ne sont PAS animées (leur `entering` au mount serait hors viewport, donc inutile — pas de churn).

**Feedback d'appui.** Les 4 actions de l'onglet (CTA défi, CTA « Ta semaine », ligne SOTD perso, footer Runner) passent en `style={({pressed}) => [s.x, pressed && s.pressFade]}` (`opacity: 0.7`) — feedback perceptible conforme §7.1 (pas de scale spring, réservé au FAB/FavButton).

**Hiérarchie d'ouverture.** `heroTitle` 17 → **20** (`lineHeight: 24`) : l'opener « L'air du jour » domine désormais le rituel (défi 18) et les sections (18), conformément au contraste de tailles voulu — sans toucher au H1 de page « Communauté » (28).

**Fichiers modifiés** : `app/(tabs)/communaute.tsx` (import Reanimated étendu, `Reveal`, `reducedMotion`, wrappers, function-styles press, `pressFade`, `heroTitle`).
**Fichiers créés / supprimés** : aucun.

**Tests** : 44 suites, 414 tests (inchangés — aucun test ne couvre `communaute.tsx`). `tsc --noEmit` : 0 erreur global.

**⚠️ Rendu** à vérifier à l'émulateur (`start.bat`) : cascade d'entrée au lancement de l'onglet (light/dark), **aucune animation avec Reduced Motion activé**, fondu de l'état vide, assombrissement à l'appui des 4 actions, titre « L'air du jour » plus présent. Le reveal ne se rejoue PAS au scroll (volontaire — c'est une animation d'ouverture, pas un scroll-reveal perpétuel).

## Notes v8.19 — Renommage ParfumScan → Sillage (01/08/2026)

**Renommage complet de la marque** (nom, slug, scheme, clés, identifiants natifs, backend, docs). L'app s'appelle désormais **Sillage**.

**Application** :
- **`app.json`** : `name: Sillage`, `slug: sillage`, `scheme: sillage`, `bundleIdentifier`/`package: com.sillage.app`, 6 permission strings iOS/Android → « Sillage ».
- **Deep links** : scheme `parfumscan://` → `sillage://` (source unique `APP_SCHEME` dans `src/utils/share.ts` + copie Edge Function `share`). Les anciens liens partagés ne s'ouvrent plus.
- **AsyncStorage** : namespace `@parfumscan/` → `@sillage/` (13 clés : theme, catalog-density, voice-search, favoris-view, parfumerie-view, runner-*, runner-missions, recent-searches, parfumerie-shelves-expand + cleanup delete-account). **Préférences locales réinitialisées au 1er lancement — voulu pré-store**.
- **UI/copy** : 10 écrans (hero catalogue, ScanIdle, auth login/register, settings version, legal, privacy), partages (« sur Sillage »), domaine `sillage.app` (`legal.ts`), export RGPD `sillage-export-*.json`.
- **Package** : `package.json` → `sillage` (lockfile synchro), `scripts/images/bgremoval` → `sillage-bgremoval`.

**Natifs Android** : `namespace`/`applicationId` `com.sillage.app` (`build.gradle`), `rootProject.name = 'Sillage'`, `app_name` strings.xml, dossier Kotlin `com/parfumscan/app` → `com/sillage/app` (MainActivity/MainApplication), scheme manifest `sillage`, keystore renommé `sillage-release.keystore` + alias via `keytool -changealias` (fichier + alias, mot de passe inchangé).

**Firebase/Google Sign-In** : nouvelle app `com.sillage.app` enregistrée dans la console Firebase (projet `parfumscan-60549` conservé) + `google-services.json` remplacés (racine + `android/app/`) — l'ancienne entrée `com.parfumscan.app` reste dans le fichier, le plugin Gradle matche sur l'applicationId.

**Expo/EAS** : ancien projectId retiré d'`app.json`, nouveau projet créé et lié : **`@breakloopstudio/sillage`** (ID `31e344db-f4ac-4304-b0c9-b4b35059c8e7`, https://expo.dev/accounts/breakloopstudio/projects/sillage). L'ancien projet `parfumscan` est orphelin.

**Backend Supabase** : Edge Function `share` redéployée (`supabase functions deploy share --no-verify-jwt`) ; migration `0047_rename_brand.sql` (RPC `export_user_data` → `'app', 'Sillage'`) **poussée** (`supabase db push`) ; `config.toml` project_id → `sillage` (container Docker `supabase_db_sillage`). Commentaires migrations 0001/0006/0021 + smoke-test resync. Nom du projet cloud (`zrifarygomoljwhdjcbh`) inchangé.

**Pages store** : `public/{privacy,legal,delete-account}.html` → « Sillage » + `contact@sillage.app`.

**Docs** : AGENTS.md, README.md, `.clinerules/*` (rules, reference, design-guide, SPEC), `docs/*` — titres, scheme, clés, badges (repo `breakloopstudio/sillage`).

**Reste manuel (post-commit)** : désinstaller l'ancienne app sur device, `start.bat build` (rebuild natif pour embarquer le nouveau package), vérifier Google Sign-In (nouveau client), supprimer l'ancien projet Expo `parfumscan` si inutile. Nom du dossier local `C:\dev\Sillage`.

## Notes v8.20 — Flacon Runner v3 : game-feel, glissade, fièvre, rétention locale, pont catalogue (01/08/2026)

**Refonte du mini-jeu** en 3 vagues (brainstorm 4 angles × subagents). Aucun changement du modèle de données de l'app ; le jeu reste un easter egg « luxe malin » (scène sombre hors thème assumée, désormais documentée + couleurs regroupées dans `RUNNER_COLORS`).

**Vague 1 — Fondations (bugs + game-feel).**
- **Bugs** : skins intermédiaires sautés corrigé (`getSkinsForScore` itère tous les seuils franchis, un run à 3000 débloque Ambre+Givre+Noir) · safe-area (`useSafeAreaInsets` sur score/vies/HUD/boutons/phaseBanner/game over) · milestones plus sautés (suppression du `break`, tous les paliers franchis d'une frame sont déclenchés) · `collectedCounts` `useMemo` muté → `useRef` · anneau de bouclier aligné sur la couleur Santal (cohérent avec l'aura) · Reduced Motion sur `countdownScale` + `FloatingPopup` (§6.7) · overlay Settings supprimé (hack `margin:-100`) au profit de `router.push('/runner')` · dédoublonnage milestones↔missions (missions de score → « Cap des 500/3000 ») · émojis pickups dédoublonnés des phases (Bergamote 🍊, Ambre ✨) · `PX_PER_METER` centralise la conversion px→m.
- **Game-feel** : **jump buffer** (un tap posé ≤ `JUMP_BUFFER`=120 ms avant l'atterrissage déclenche le saut au contact ; `lastTapTime` écrit par le geste, `bufferJumpTrigger` notifie le son+haptique) · **hit-stop** (`HIT_STOP_DURATION`=60 ms de freeze du monde à l'impact, `gameTime` continue d'avancer) · **combo aérien lisible** (nouveau `RunnerCombo.tsx` : « ×N » centré qui pulse à chaque pickup, vire au doré à ×4, coupé en Reduced Motion) · premier saut doublable (`canDoubleJump=true` au reset/GO).

**Vague 2 — Profondeur de jeu.**
- **Glissade « Sillage »** (2ᵉ dimension) : swipe bas (`Gesture.Pan` composé au `Gesture.Tap` via `Gesture.Race`, `activeOffsetY`+`failOffsetX` pour laisser passer le swipe-back natif) = le flacon se couche `DUCK_DURATION`=0,6 s, hitbox réduite (`DUCK_HEIGHT`=26) pour passer sous les cristaux volants, visuel accroupi (`DUCK_SCALE`=0,55, base compensée au sol).
- **Mode Fièvre** : jauge 0..`FEVER_MAX`=100 remplie par les pickups (+20) et frôlés (+8) ; pleine → `FEVER_DURATION`=4,5 s d'invincibilité + score ×`FEVER_SCORE_MULT`=2 + cristaux collectables (+15). Feedback : bannière « Fièvre ! » + haptique + son, barre de jauge dans `RunnerHud` (se vide pendant la fièvre), aura dorée du flacon (kind 5).
- *Micro-patterns d'obstacles reportés* (optionnel, équilibrage à valider à l'écran).

**Vague 3 — Rétention locale + pont catalogue.**
- **Carnet de runs** (`runner-stats.ts`) : stats lifetime locales (runs, distance cumulée, meilleurs combo/frôlés, notes par type, jours joués) — chaque course compte, pas seulement le record.
- **Missions à paliers** (`runner-missions.ts` réécrit) : 9 missions × 3 paliers (bronze/argent/or), persistance du plus haut palier atteint, badges « Label · N/3 » au game over + **prochain objectif** (`nextObjective`, effet « presque »).
- **Défi quotidien « Le geste du jour »** (`runner-daily.ts`) : objectif déterministe par date (seed = hash murmur3 de la date → LCG, équitable car indépendant du spawn), affiché sur l'accueil, coche une fois réussi. ⚠️ premier jet : LCG multiplicatif sur seeds proches = même défi pendant des mois → corrigé par le hash à avalanche.
- **Composition → vrai parfum** : au game over, les notes collectées (mapping pickup→note EN, top 2 par fréquence) alimentent `searchParfumsCached` → carte « Ta course a un sillage » (image + nom + marque) qui pousse vers la fiche détail. Le jeu cesse d'être une île.

**Fichiers créés** : `RunnerCombo.tsx`, `runner-stats.ts`, `runner-daily.ts`, `__tests__/runner/{runner-missions,runner-daily,runner-stats}.test.ts`.
**Fichiers modifiés** : `runner-types.ts` (constantes game-feel/duck/fièvre + `RUNNER_COLORS` + `GameStateValue` corrigé), `useRunnerLoop.ts` (jump buffer, hit-stop, duck, fièvre), `RunnerGame.tsx` (safe-area, gestes, carnet, missions, défi, suggestion parfum), `RunnerBottle.tsx` (duck + aura fièvre), `RunnerHud.tsx` (jauge fièvre + topInset), `runner-storage.ts` (`getSkinsForScore`), `runner-missions.ts` (réécrit en paliers), `app/settings.tsx` (suppression overlay).

**⚠️ Rendu jamais validé à l'écran** → `start.bat` requis (light/dark/Reduced Motion) : geste de glissade (conflit Pan/Tap à confirmer), hit-stop, combo meter, jauge de fièvre, carte « geste du jour » sur l'accueil, carte parfum suggéré au game over.

**Audit post-implémentation** (3 subagents en parallèle : bugs logiques/worklets, conformité design-guide, edge cases données) → corrections appliquées :
- **Bug fonctionnel majeur** : `FLYING_OBSTACLE_Y_OFFSET` 110→52 — à 110 le flacon *debout* évitait déjà les cristaux volants, donc la glissade n'esquivait rien (feature cosmétique). À 52 le debout touche, l'accroupi (`DUCK_HEIGHT`) passe dessous.
- **Coalescence same-frame** : `lastCollectedPickup` écrasé si 2 pickups la même frame (fréquent avec l'aimant) → composition/mission « Récolte »/suggestion faussées. Ajout de `pickupCounts` (SharedValues par type, comptage worklet précis) ; `collectedCounts` (JS) supprimé.
- **Race `unlockSkin`** : `Promise.all` de read-modify-write non atomiques → skins perdus en persistence. `unlockSkins` batch (1 lecture + 1 écriture).
- **Conformité** : Reduced Motion sur `RunnerSpeedLines` (§6.7 explicitement cité) · « Nouveau record ! »/« Fièvre ! » → sans « ! » (§3.6) · `RUNNER_COLORS` consommé par RunnerCombo/RunnerHud (+ commentaire honnête sur la migration progressive) · `accessibilityRole="button"` sur les boutons game over/pause · icônes `lock-closed`/`checkmark-circle` → outline · double haptique pickup+fièvre retirée (§2.6) · `goTimerRef` nettoyé au restart · commentaire « jauge se vide » corrigé (pas de drain).
- **Tests** : +7 (`recordRun` merge/playDays/JSON corrompu, migration missions ancien format tableau→`{}`).

**Tests** : 44 suites, 404 tests (+21 : missions à paliers, défi quotidien, stats, carnet). `tsc --noEmit` : 0 erreur global.

## Notes v8.21 — Flacon Runner : obstacles thématisés parfum (éclats, abeille, goutte) (01/08/2026)

**Remplacement des cristaux génériques** par un bestiaire/objet parfum (variété de comportements + ancrage « Sillage »). Aucun changement du modèle de données.

- **Éclats de flacon brisé** (reskin des 4 obstacles sol) — verre violet translucide à reflets, coins irréguliers. Cohérent avec le game over « Flacon brisé ». Géométrie/collision inchangées.
- **Abeille ondulante** (remplace le cristal volant) — corps rayé + ailes, **trajectoire sinusoïdale** (`obsY` piloté dans le loop : `groundY − FLYING_OFFSET + sin(gameTime·BEE_FREQ + i·1.7)·BEE_AMPLITUDE`). Ennemi vivant : à sauter par-dessus OU glisser dessous (`FLYING_OBSTACLE_Y_OFFSET` 52→62 = centre d'ondulation, calibré debout-touche / accroupi-passe).
- **Goutte d'essence qui tombe** (nouvel obstacle, type 5, dès 600 pts) — télégraphiée par une **ombre au sol** (`DROP_TELEGRAPH`=0,35 s), chute rapide (`DROP_FALL_SPEED`=1000), devient une flaque au sol à sauter. Dangereuse seulement quasi au sol (`dropSafe`). **Spawn compensé selon la vitesse** — mais **de la chute seule** (`spawnX = screenW + 50 + speed·chuteTime`, PAS `+ speed·(DROP_TELEGRAPH + chuteTime)`) : compenser aussi la télégraphie faisait atterrir la goutte hors écran et rendait l'ombre invisible (bug détecté au recheck). Ainsi l'ombre reste visible ~0,3 s avant l'impact et la flaque retombe à droite du flacon.
- **Architecture** : position verticale réelle centralisée dans `obsY[8]` (SharedValue par slot, lue par la collision ET le rendu) + `dropAt[8]` (télégraphie). `pickObstacleType(score)` (worklet) répartit éclats/abeille/goutte. `RunnerObstacles` réécrit (composants `Shard`/`Bee`/`Drop`/`DropShadow`, l'ombre rendue dans un conteneur séparé ancré au sol).

**Fichiers modifiés** : `runner-types.ts` (`OBSTACLE_DEFS` 6 types + `falling`, constantes abeille/goutte, `pickObstacleType`), `useRunnerLoop.ts` (`obsY`/`dropAt`, update Y par type, collision `dropSafe`, spawn compensé), `RunnerObstacles.tsx` (réécrit).

**⚠️ Équilibrage jamais validé à l'écran** → `start.bat` requis : ondulation de l'abeille (esquive saut/glissade), timing de la goutte (télégraphie + chute + flaque), taux de spawn (`pickObstacleType` 15 % goutte / 25 % abeille au-delà de 600 pts).

**Recheck (2 subagents : bugs logiques + équilibrage)** : bug majeur corrigé — la télégraphie de la goutte était **invisible** (compensation de spawn trop forte → la goutte atterrissait hors écran) ; compensation réduite à la **chute seule** + constantes recalibrées (`DROP_TELEGRAPH` 0,45→0,35, `DROP_START_HEIGHT` 260→240, `DROP_FALL_SPEED` 950→1000), l'ombre est visible ~0,3 s. Double-goutte : espacement basé sur la position d'atterrissage (anti-double-compensation). Near-miss en glissade sous l'abeille ajouté (récompense le duck). Imports morts retirés. Équilibrage validé par le calcul (abeille : duck passe avec 10 px de marge, saut fenêtre 0,62 s ; goutte = saut uniquement ; aucun pattern impossible).

**Note** : intègre le WIP parallèle « chip social ♥n » (`ParfumCard` + `price-alerts.ts` `priceAlertDropAbs`/`priceAlertState` + tests) — une accolade orpheline dans `price-alerts.test.ts` (coquille) a été retirée. **Tests** : 44 suites, 414 tests. `tsc --noEmit` : 0 erreur global.

## Notes v8.22 — Fiche détail : cluster prix corrigé, hero allégé, 1 accent, RelationSection compacte (01/08/2026)

**Refonte de la fiche détail parfum** (`app/catalog/[id].tsx` + composants), aucun changement de modèle de données. Brainstorm orchestré (4 angles : IA/scroll, visuel/conformité, contenu, interaction/perf) → 7 lots de corrections ancrés sur les screenshots réels (dark).

**Cluster prix & barre flottante (bug visible corrigé).** `priceSectionY` était mesuré dans le repère de `contentWrap` au lieu du scroll → la barre flottante apparaissait ~400 px trop tôt (prix dupliqué à l'écran) ; désormais `measureInWindow` + `scrollY` (repère contenu, robuste aux re-layouts quand la relation apparaît tard), offset nommé `STICKY_TRIGGER_OFFSET`. Spacer fixe 100 px → `paddingBottom` dynamique (`insets.bottom + 88`) + fondu `LinearGradient` derrière la barre → la dernière rangée ne transparaît plus. « — € » littéral retiré : sans prix, la barre passe en **slim** (`SaveButton` `flex:1`, `priceCol` masquée). `AlertPriceToggle` gaté sur `hasBestPrice` (plus d'alerte sur un prix absent). Prix **remonté** en 1ᵉ enfant de la carte (réponse « combien ? » sous le hero, sans scroller). Prix barre 18→20 px (§3.2), CTA `paddingVertical` 12 (≥44).

**Hero allégé + mémoire.** Retrait du **partage** dupliqué (header conservé, overlay hero retiré) et du bouton **expand** (le tap image ouvre déjà la lightbox). Overlay **2x retiré du hero** (la 1x suffit à 340 px `contain` ; la 2x reste dans `ImageViewerPopup`) → fin du doublon mémoire ~12 MB.

**Un seul accent (§2.4).** Chip **nez** doré (`secondary`, action de navigation) → **neutre** `surface2`/`text` + icône `textMuted` (l'identité du nez passe par l'icône empreinte, pas la couleur). Pastilles `AccordProfile`/`OlfactoryPyramid` icône `primary` → `primaryInk` (§2.2). Teinte `perf` (acier froid) **conservée** pour « Tenue & sillage » et **documentée** en exception dataviz §2.1/§4.9 (le swap `reward`/doré proposé par l'audit aurait réintroduit un 2ᵉ accent chaud, en contradiction avec le nez neutre). `offerPrice` `primary` → `text` (§2.4 : un prix n'est pas une action).

**Reduced Motion + a11y + cibles (§6.7/§6.8/§6.2).** `useReducedMotion()` ajouté sur le stagger `NoteCloud`, les `FadeIn` racines des 4 sections et le slide de la barre flottante. Dataviz vocalisée : `%` + « sélectionné » sur les accords, « ton vote » sur les dots mon-vote (perf + saison + moment). Cibles ≥44 px : `familyPill` (hitSlop 12), pétales (7), cranks (`minHeight` 44), chips moment (hitSlop 10). Italiques de **corps** → romain (vide pyramide + placeholder notes, §3.2) ; emoji d'émanation d'accord retiré (hors périmètre §4.15). Qualificatif d'accord neutre (`textMuted`) hors sélection (contraste dark).

**Perf & erreurs silencieuses.** `usePerfVotes` **remonté** dans `[id].tsx` et passé en props à `PerformanceProfile` + `SeasonProfile` → **1 RPC** `parfum_perf` par ouverture au lieu de 2 ; `key={parfum.id}` sur les deux (reset d'état entre navigations). `.catch` sur `getUserParfum` (`useSaveController`) ; `catch {}` similars → `console.warn`. Objet `useSaveController` mémoïsé (`useMemo`). Sheets `SaveSheet`/`TrySheet` fermées au logout (`useEffect` sur `isAuthenticated`).

**Contenu à donnée constante.** Étoile **+ compte d'avis** (`reviewCount`, masqué si 0). Concentration depuis `typeParfum` (fallback nom). **Origine** `country` en chip neutre (gaté valeur propre). **Année retirée** de la `badgeRow` (chip nu = bruit). Longévité **en heures** (`< 3 h`…`12 h +`, traduction du cran, champ `hours` dans `performance-profile.ts`). Similaires renommés « Dans le même esprit » → **« Ça s'en rapproche »** + **delta de prix** par carte (deal/overpriced, hors `ParfumCard` mémoïsé).

**RelationSection compacte (lot structurel).** Split **outer/inner** : l'outer lit seulement `save.item` et rend `null` sans aucun hook de données → plus de fetch `usePossessions`/`useSotd`/`useShelvesContext` à vide quand il n'y a pas de relation. Inner = **résumé en lecture** (badge statut + verdict + compteur possessions + bouton « Gérer » → `SaveSheet`) ; restent éditables inline ce que `SaveSheet` **n'a pas** : `StarRating`, étagères, toggles signature + SOTD. Statut/verdict/possessions/notes/retirer délégués à « Gérer » (déjà dans `SaveSheet`) → ~250 px gagnés, fin de la duplication à 70 %.

**Fichiers modifiés** : `app/catalog/[id].tsx` · `src/features/catalog/{StickyBottomBar,DetailHero,RelationSection,AccordProfile,PerformanceProfile,SeasonProfile,OlfactoryPyramid,pyramid/NoteCloud,useSaveController}.tsx` · `src/utils/performance-profile.ts` · `.clinerules/design-guide.md` (§2.1 + §4.9 : `perf` dataviz documenté, `secondary` décoratif) · `.clinerules/rules.md` (§13 : 415 tests).
**Fichiers créés / supprimés** : aucun.

**Décisions d'écart vs plan initial (justifiées).** (1) `perf` **non** swappé vers `reward` : cohérence avec le choix « 1 accent » (le nez neutre) — le doré aurait recassé §2.4. (2) Le `.in` du cache similars et le LRU client (J4) **reportés** : le cache DB qu'ils accélèrent est quasi-mort (écriture admin-only) → optimiser son read est sans effet ; noté pour un futur chantier. (3) Le compactage RelationSection garde inline rating + étagères (absents de `SaveSheet`) pour ne pas régresser l'accès — le sous-audit surestimait la couverture de `SaveSheet`.

**⚠️ Rendu jamais validé à l'écran** → `start.bat` requis (light / dark / Reduced Motion) : barre sans double prix ni transparaître (tuning fin de `STICKY_TRIGGER_OFFSET`), hero sans share/expand, 1 seul accent (nez neutre, perf acier), résumé « Ma relation » compact + « Gérer », heures de longévité, delta prix des similaires, chip `country`.

**Tests** : 44 suites, 415 tests (inchangés — aucun test ne couvre `[id].tsx`/`RelationSection`/`PerformanceProfile`). `tsc --noEmit` : 0 erreur global.

## Notes v8.23 — Alertes prix : correctifs, carte riche, notif → fiche, harmonisation, row « atteints » + hotfix suggestions + RGPD Supabase (01/08/2026)

**Onglet Alertes (tab Favoris)** — correction de fond + refonte UX (brainstorm orchestré + relecture hostile post-v8.22).

- **Bug critique orphelines** : une alerte créée depuis une fiche (hors favoris/parfumerie) était invisible (join `displayMap` `if (!d) continue`) mais le cron poussait quand même → push sans destination. Fix : `getParfumsByIds` (`catalog.supabase.ts`, lecture batchée PK) + fallback catalogue dans `favoris.tsx` (état `catalogFallback` mergé à `displayMap`).
- **Ancre `initial_price` réparée** : l'UI ne passait jamais `currentPrice` depuis le tab Favoris → prix/variation vides jusqu'au 1er cron. Désormais `handleAlertSave` pose l'ancre = **prix live** (fetch `getParfumById` à la création) ; `setPriceAlert` = **upsert conditionnel** (édition ≠ création : ne touche que `target_price`/`last_checked`, plus de ré-ancrage ni d'écrasement du `last_price` cron). `referencePrice` ajouté sur la branche user_parfum du `displayMap` (dot/prix barré/suggestion réparés).
- **Carte alerte riche** : marque overline, prix + officiel barré + dot `priceTier`, chips variation `−%`/`−€` (`priceAlertDropAbs`), états `priceAlertState` (reached « Objectif atteint » teal / near « Bientôt à ta cible » orange / watching caption), a11y §6.8 (tier + near vocalisés). Gestes : **tap = édition** (`PriceAlertSheet`), **long-press = fiche** ; bouton off inline retiré (la sheet gère on/off). Tri par buckets (atteintes → amplitude de baisse → veilles). Recherche dans la vue Alertes + vidée au changement de segment. Titre contextuel « Alertes · N ». `EmptyState` variante `alertes` (+ prop `actionLabel`).
- **`PriceAlertSheet`** : ligne « Prix actuel + officiel barré », « Ta cible est déjà atteinte », garde-fou stepper ≥ 5 €.
- **`AlertPriceToggle`** (fiche) : desc reflète l'état (« Objectif atteint » + icône teal).
- **Notif → fiche** : `_layout.tsx` — `setNotificationHandler` (SDK 57 : `shouldShowBanner`/`shouldShowList`), `addNotificationResponseReceivedListener` + `getLastNotificationResponse()` (synchrone) → `type==='price_alert'` → `router.push(/catalog/<id>)`. Copy cron « Baisse de prix ! » → sans « ! » (§3.6).
- **Harmonisation `ParfumCard`** : prop `priceAlert.state` (calculée dans les 2 parents, même source `lastPrice ?? bestPrice`) + `arePropsEqual` + mapping couleurs badges (reached teal, near orange) — fin de la schizophrénie violet/teal cross-vues.
- **Row « N objectif(s) atteint(s) »** en tête de la vue Alertes (cliquable = filtre, conforme §4.18, sans persistance).
- **Hotfix 0048** (`0048_fix_personalized_suggestions.sql`) : « Pour vous » lisait `wardrobe`/`scentlist` mortes depuis v8.0 → signaux rewrités sur `user_parfum` (have ×5 avec décroissance, verdicts love ×4/like ×2.5, négatif meh/dislike en exclusion). SQL pur, 0 changement de contrat.
- **RGPD → Supabase** : `privacy.tsx`/`privacy-center.tsx`/`legal.tsx`/`settings.tsx` — FCM → Expo Push, Firestore → Postgres (RLS), region europe-west1 → Europe Supabase, « wishlist » supprimée.
- **Fichiers** : `app/(tabs)/{favoris,collection}.tsx`, `app/_layout.tsx`, `src/components/{ParfumCard,PriceAlertSheet,AlertPriceToggle,EmptyState}.tsx`, `src/services/impl/{catalog,user-data}.supabase.ts`, `src/utils/price-alerts.ts` (state/dropAbs déjà dans fc5258a), `supabase/functions/check-price-alerts/index.ts`, `supabase/migrations/0048_*.sql`, docs RGPD, `__tests__/services/user-data.test.ts`.

**⚠️ À faire** : deploy cron (`supabase functions deploy check-price-alerts --no-verify-jwt`) + `supabase db push` (0048). Validation visuelle `start.bat` requise (light/dark/Reduced Motion) : carte riche, état atteint, tap=édition/long-press=fiche, row atteintes, tap notif → fiche. Limite : les anciennes alertes sans ancre restent sans variation (pas de backfill, politique assumée).

**Tests** : 44 suites, 415 tests (+1 `setPriceAlert` : l'édition ne ré-ancre pas). `tsc --noEmit` : 0 erreur global.