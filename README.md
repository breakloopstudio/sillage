# 🧴 ParfumScan React Native

<div align="center">

**Scanner de parfums intelligent — Reconnais n'importe quel flacon en une photo**

[![Expo SDK 57](https://img.shields.io/badge/Expo-SDK%2057-4630EB?logo=expo)](https://expo.dev)
[![React Native 0.86](https://img.shields.io/badge/React%20Native-0.86-61DAFB?logo=react)](https://reactnative.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-3178C6?logo=typescript)](https://www.typescriptlang.org)
[![Supabase](https://img.shields.io/badge/Supabase-Backend-3FCF8E?logo=supabase)](https://supabase.com)
[![Tests 312](https://img.shields.io/badge/Tests-312%20passed-brightgreen)](https://github.com/breakloopstudio/parfumscan-react)
[![License MIT](https://img.shields.io/badge/License-MIT-green)](./LICENSE)

</div>

---

## ✨ Fonctionnalités

| Module | Description |
|---|---|
| 🎨 **UI/UX « Luxe malin »** | Design system violet profond + doré/ambré + teal, 0 fontWeight, Inter + Playfair Display |
| 🧭 **Navigation** | 4 onglets swipeables (Catalogue · Favoris · Ma Parfumerie · Communauté) + FAB Scan central (DockBar verre dépoli), accès profil via avatar rond en haut à droite (SearchChrome) |
| 📸 **Scan intelligent** | Burst 3 photos → GPT-4o Vision (adaptatif : 70% en 1 appel, 30% en cross-ref 2 photos) → searchParfumsCached() |
| 🖼️ **Import galerie** | Photo existante → même pipeline IA, sans permissions supplémentaires |
| 📚 **Catalogue** | Catalogue ~25K parfums (seed Postgres), taxonomie 6 familles olfactives (cartes d'ambiance data-driven), rangées éditoriales (« Parfaits pour {saison} », « Les mieux notés »), capsules marques, grille 3 densités + persistance, recherche RPC Postgres (tsvector + pg_trgm) avec cache + prefix cache |
| 🏛️ **Page marque** | Catalogue complet d'une maison (depuis la fiche détail, les capsules et le sheet marques) : tri cyclique (populaires · prix · nouveautés), filtre par famille olfactive (6 familles, compteurs), densité partagée |
| 🧪 **Ma Parfumerie** | Meuble d'étagères (segmented Collection/Étagères, ShelfCard à rayons + flacons nus + tri ↕ + pin ★ + badge globe), CRUD enrichi avec drag (DraggableFlatList), édition inline, assignment long-press + ajout direct, visibilité publique + partage + « M'inspirer » (copie en lot). Pills statut (Tous · À sentir · Je l'ai · Fini) + filtre ♥ + badge 🔔, possessions, signature, SOTD+météo, partage collection, mode Collection (grille, statuts, filtres, ♥, densités) |
| 🧪 **Décants & échantillons** | Tailles dédiées 2–30ml, distinctes des formats full-size (30–200ml) |
| ⭐ **Parcours de statut** | Un parfum = une ligne `user_parfum` dont le statut évolue (À sentir → Je l'ai → Fini), verdict + note + impressions, alertes prix (cible custom + historique) |
| ❤️ **Favoris** | Onglet dédié (couche intention) : tous les coups de cœur, section « Tes alertes », pills (Tous · À traiter · Alertes), alertes prix v2 (cible custom pré-remplie, badge 🔔), long-press `FavoriSheet` (fiche · alerte · graduation vers la Parfumerie) |
| 👥 **Communauté** | Vitrine publique (top aimés, tendances 7j, collections à découvrir, SOTD du jour, recherche pseudo), verdicts publics sur la fiche (« Adoré par @x, @y »), follow asymétrique (bouton Suivre + compteurs), activité des suivis (« Nez que tu suis »). **Étagères publiques** par étagère (visibilité `is_public`), landing SSR `type=shelf` (OG + deep link), page publique `/u/[pseudo]/shelf/[id]`, bouton « M'inspirer » (copie en lot → À sentir). Profils publics opt-in, partage landing SSR (OG + deep link) |
| ⚙️ **Paramètres** | Alertes prix, devise EUR, notifs push, mentions légales |
| 🧠 **Fiche unifiée v8.1** | Fiche catalogue + section « Ma relation » (statut, verdict, note, impressions, possessions, étagères, signature, SOTD) fusionnées. DetailHero (swap progressif image HD upscale ×4), CollapsingHeader (UI thread), barre d'action flottante, pyramide olfactive interactive, « Quand le porter » (colonnes saisons + chips occasions), signature nez, note detail popup, image viewer popup HD |
| 🔐 **Auth optionnelle** | App utilisable sans compte, `AuthGate` partagé demande la connexion uniquement quand nécessaire |
| 📴 **Mode hors-ligne** | Bannière réseau globale (OfflineBanner dans `_layout.tsx`), état `reconnected` 2.5s, contenu dégradé via cache Firestore local |
| 🌓 **Dark Mode** | 3 modes (système/clair/sombre), persistance AsyncStorage, SystemUI + NavigationBar theming, keyboardAppearance adaptatif |
| 🎙️ **Recherche vocale** | Dictée vocale (expo-speech-recognition, on-device) + fallback OpenAI Whisper (Cloud Function), VoiceOverlay 5 phases avec transcript live et top résultats |
| 🌤️ **Météo & suggestions** | Widget météo (Open-Meteo, gratuit), scoring des parfums adaptés à la météo dans la parfumerie, tri "Météo", SOTDPicker pré-trié, badge de compatibilité, notification push quotidienne à 7h via Cloud Function |
| 🎮 **Flacon Runner** | Easter egg : endless runner dans Settings (5 taps version). Saut/double-saut, obstacles, combos, score lisse, milestones, skins déblocables, Reanimated UI thread |
| 🖼️ **Images HD** | Upscale ×4 (Real-ESRGAN + CUDA) des flacons pour la fiche détail/lightbox ; les listes restent en 1x (perf) |

---

## 🏗️ Stack technique

| Catégorie | Technologies |
|---|---|
| **Frontend** | React Native 0.86, Expo SDK 57, Expo Router 57 |
| **Langage** | TypeScript 6.0 (strict) |
| **Navigation** | Expo Router (file-based) + react-native-pager-view (native pan) |
| **Animations** | React Native Reanimated 4, Gesture Handler 2, react-native-svg, react-native-draggable-flatlist 4 |
| **Backend** | Supabase (Auth, Postgres + RLS, Storage, Realtime, Edge Functions Deno) |
| **IA** | GPT-4o Vision (analyse photo), OpenAI Whisper-1 (transcription vocale), Postgres tsvector + pg_trgm (catalogue 25K parfums) |
| **Formulaires** | React Hook Form 7 + Zod 4 |
| **Tests** | Jest 29 + jest-expo + Testing Library — 312 tests, 33 suites + E2E Supabase (24 checks) |

---

## 🚀 Démarrage rapide

### Prérequis
- Node.js ≥ 18
- Supabase CLI (`npm i -g supabase`) + Docker Desktop (backend local)
- Expo CLI (`npx expo`)

### Installation

```bash
git clone https://github.com/breakloopstudio/parfumscan-react.git
cd parfumscan-react
npm install
```

### Variables d'environnement

```bash
# .env (jamais committé) — clés Supabase + Google
EXPO_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...
EXPO_PUBLIC_USE_SUPABASE=true
SUPABASE_SERVICE_ROLE_KEY=eyJ...        # scripts d'import uniquement
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=...
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=...

# Edge Functions (Vault) :
#   supabase secrets set OPENAI_API_KEY=sk-... CRON_SERVICE_ROLE_KEY=...
```

### Lancement

```bash
# Backend local (Postgres + API + Edge Functions)
supabase start

npm start
npm run android   # ou npm run ios
```

### Build APK (installation sur téléphone)

```bash
# 1. Builder l'APK release
build_release.bat

# 2. L'APK est dans :
#    android/app/build/outputs/apk/release/app-release.apk

# 3. Transférer sur le téléphone (USB, cloud, Telegram...)
# 4. Ouvrir le fichier .apk sur le téléphone → Installer
```

---

## 🌓 Dark Mode

ParfumScan propose un mode sombre complet disponible **sans authentification**.

- **3 modes** : Système (défaut, suit les réglages du téléphone), Clair, Sombre
- **Toggle** : dans Paramètres → Apparence (segmented control Clair / Système / Sombre)
- **Persistance** : la préférence est sauvegardée dans AsyncStorage (`@parfumscan/theme`)
- **Palette « Luxe profond »** : fond violet-noir `#0B0712`, violet `#8B6CF6`, doré `#D4A960`, teal `#2DD4BF`
- **Architecture** : `ThemeProvider` → `useTheme()` hook → `getStyles(t: Theme)` + `useMemo` dans chaque composant
- **StatusBar** : automatiquement adaptée (texte clair en dark, foncé en light)
- **Ombres** : remplacées par des bordures subtiles en mode sombre (les ombres noires sont invisibles sur fond sombre)

---

## 📁 Architecture

```
app/
├── _layout.tsx               # Root : ThemeProvider → GestureHandlerRootView → AuthProvider → AuthGuard → ErrorBoundary
├── index.tsx                 # Splash → redirection tabs
├── (tabs)/
│   ├── _layout.tsx           # TopTabs (4 onglets swipeables) + DockBar custom (FAB Scan central) + SearchChrome (barre recherche + avatar profil rond) + NavigationChromeProvider
│   ├── index.tsx             # Catalogue (hôte CatalogPage)
│   ├── favoris.tsx           # Favoris (tous les ❤️, section « Tes alertes », pills, long-press FavoriSheet, prix visibles)
│   ├── collection.tsx        # Ma Parfumerie : segmented Collection|Étagères, mode Collection (grille, statuts, filtres, ♥, densités), mode Étagères (ShelfCard+rayons+tri/pin+Non classés), CRUD drag+édition, assignment long-press, ajout direct, visibilité publique + partage + gate, badge 🔔, vues système Signature/Cœurs, M'inspirer
│   └── communaute.tsx        # Communauté (placeholder « Bientôt »)
├── auth/
│   ├── login.tsx             # Connexion email + Google
│   └── register.tsx          # Inscription
├── catalog/[id].tsx          # Fiche unifiée v8.1 (DetailHero + section « Ma relation », pyramide, « Quand le porter »)
├── wardrobe/[parfumId].tsx   # Redirect vers /catalog/[parfumId] (fiche unifiée)
├── perfumer/[name].tsx       # Créations d'un nez
├── brand/[name].tsx          # Catalogue d'une maison (tri cyclique + filtre famille)
├── profile.tsx               # Profil (route racine, poussée depuis l'avatar — identité, stats, SOTD, profil public, déconnexion)
├── u/[pseudo].tsx            # Profil public d'un membre (lecture seule, sans auth, cible du deep link de partage)
├── u/[pseudo]/shelf/[shelfId].tsx  # Étagère publique (lecture seule, sans auth, cible du deep link de partage d'étagère) + bouton « M'inspirer »
├── settings.tsx              # Paramètres
├── scan.tsx                  # Scan (slide_from_bottom)
├── search.tsx                # Recherche (texte + mode famille ?family=<key>)
├── history.tsx               # Historique des scans
├── scentlist.tsx             # Redirection → /(tabs)/collection
├── runner.tsx                # Flacon Runner (easter egg, slide_from_bottom)
├── legal.tsx / privacy.tsx / privacy-center.tsx / delete-account.tsx
└── admin.tsx                 # Administration

src/
├── services/     (17)        # supabase, catalog, user-data, user-parfum, possessions, profile, community, account, openai-vision, voice-search, weather, storage, push, haptics, theme-storage, catalog-bridge, runner (leaderboard Flacon Runner)
├── services/impl/            # impl Supabase de chaque service + search-shared + sql-utils (service public = export * from impl/<x>.supabase)
├── hooks/        (21)        # useAuth, useCatalog, useCommunityHighlights, useDensityPreference, useNetwork, usePriceAlerts, useMyProfile, usePublicProfile, useProfileStats, useScanPipeline, useScanReducer, useScans, useUserParfum, usePossessions, useFavorisViewPreference, useShelfItems, useParfumerieViewPreference, useSotd, useVoicePreference, useVoiceSearch, useWeather
├── contexts/     (5)         # AuthContext, FavorisContext, UserParfumContext (source de vérité user_parfum temps réel), PriceAlertsContext (alertes prix temps réel), ShelvesContext (étagères temps réel — remplace useShelves) — ThemeContext est dans src/theme/
├── components/   (23)        # ParfumCard (badges statut/rating/🔔, hidePrice, onLongPress), Button, PriceDisplay, SectionHeader, EmptyState, OfflineBanner, AlertPriceToggle, AppLoader, ErrorBoundary, NoteDetailPopup, ImageViewerPopup, ActionSheet, FilterSheet, AuthGate, FavButton, StatuerSheet, FavoriSheet, PriceAlertSheet, PublicProfileCard, AddToShelfSheet, PublishShelfGateSheet, InspireShelfSheet, InfoPopup
├── theme/        (2)         # theme.ts (double palette light/dark), ThemeContext.tsx
├── features/                 # scan, catalog (+ RelationSection), wardrobe (SOTDCard/SOTDPicker/StarRating/ShelfManager/ShelfCard/BottleThumb), search, navigation (DockBar 4 onglets + FAB), scentlist (TrySheet), runner
├── models/       (8)         # Parfum (+imageUrl2x), UserParfum (+UserParfumStatus, ScentVerdict, Possession, Shelf (+description/isPublic), ShelfItem, SotdEntry), UserPriceAlert, MyProfile/PublicProfile/PublicCollectionItem/PublicShelf/PublicShelfItem, UserFavori, UserScan, ScanResult, index
├── config/       (2)         # env, index
└── utils/        (20)        # error-translator, translate-note, note-descriptions, normalize, season, favori-filters, contrast, format-price, suggest, weather-codes, weather-scoring, olfactory-families, status-chips, verdicts, price-alerts, share, alpha, brand-color, shelf-grouping, price-tier

supabase/                     # Backend Supabase (versionné)
├── migrations/   (0001→0040) # extensions, types, tables (dont shelf_items position+pin), index, RLS, RPC (search_parfums, reorder_shelves, public_shelf/public_shelf_items, add_to_shelf/remove_from_shelf/pin_shelf_item/reorder_shelf_items...), cron pg_cron, image_url_2x, user_parfum, price_alerts v2, profiles, public shelves, grants
├── functions/                # Edge Functions Deno : analyze-perfume-image, transcribe-voice, check-price-alerts, send-notification, send-weather-notifications, delete-user-account, share (landing SSR de partage) + _shared/
└── config.toml               # config projet (secrets via env(...))
```

---

## 📊 Données — Catalogue (~25 100 parfums)

Le catalogue est importé depuis un scrape Fragrantica (239 marques), nettoyé et hébergé en autonome sur **Supabase** (table Postgres `parfums` + bucket Storage `parfum-images`) — **zéro dépendance à l'API Fragella** pour le socle de données.

### Pipeline

```
data/raw/              data/clean/            Postgres + Supabase Storage
239 JSON (1.27 GB)  →  239 JSON (31 MB)   →  parfums (table) + parfum-images (bucket)
scrape Fragrantica      données factuelles     recherche tsvector + pg_trgm
                                               image_url (1x) + image_url_2x (HD ×4)
```

| Étape | Script | Action |
|---|---|---|
| 1. Nettoyage | `npm run clean-data` | `scripts/clean-apify.ts` — débruite, déduplique, strip les champs traçants |
| 2. **Import frais** ⭐ | `npm run import-fresh -- --target=cloud` | `scripts/import-fresh.ts` — depuis `data/clean/` : transforme, télécharge l'image (URL Fragrantica), bg removal optionnel (`--bg`), WebP, upload Storage + upsert Postgres. Idempotent, resumable. Laisse `image_url_2x` NULL |
| 3. **Upscale HD ×4** | `npm run migrate-upscale` | `scripts/migrate-upscale.ts` — workers Python Real-ESRGAN + CUDA, génère `primary_2x.webp` (1500×2000) + `image_url_2x`. Fiche détail/lightbox uniquement, resumable |

**Flux pour un nouveau scrape** : `npm run clean-data && npm run import-fresh -- --target=cloud && npm run migrate-upscale`

<details>
<summary>Étapes historiques (migration Firebase → Supabase, non réutilisables)</summary>

| Étape | Script | Action |
|---|---|---|
| Export Firestore | `npm run export-firestore` | dump NDJSON depuis l'ancien backend Firebase |
| Import Supabase | `npm run import-supabase` | upsert Postgres depuis `parfums.ndjson` |
| Images | `npm run migrate-storage` | Firebase Storage → bucket `parfum-images` |
| WebP / BG removal | `npm run migrate-webp` / `migrate-bg` | conversion + suppression de fond |

</details>

### Images

- **Format** : WebP 375×500 (1x, converti depuis les vignettes scrape JPG) + WebP 1500×2000 (2x HD, upscale Real-ESRGAN)
- **Stockage** : Supabase Storage (bucket public `parfum-images`) → `parfums/{id}/primary.webp` (1x) + `primary_2x.webp` (HD)
- **Affichage** : listes/grilles en 1x ; fiche détail + lightbox fondent de la 1x vers la 2x (`image_url_2x`)
- **Fallback UI** : initiale de la marque sur fond coloré (si image absente)

### Mapping des données

| Colonne Postgres | Source raw |
|---|---|
| `nom`, `annee`, `type_parfum` | Parsé depuis `title` |
| `notes_tete/coeur/fond` | `pyramid.topNotes/middleNotes/baseNotes[].name` |
| `main_accords` | `mainAccords[].accord` (noms uniquement, pas les couleurs) |
| `search_text` / `search_vector` | **générées** (normalisation + tsvector) pour la recherche |
| `image_url` | `primaryImageUrl` → téléchargé → Supabase Storage |
| `source` | `'seed'` (données importées, pas d'API live) |

---

## 📱 Flux de scan (v5.7 — burst adaptatif)

```
Idle → [Tap Scanner] → CameraView → [Capture]
  → Burst 3 photos (~1s, haptics×3) → GPT-4o Vision (photo 1, detail:auto → retry high si vide)
  → Confidence haute ? → searchParfumsCached() → Résultats (~2s)
  → Confidence basse ? → analyzeMultipleImages (photos 2+3, cross-ref) → searchParfumsCached() → Résultats (~4s)
  → Résultat → Tap parfum → setPendingParfum() → dismissTo tabs
      → TabPager consume + re-set → push /catalog/:id
      → Fiche détail consumePendingParfum() → données enrichies affichées
  → Résultat → Voir catalogue → setPendingCatalogQuery() + router.back()

Import galerie : expo-image-picker → 1 photo → pipeline burst (single-photo path)
```

> **Pont inter-écrans** : `setPendingParfum()` stocke les données en mémoire,
> `consumePendingParfum()` les lit une seule fois. Le TabPager re-stocke
> immédiatement après consommation pour que la fiche détail les reçoive.

### Fiche détail enrichie

La page `app/catalog/[id].tsx` affiche les métadonnées du catalogue Firestore :
- Longévité & Sillage (jauges visuelles avec labels)
- Prix, réduction, lien affilié
- Pyramide olfactive v5 (SVG unifié interactif au touch, légende 3 boutons avec compteurs, notes cliquables → popup détail)
- Photo cliquable → popup plein écran (ImageViewerPopup)
- Accords principaux (barres triees par score decroissant - traduits en francais)
- Saisonnalite
- Occasions
- Badge famille olfactive (traduit FR)
- Notes capitalisees (1ere lettre majuscule)

> **Indicateur dev** : pastille en haut a droite (visible uniquement en __DEV__)
> - Violet = donnees admin (seed/manual)
> - Rouge = source inconnue (fallback)

## 📚 Flux de recherche (RPC Postgres + cache client)

```
Saisie ≥ 3 caractères → useCatalog() → debounce 150ms → requestIdRef anti-race
  1. Cache exact (LRU) → hit instantané
  2. Prefix cache → re-score local sur search_text (frappe progressive, 0 RPC)
  3. RPC search_parfums : candidats trgm (search_text %> token) ∪ FTS (search_vector @@ tsquery),
     scoring serveur (word_similarity + exact +10 + popBonus), fuzzy similarity si < 5, dédup, limit 50
  4. Tri : pertinence primaire + popularité tiebreaker
```

Avantage : le scoring lourd (trgm + FTS + fuzzy) tourne côté Postgres ; cache + prefix cache → la plupart des frappes ne touchent pas le serveur.
Les résultats sont triés par pertinence + popularité, pas alphabétiquement.

### Catalogue idle (v5.7)

À l'ouverture (sans recherche) :
- Si authentifié → `getPersonalizedSuggestions(uid)` : scoring client-side basé sur l'historique de scans/favoris (familleOlactive×3 + marque×2 + popularityScore/20), exclut les parfums déjà vus. Section "Pour vous".
- Fallback → `getPopularParfums(30)` → Firestore (triés par popularityScore desc), shuffle journalier déterministe (Lehmer RNG). Section "Parfums populaires".
- Affichage en grille 2 colonnes avec `ParfumCard compact`.

Les miniatures sont affichées via Firebase Storage
(gratuit, pas d'appel API). Fallback automatique sur icône scan/cœur si l'image échoue.
Le bouton unfavorite utilise un cœur avec animation heartbeat (scale bounce 250ms).


### Favoris & Historique enrichis

Les documents `UserFavori` et `UserScan` stockent `imageUrl` et `familleOlactive`
dénormalisés → affichage direct sans appel API Firestore supplémentaire.

---
## v8.9 — Accords olfactifs, Flacon Runner v2, contextes, performances (30/07/2026)

- **Accords olfactifs (fiche détail)** : `AccordProfile` + `accord-profile.ts` remplacent l'ancienne `AccordBar` — 5 accords en barres colorées par famille (tokens `accord0–7`), qualificatif FR, expansion animée, aphorisme italique, haptique. 8 nouveaux tokens thème (light + dark).
- **Flacon Runner v2** : 4 notes à pouvoirs (magnet/shield/double/slow-mo), 3 vies + invulnérabilité, 8 missions persistées, **classement mondial** (`runner_scores` + 2 RPC, service `runner.ts`), HUD/particles 100 % UI-thread, refonte visuelle, skins/pause/mute, route `/runner`. L'onglet Communauté affiche le leaderboard + SOTD + météo.
- **Contextes** : `ShelvesContext` (remplace `useShelves`, 1 subscription partagée), `useFavorisViewPreference` (vue Favoris/Alertes persistée), `InfoPopup`. Tab Favoris : segmented Favoris / Alertes.
- **Performances** : `ParfumCard` mémoïsé (`React.memo` + comparateur), images en `cachePolicy="memory-disk"` + `recyclingKey` (cartes + vignettes), `Image.prefetch` du pool catalogue, virtualisation recherche (`windowSize`/`maxToRenderPerBatch`, clés stables, plus de remount au changement de thème).
- **Nettoyage** : suppression de l'héritage Firebase (`functions/`, `firebase.json`, `firestore.indexes.json`, 9 scripts).
- **Tests** : 33 suites, 312 tests (+6 suites). `tsc --noEmit` : 0 erreur app/ + src/.

## v8.8 — DockBar refonte : compact au scroll, indicateur pill/halo, FAB obturateur (29/07/2026)

- **Comportement 3 états** : expanded (icônes + labels) → **compact** au scroll (labels effondrés, barre amincie, FAB qui émerge) → **hidden** (vélocité / profondeur). Reveal en compact, expanded seulement tout en haut. Machine à états dans `NavigationChromeContext` (`dockCompact` + `dockTranslateY`).
- **Indicateur pill/halo** : le trait doré est retiré (conflit d'accent §2.4) au profit d'une pill `primarySoft` qui glisse au spring et se dissout en halo `tintLuminous` en compact. **FAB obturateur** : anneau `primary` à gradient (rim light + ombrage) cerclant un disque creux ; pulse perpétuel retiré → feedback au touch. Indicateur « stretchy » au changement d'onglet (coupé en Reduced Motion).
- **Tests** : 27 suites, 287 tests (inchangés).

## v8.7 — Étagères « meuble » + communauté d'étagères (28/07/2026)

- **Meuble privé (P0–P1).** Segmented `Collection | Étagères` (vue adaptative), pile de `ShelfCard` (rayons + flacons nus) : vues système (Signature, Cœurs), étagères custom, Non classés. CRUD enrichi + drag (DraggableFlatList), édition inline. Assignment long-press, ajout direct, persistance du dépliage.
- **Communauté d'étagères (P2–P3).** Visibilité `is_public` par étagère + badge globe ; gate d'activation inline du profil ; partage `shelfShareUrl`/`shelfDeepLink` + landing SSR `?type=shelf` ; page publique `/u/[pseudo]/shelf/[id]` ; « M'inspirer » (copie en lot vers `to_try`).
- **Ordre & pin (B-réel).** Table `shelf_items` (position + pin), 4 RPC atomiques miroir `shelf_ids`, trigger nettoyage orphelins. Tri ↕ par étagère (Personnalisé/Nom/Maison/Famille/Récents). Pin ★ dans la StatuerSheet. Fallback si migration non poussée (rien ne casse).
- **Migrations** : 0037 (description/is_public), 0038 (reorder_shelves), 0039 (public_shelf*), 0040 (shelf_items + RPC atomiques + trigger).
- **Tests** : 287 tests, 27 suites (+23 tests). `tsc --noEmit` : 0 erreur app/ + src/.

## v8.5 — Page marque + cibles tactiles ≥ 44 px (27/07/2026)

- **Page marque** (`app/brand/[name].tsx`) : catalogue complet d'une maison, accessible depuis la chip « La maison » de la fiche détail et les sélecteurs de marques (`BrandCapsules`, `BrandSheet` → `/brand/` au lieu de la recherche). Tri cyclique (Populaires · Prix croissant · Prix décroissant · Nouveautés), filtre par famille olfactive (6 familles, compteurs, couleurs sémantiques), densité partagée. Service `getParfumsByMarque` (`.eq('marque')`, limit 1000) + helper `getFamilyByValue`. Index b-tree `marque` (migration 0026).
- **Fiche détail** : la signature « Le nez » devient une ligne maison + nez (chip marque violette `storefront-outline` avant les chips nez dorés).
- **Cibles tactiles (§6.2)** : `hitSlop` ≥ 44 px (visuels inchangés) sur les icônes de densité et chips/pills de brand, collection et favoris (search déjà conforme).
- **Tests** : 259 tests, 24 suites.

## v8.4 — Communauté Phase 1 : profils publics & partage (15/09/2026)

- **Profils publics (opt-in)** : table `profiles` (migration 0023 — pseudo unique + bio + `is_public`), RPC `public_profile`/`public_collection` (`SECURITY DEFINER`, **notes perso exclues**), service `profile.ts` + hooks `useMyProfile`/`usePublicProfile`.
- **Partage & landing SSR** : Edge Function `share` (HTML on-brand + **balises OG/Twitter** → aperçu riche iMessage/WhatsApp/Instagram, bouton deep link `parfumscan://`, mention store). 3 surfaces : fiche · Ma Parfumerie (si profil public) · SOTD (long-press « Aujourd'hui je porte… »).
- **UI** : `PublicProfileCard` (section « PROFIL PUBLIC » du profil, validation pseudo), route publique `/u/[pseudo]` (lecture seule, accessible sans auth).
- **Périmètre** : pas de feed/follow/UGC modéré (brique la plus sûre) ; agrégats anonymes & « nez compatibles » reportés (cold-start, 0 utilisateur).
- **Tests** : 222 tests, 20 suites (+ `share.test.ts`).

## v8.3 — Tab Favoris restauré + Alertes prix v2 (4 onglets) (22/08/2026)

- **Navigation** : 2 onglets → **4 onglets** (Catalogue · Favoris · Ma Parfumerie · Communauté placeholder) + FAB Scan central. `DockBar` recalculé (4 slots).
- **Tab Favoris** : tous les ❤️ (couche intention, modèle orthogonal v8.0 enfin reflété), section « Tes alertes », pills (Tous · À traiter · Alertes), prix visibles, long-press `FavoriSheet` (fiche · alerte · graduation vers la Parfumerie · retrait).
- **Alertes prix v2** : prix cible custom pré-rempli (`suggestTargetPrice`), `price_history` (« plus bas constaté »), `onPriceAlerts` realtime + `usePriceAlerts`, `PriceAlertSheet` (surface unique, aussi sur la fiche), badge 🔔 transversal, push différencié (migration 0022).
- **Ma Parfumerie simplifiée** : source `user_parfum` uniquement (**fin de l'union `buildMyParfums`**, `my-parfums.ts` supprimé), badge 🔔.
- **Tests** : 215 tests, 19 suites (+ `price-alerts.test.ts`).

## v8.2 — Ma Parfumerie : vocabulaire statuts, densité en icônes, prix masqué, filtre ♥ (27/07/2026)

- **Vocabulaire** : pill « À statuer » supprimée (un cœur sans statut → « À sentir »), « Je l'ai eu » → « Fini », icônes alignées — vocabulaire unique partagé pills = chips fiche = badges carte.
- **Densité en icônes** : toggle texte → 3 boutons icônes (`grid/apps/list-outline`).
- **Prix masqué** : prop `hidePrice` sur `ParfumCard` (Ma Parfumerie = vue de relation, pas d'achat).
- **Filtre ♥ transversal** : bouton coups de cœur cumulable avec la pill, l'étagère et la recherche.
- **Tests** : 218 tests, 19 suites.

## v8.1 — Refonte UX : 2 onglets, fiche unifiée, « Ma Parfumerie » (26/07/2026)

- **Navigation** : 4 onglets → **2 onglets** (Catalogue · Ma Parfumerie) + FAB Scan central. Accès profil = avatar rond en haut à droite (dans `SearchChrome` → route racine `/profile`). `DockBar` recalculé (2 onglets + FAB centré). Onglet `selection.tsx` supprimé, `profile` déplacé en route racine.
- **Fiche unifiée** : `catalog/[id]` absorbe la fiche personnelle — nouvelle section « Ma relation » (`RelationSection` : statut, verdict, note, impressions, possessions, étagères, signature, SOTD). `wardrobe/[parfumId]` → redirect.
- **Ma Parfumerie** : union favoris + `user_parfum` (`my-parfums.ts`), 4 pills (Tous · À sentir · Je l'ai · Fini) + filtre ♥ transversal, grille `ParfumCard` (badges statut/rating, prix masqué), long-press universel (`StatuerSheet`).
- **Modèle 3 statuts** : `status-chips.ts` — 5 statuts DB → 3 chips UI (À sentir / Je l'ai / Fini ; `want`+`tried` → « À sentir », `want` invisible). `verdicts.ts` (`VERDICT_OPTIONS` relocalisé).
- **Nettoyage** : suppression de `FavoritesContent`, `ScentListContent`, `ScentCard`, `ScentListEntry`, `WardrobeGrid`, `WardrobeCard`, `WardrobeQuickSheet`, `FilterBar` + code mort.
- **Tests** : 218 tests, 19 suites (+ `my-parfums.test.ts`).

## v8.0 — Modèle unifié user_parfum + possessions (26/07/2026)

- **Modèle** : fusion `wardrobe` + `scentlist` en une table `user_parfum` (PK user_id + parfum_id, statut `to_try|tried|want|have|had`, verdict, rating, notes, shelves, SOTD). Objets physiques → `possessions` multiples (flacon/décant/échantillon). Le cœur (`favoris`) reste une table indépendante.
- **Principe** : un parfum = une ligne dont le statut évolue (transitions libres), le cœur est orthogonal au statut.
- **Migration SQL** : `0021_unified_user_parfum.sql` (nouvelles tables + backfill + RPC mises à jour).

## v7.1 — Catalogue éditorial, images HD, scroll UI-thread, durcissement (26/07/2026)

- **Images HD (upscale ×4)** : pipeline `scripts/migrate-upscale.ts` (workers Python persistants Real-ESRGAN + CUDA, ~0,5 img/s) génère `primary_2x.webp` (1500×2000) + colonne `parfums.image_url_2x` (migration 0017). La fiche détail (`DetailHero`) et la lightbox (`ImageViewerPopup`) affichent la 1x immédiatement puis fondent vers la 2x ; les listes restent en 1x (perf). Champ `Parfum.imageUrl2x`.
- **Taxonomie familles** : `src/utils/olfactory-families.ts` regroupe ~46 valeurs anglaises en 6 familles FR (boisée, florale, hespéridée, ambrée, gourmande, aromatique). `FamilyAmbianceCards` v2 data-driven (flacon réel + effectif via `getFamilyOverview`), recherche en mode famille (`/search?family=<key>`).
- **Catalogue** : nouvelles rangées « Parfaits pour {saison} » (RPC `seasonal_parfums`, migration 0015) et « Les mieux notés » ; compteur de parfums dynamique (`getParfumCount`). Nouvelles fonctions catalogue : `getTopRatedParfums`, `getParfumsByFamily`, `getFamilyOverview`, `getSeasonalParfums`. Code mort supprimé (`onParfums`, `createParfum`, `deleteParfum`…).
- **Scroll UI-thread** : le callback `onScroll(y)` JS est remplacé par une `SharedValue scrollY` (`NavigationChromeContext`) écrite via `useAnimatedScrollHandler` dans toutes les listes. `CollapsingHeader` 100% UI thread (crossfade, plus de `LayoutAnimation`).
- **Auth** : nouveau composant partagé `AuthGate` (dé-duplique les gates de profile, collection, favoris, carnet). `useCollection` supprimé (concept « Collection » abandonné au profit de la Parfumerie unifiée).
- **Durcissement Edge Functions** : suppression de `getUserIdFromAuth` (ne vérifiait pas la signature JWT) au profit de `verifyUserToken` ; limites scan (5 images, 5 Mo), whitelist MIME audio, timeouts, pagination des alertes prix, batch météo en `Promise.allSettled`.
- **Realtime** : `subscribeUserTable` durci (bufferisation des événements arrivant avant la fin du fetch initial, canaux uniques).
- **Config** : auth Supabase durcie (mot de passe 8 car. `letters_digits`, confirmation d'email) ; retrait des variables d'émulateurs Firebase de `env.ts`.
- **Utils** : `season.ts` — `currentSeason()` + `SEASON_META.withArticle`. Copy généralisé au tutoiement.
- **Tests** : 227 tests, 18 suites (+ `season.test.ts`).

## v7.0 — Migration backend Firebase → Supabase (25/07/2026)

- **Backend** : remplacement complet de Firebase (Auth/Firestore/Storage/Cloud Functions/FCM) par **Supabase** (Auth, Postgres + RLS, Storage, Realtime `postgres_changes`, Edge Functions Deno). Voir `MIGRATION_SUPABASE.md`.
- **Schéma** : 9 migrations SQL (tables, RLS `auth.uid()=user_id`, index `pg_trgm`/tsvector, RPC, crons `pg_cron`).
- **Recherche** : RPC `search_parfums` (tsvector + `pg_trgm`) remplace `array-contains` sur `searchKeywords` (supprimé → colonnes générées `search_text`/`search_vector`). Caches client (LRU + prefix cache) conservés.
- **Couche services** : chaque service = dispatcher `export * from './impl/<x>.supabase'` ; signatures publiques inchangées. `useAuth` expose `AppUser` (uid = UUID Supabase).
- **Push** : FCM → **Expo Push** (table `push_tokens`), plugin `expo-notifications`.
- **Edge Functions** : 6 fonctions déployées (scan GPT-4o, Whisper, alertes prix, météo, notif, delete RGPD) + 3 crons.
- **Dépendances** : retrait de `@react-native-firebase/*` ; ajout `@supabase/supabase-js`, `react-native-url-polyfill`, `expo-notifications`.
- **Tests** : mock `@supabase/supabase-js` (jest-setup.js), 216/216 verts + E2E cloud 24/24 (`npm run test:supabase`).

## v6.10 — Search v2 + Similar Parfums refonte + UI fixes (21/07/2026)

- **Search v2** : cache Map (exact + prefix cache local), dual query Firestore (1 token `array-contains` + `orderBy reviewCount`, 2+ tokens `array-contains-any`), `exactMatch` réservé aux queries multi-mots, signal composite `Math.max(reviewCount, ratingCount, popularityScore)`, bonus popularité `/2`, scoring single-pass (boucle for), tri pop-first pour 1 token, 50 résultats max, debounce 150ms, `requestIdRef` anti-race.
- **Prefix cache** : quand l'utilisateur tape progressivement ("guerlain" → "guerlain l'ho"), le résultat est re-scoré localement depuis le cache — zéro requête Firestore supplémentaire.
- **Barre de recherche fixe** : ne disparaît plus au scroll — toujours visible en haut du pager. Seul le DockBar continue de se cacher/montrer.
- **Parfums similaires** : nouvelle signature `getSimilarParfums(mainAccords: string[], ...)` utilisant `array-contains-any` sur les accords partagés + `orderBy popularityScore`. Scoring client-side (accords partagés × 10 + pop/100). UI migrée vers `ParfumCard` compact avec vraies images (plus de placeholder flask). Cache TTL 24h via `similarIdsCachedAt`.
- **Auth fix** : `KeyboardAvoidingView` sur Android pour login et register — le clavier ne recouvre plus les inputs/boutons.
- **Nouveaux index Firestore** : composites `searchKeywords` + `reviewCount` et `mainAccords` + `popularityScore` (fichier `firestore.indexes.json`, déployer avec `firebase deploy --only firestore:indexes`).
- **Nouvelles marques** : 46 marques importées → ~25 100 parfums (239 marques). `popularityScore` backporté sur tous les documents existants (`npm run import-data` avec mise à jour partielle au lieu de skip). Nouveau champ `brandLower` pour usage futur.
- **Modèles** : `similarIdsCachedAt?: Date` ajouté à l'interface `Parfum`.
- **Perf logs** : `console.log` temporaire avec temps Firestore / scoring / total sur chaque recherche.

## v6.3 — Wardrobe enrichie + OlfactoryPyramid rework (17/07/2026)

- **WardrobeAddSheet** : bottom sheet d'ajout avec sélection de taille (remplace l'ancien `Alert.alert` sur la fiche détail)
- **Parfum signature** : toggle dans la fiche personnelle, maximum 3 signatures, compteur `isSignature` sur le modèle WardrobeItem
- **Tailles décant/échantillon** : formats 2–30ml distincts des full-size (30–200ml), selon le type d'ownership
- **Ownership labels centralisés** : `src/utils/ownership.ts` — `OWNERSHIP_LABELS`, `ownershipLabel()`, `wardrobeToCardItem()`
- **Wardrobe service** : `addToWardrobe()` accepte `sizeMl` optionnel, `updateWardrobeItem()` supporte `isSignature`
- **AuthContext memoïsé** : `useMemo` sur la value du provider pour éviter les re-renders inutiles
- **OlfactoryPyramid** : retravaillé — support demi-étoiles, rendu optimisé
- **StarRating** : support demi-étoiles (notation au demi-point près)
- **react-native-svg** : ajouté aux dépendances (utilisé par OlfactoryPyramid et StarRating)
- **start.bat** : réécrit avec 2 modes — `start.bat` (Metro uniquement, fast) et `start.bat build` (Gradle + install + Metro), cleanup ADB + kill old Metro inclus

## v6.2 — Bugfixes & Search Bar (17/07/2026)

- **Barre de recherche persistante** : visible sur les 4 onglets, verre dépoli (BlurView), show/hide synchronisé avec le DockBar, navigation vers overlay recherche plein écran
- **Overlay recherche** (`search.tsx`) : autofocus, live filtering (Firestore cached), 6 filtres famille, recherches récentes persistantes
- **Catalogue simplifié** : search bar inline retirée, chips famille redirigent vers l'overlay recherche, avatar header ajouté
- **ProfileAvatar** : composant partagé (photo Google ou initiale), dédupliqué sur Favoris/Historique/Collection
- **ThemeContext** : fix crash si AsyncStorage échoue (écran blanc → fallback system)
- **DockBar** : ombres migrées vers `t.shadow` (invisibles en dark mode → bordures adaptatives)
- **EmptyState** : typage icônes corrigé (`as never` → `as const satisfies`)
- **Favoris/Collection** : guards `uid` ajoutés sur les menus contextuels (plus de `!` non-null)
- **History** : `formatScanDate` réécrit avec type guards corrects
- **Index** : `Gesture.Pan()` memoïsé (`useMemo`) — plus de recréation à chaque render
- **Navigation** : `router.navigate` → `router.replace` sur les CTA EmptyState (évite l'empilement)

## v6.0 — Navigation Rework + Dark Mode (17/07/2026)

- **Dock flottant 5 positions** : barre verre dépoli, indicateur doré animé, FAB scan central avec pulse ring
- **4 pages** : Pager horizontal (Catalogue, Favoris, Historique, Collection) remplaçant l'ancien Catalog↔Profil
- **ProfilePage supprimé** — son contenu dispatché dans 3 écrans dédiés avec avatar header → settings
- **Dark Mode** : 3 modes (système/clair/sombre), palette « Luxe profond », persistance AsyncStorage, accessible sans auth
- **Design System** : 6 nouveaux composants (Button, PriceDisplay, SectionHeader, EmptyState, OfflineBanner, AlertPriceToggle)
- **Atomic moves** : menu contextuel "Déplacer vers…" (moveToCollection, moveToWishlist, moveFavori) en batch Firestore
- **New hooks** : `useFavoris`, `useCollection`, `useWishlist`, `useScans` — Firestore temps réel
- **0 fontWeight** : migration complète de tout le code vers `fontFamily`
- **Firebase modular API** : migration namespaced → modular (v25+)
- **Onboarding** : 3 slides swipe au 1er lancement, AsyncStorage `@parfumscan_onboarding_done` (⏸️ désactivé temporairement)

## v6.9 — Favoris + Historique refonte & Pager migration (21/07/2026)

- **Favoris** : chips famille remplacées par bouton unique « Famille » → ActionSheet + chip dismissible, densité partagée avec le catalogue (`useDensityPreference`), cartes en mode dynamique (Confort./Compact/Liste)
- **Historique** : `ScanHistoryCard` refactorée en wrapper — scans réussis → `ParfumCard` (densité partagée) + overlay (dot statut + date + compteur ×N), no-result/error → layout compact natif
- **Pager** : `react-native-pager-view` remplacé par `GestureDetector` + Reanimated — résout les conflits de swipe natifs entre le pager et les ScrollView horizontaux du catalogue (`activeOffsetX(30)` + `failOffsetY(15)`)
- **BrandSheet** : bottom sheet alphabétique A-Z (60+ marques, barre de recherche, index latéral) — ouverte depuis « Toutes → » sur les capsules marques
- **« Voir tout → »** : scroll direct vers la grille catalogue (`scrollToIndex`) au lieu de push vers l'overlay de recherche
- **GRID_MODES** : centralisé dans `useDensityPreference`, supprimé des définitions locales
- **Bug fixes** : crash `parfum.notesTete` undefined sur données dénormalisées (favoris, historique)

## v6.8 — Refonte Catalogue v2 (21/07/2026)

- **Structure hybride** : rangées éditoriales horizontales (façon Spotify/Netflix) + grille filtrable en dessous
- **Suppression chips famille olfactive** : remplacés par dilution dans sections nommées + cartes d'ambiance « Explorer par famille » (6 cartes theme-aware avec Ionicons)
- **Capsules marques** : top 10 marques en pastilles rectangulaires + bottom sheet « Toutes les marques » (A-Z, barre de recherche, index latéral)
- **ParfumCard 4 modes** : `compact` (rangées, 140px), `comfortable` (grille défaut, tags famille/année + notes de tête + price dot deal/fair/overpriced), `compactPlus` (grille dense, image 90px), `list`
- **Densité persistée** : AsyncStorage (`@parfumscan/catalog-density`), partagée entre catalogue et recherche
- **Recherche** : chips famille supprimées, contrôles de densité identiques à la grille (Confort./Compact/Liste)
- **Nouveaux composants** : `BrandCapsules`, `CatalogRow` (collapse/expand avec chevron), `FamilyAmbianceCards` (6 cartes d'ambiance avec couleurs du thème)
- **Nouveau hook** : `useDensityPreference` (lecture/écriture AsyncStorage, partagé catalogue + recherche)

## v6.7 — Pipeline seed autonome + ImageViewer + Search améliorée (20/07/2026)

- **Pipeline seed autonome** : catalogue 21K parfums importé depuis scrape Apify → `data/clean/` → Firestore. Zéro dépendance à l'API Fragella. Images hébergées sur Firebase Storage.
- **ImageViewerPopup** : tap sur la photo du parfum (fiche détail) → popup plein écran avec animation fade+scale, tap n'importe où pour fermer.
- **Recherche en grille** : `numColumns={2}` + `ParfumCard compact`, affichage 2 colonnes pour les résultats de recherche.
- **Images en `contain`** : `contentFit="contain"` sur les cartes compactes et la fiche détail — plus de crop/zoom, le flacon est visible en entier.
- **Parfums similaires** : scoring par nombre d'accords partagés (`array-contains-any`) + `popularityScore`, shuffle journalier — parfums qui partagent les mêmes accords, pas juste la même famille.
- **Recherche par préfixes** : scoring `startsWith` + bonus `reviewCount`, limit 200, génération de préfixes dans `buildSearchKeywords()`.
- **Dark mode fixes** : `extraData={resolvedMode}` et `key={resolvedMode}` dans les FlatList/PagerView pour re-render correct au changement de thème.
- **New components** : `ImageViewerPopup` (popup image plein écran)
- **New scripts** : `migrate-search-keywords` (migration des keywords de recherche avec préfixes)

## v6.6 — Parfumerie, Favoris moodboard, Historique journal (18/07/2026)

- **Parfumerie (rebrand)** : « Garde-robe » devient « Parfumerie » — icône `flask`, labels, placeholders, empty states, fiches personnelles, privacy policy. Nom de fichier `collection.tsx` conservé pour rétrocompatibilité expo-router.
- **Favoris refonte** : moodboard olfactif en grille 2 colonnes (`ParfumCard` compact), filtres famille olfactive avec compteurs, barre de recherche + toggle tri (date/A-Z/Z-A/prix), animation stagge fade-in, menu contextuel enrichi via `ActionSheet` (long-press → 5 options), pull-to-refresh. Dénormalisation `bestPrice`/`referencePrice`/`annee` dans `UserFavori` pour le badge promo.
- **Historique refonte** : journal olfactif groupé par période (Aujourd'hui/Hier/Cette semaine/Ce mois/mois année). Carte `ScanHistoryCard` avec dot statut (vert/gris/rouge), compteur répétitions `×N`, prix si capturé. Barre recherche + tri (récents/anciens), prompt "Scanner aujourd'hui ?", animation stagger, `ActionSheet` menu contextuel. Scans sauvegardés dans tous les états (`no-result`, `error`) via `saveScan()`.
- **ActionSheet** : nouveau composant bottom sheet custom (spring + backdrop `withTiming`), remplace les `Alert.alert` sur favoris et historique. Supporte actions iconées, titre optionnel, variante destructive. Utilisé par Favoris et Historique.
- **Dénormalisation étendue** : `UserFavori` (+ `bestPrice`, `referencePrice`, `annee`) et `UserScan` (+ `annee`, `bestPrice`, `status`) pour affichage direct sans appels Firestore supplémentaires.
- **Back gesture edge-pan** : gesture de retour restreint à une strip de 40px à gauche sur la fiche détail catalogue (évite les conflits avec le swipe horizontal de la pyramide).
- **SOTDPicker ancré** : positionné en `absolute` au-dessus de la carte SOTD (ancré par `anchorTop` prop), suppression de Reanimated. Hauteur max dynamique basée sur `windowHeight`.

## v6.5 — PagerView natif + Pyramide v5 + Dark mode system (18/07/2026)

- **Pager natif** : `react-native-pager-view` remplace le swipe gesture Reanimated — résout les conflits de scroll horizontal (ScrollView, pyramide touch). Swipe inter-pages natif, `scrollEnabled={!sheetOpen}` pour éviter les conflits avec les bottom sheets.
- **OlfactoryPyramid v5** : SVG unifié (triangle complet), touch-based (tap sur le triangle pour sélectionner une couche), design premium avec dégradé d'opacité. Nouvelle props `onNotePress` → ouvre `NoteDetailPopup`. Suppression des animations par couche (entry/scale/pulse).
- **NoteDetailPopup** : nouveau composant affichant le détail d'une note olfactive (nom, description, couche). Utilise `src/utils/note-descriptions.ts` pour les descriptions.
- **SOTDCard compact** : redesign complet — miniature 26×26, icône soleil inline, label "SOTD" pill, boutons icônes (swap/add) remplaçant les boutons texte "Changer"/"Choisir". Intégration plus discrète au-dessus de la grille.
- **Dark mode system UI** : `expo-system-ui` pour le fond d'écran, `expo-navigation-bar` pour la barre Android (suit le thème). Tous les `TextInput` reçoivent `keyboardAppearance` basé sur `resolvedMode`.
- **Settings "Soutenir"** : section don (cœur + description + bouton désactivé "Bientôt disponible"). Routes `/legal` et `/privacy` fonctionnelles (nouveaux écrans `legal.tsx`, `privacy.tsx`).
- **Catalogue autonome** : catalogue 100% Firestore, zéro dépendance API externe. `src/utils/normalize.ts` pour les clés Firestore cohérentes. Tous les champs enrichis (`popularityScore`, `ratingScore`, `country`, `mainAccordsPercentage`, `generalNotes`, `confidence`, `seasonRanking`, `occasionRanking`) importés via le pipeline seed.
- **Bug fixes** : NaN dans les tris rating, couleurs de fond derrière les images ParfumCard, positions badge note/signature inversées sur WardrobeCard, `contentStyle.backgroundColor` sur tous les écrans Stack, `key={resolvedMode}` sur WardrobeGrid pour re-render au changement de thème.
- **Deps** : `react-native-pager-view ^8.0.2`, `expo-navigation-bar ~57`, `expo-system-ui ~57`

## v6.4 — Refonte fiche détail prix-first (17/07/2026)

- **Prix en overlay** : `DetailHero` — badge flottant en bas à gauche de l'image hero (prix, réduction, prix ref barré, CTA)
- **Header collapsé** : `CollapsingHeader` — marque fade-out + nom shrink au scroll via `useAnimatedReaction` + `LayoutAnimation`
- **Barre sticky bas** : `StickyBottomBar` — slide-in prix + favori + garde-robe + CTA dès que la section prix est hors écran
- **Ordre prix-first** : prix → pyramide → accords → stats (longévité/sillage/popularité) → saisons → occasions → similaires
- **Doublon fav supprimé** : le cœur disparaît du header et de l'actionRow, uniquement dans la sticky bar
- **Badges 2 lignes** : identification (type, famille, année) + contexte (saisons top 2, occasions top 2, note) avec icônes Ionicons
- **Suppression comparateur prix magasin** et état `storePrice`/`showStoreInput`
- **3 nouveaux composants** extraits : `DetailHero` (156 lignes), `CollapsingHeader` (140 lignes), `StickyBottomBar` (189 lignes)

## v5.7 — Burst + Galerie + Personnalisation (16/07/2026)

- **Burst adaptatif** : 3 photos en rafale, 70% des scans résolus en 1 appel GPT-4o (~2s), 30% en 2 appels cross-ref (~4s)
- **Import galerie** : `expo-image-picker` → même pipeline IA, sans permissions supplémentaires
- **Catalogue personnalisé** : scoring client-side (famille×3 + marque×2 + popularité/20), exclut déjà vus, section "Pour vous"
- **Profil** : favoris/historique toujours montés (display:none au lieu de conditionnel), switch instantané sans rechargement d'images
- **UI** : animateShutter désactivé sur CameraView (plus de flash à la capture), galerie en bouton outline sous le CTA
- **Cloud Function** : `analyzePerfumeImage` supporte `imagesBase64[]` pour le cross-referencing multi-photo

## v5.5 — Bugfixes (16/07/2026)

- **C4** `app/catalog/[id].tsx` — `consumePendingParfum()` sorti du render (`useRef(fn())` → `useState(() => fn())`)
- **C5** `src/services/firestore.ts` — `onParfums` utilise `orderBy('updatedAt')` au lieu de `createdAt` (docs batch-cachés n'avaient pas de `createdAt`)
- **H1** `app.json` — NDK corrigé (`30.x` inexistant → `27.0.12077973` LTS)
- **H2** `app.json` — plugin `expo-build-properties` en doublon supprimé
- **H8** `src/features/profile/ProfilePage.tsx` — FavHeart migré de `Animated` natif vers Reanimated

---

## 📄 Licence

MIT — voir [LICENSE](./LICENSE)
