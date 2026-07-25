# ParfumScan React — Référence technique

## §1 — Service Layer

### `src/services/supabase.ts`
```ts
// Client Supabase + adaptateur realtime (remplace firebase.ts + onSnapshot)
export const supabase: SupabaseClient;
export function isSupabaseReady(): boolean;
export function subscribeUserTable<T>(opts: SubscribeUserTableOptions<T>): () => void;
// fetch initial (SELECT) + canal postgres_changes (INSERT/UPDATE/DELETE) → cb(items) triés
// Même contrat qu'onSnapshot. setAuth realtime synchro via onAuthStateChange.
```

### `src/services/firestore.ts`
```ts
// Catalogue — impl Supabase (RPC search_parfums / PostgREST). Signatures inchangées.
export function onParfums(cb: (p: Parfum[]) => void): () => void;
export function getParfumById(id: string): Promise<Parfum | undefined>;
export function updateParfum(id: string, data: Partial<Parfum>): Promise<void>;
export function getPopularParfums(limit: number): Promise<Parfum[]>;
export function getPersonalizedSuggestions(uid: string, limit: number): Promise<Parfum[]>;
export function searchParfumsCached(query: string): Promise<Parfum[]>;
```
→ Voir **§7 — Algorithme de recherche** pour la spécification complète.

```ts
export function searchParfumFromScan(marque: string | null, nom: string | null): Promise<Parfum[]>;
// Wrapper scan-spécifique : appelle searchParfumsCached puis rescore avec bonus nom/marque
// Bonus : +50 (nom exact), +25 (nom partiel), +15 (marque exacte), +8 (marque partielle)
// Les résultats de searchParfumsCached et searchParfumFromScan sont dédoublonnés par marque+nom normalisé.
```

```ts
export function getSimilarParfums(mainAccords: string[], excludeId: string, limit?: number): Promise<Parfum[]>;
// Scoring par nombre d'accords partagés (array-contains-any) + orderBy popularityScore, shuffle journalier (Lehmer RNG), ParfumCard compact dans UI, cache TTL 24h via similarIdsCachedAt
```

```ts
export function getParfumsByPerfumer(name: string): Promise<Parfum[]>;
// where('perfumers','array-contains',name) + orderBy popularityScore DESC, limit 50
// Index composite requis : perfumers CONTAINS + popularityScore DESC (firestore.indexes.json)
```

### `src/utils/normalize.ts`
```ts
// Utilitaires de normalisation des chaînes
export const STOP_WORDS: Set<string>;   // 38 mots vides FR/EN
export function normalize(s: string): string;
export function normalizeId(s: string): string;
export function generateTrigrams(word: string): string[];  // trigrammes $-padded
export function buildSearchKeywords(marque: string, nom: string, familleOlactive?: string): string[];
```

### `src/services/user-data.ts`
```ts
// Supabase — données utilisateur (favoris, collection, scans, settings)
// PK = (user_id, parfum_id) déterministe → upsert ON CONFLICT
export function onFavoris(uid: string, cb: (f: UserFavori[]) => void): () => void;
export function addFavori(uid: string, parfum: Parfum): Promise<string>;
// Prend un objet Parfum complet — dénormalise tous les champs d'affichage ET de filtrage
// (longevity, sillage, seasonScores, notes) dans le document favori
export function removeFavori(uid: string, parfumId: string): Promise<void>;
export function isParfumFavori(uid: string, parfumId: string): Promise<{ isFavori: boolean; favoriId: string | null }>;
export function onCollection(uid: string, cb: (items: UserCollectionItem[]) => void): () => void;
export function addToCollection(uid: string, parfumId: string, nom?: string, marque?: string, imageUrl?: string): Promise<string>;
export function removeFromCollection(uid: string, parfumId: string): Promise<void>;
export function onWishlist(uid: string, cb: (items: UserWishlistItem[]) => void): () => void;
export function addToWishlist(uid: string, parfumId: string, nom?: string, marque?: string, imageUrl?: string, familleOlactive?: string): Promise<string>;
export function removeFromWishlist(uid: string, parfumId: string): Promise<void>;
export function onScans(uid: string, cb: (s: UserScan[]) => void): () => void;
export function saveScan(uid: string, data: Omit<UserScan, 'id' | 'scannedAt'> & { status?: 'success' | 'no-result' | 'error'; bestPrice?: number; annee?: number }): Promise<void>;
export function removeScan(uid: string, scanId: string): Promise<void>;
export function getUserSettings(uid: string): Promise<{ priceAlerts: boolean; pushNotifs: boolean; weatherNotifs: boolean; weatherLat: number | null; weatherLon: number | null }>;
export function updateUserSetting(uid: string, key: 'priceAlerts' | 'pushNotifs' | 'weatherNotifs', value: boolean): Promise<void>;
export function saveWeatherCoords(uid: string, lat: number, lon: number): Promise<void>;
export function isPriceAlertActive(uid: string, parfumId: string): Promise<boolean>;
export function setPriceAlert(uid: string, parfumId: string, active: boolean, currentPrice?: number): Promise<void>;
export function moveToCollection(uid: string, from: string, itemId: string, parfumId: string, nom: string | null, marque: string | null, imageUrl: string | null): Promise<void>;
export function moveToWishlist(uid: string, from: string, itemId: string, parfumId: string, nom: string | null, marque: string | null, imageUrl: string | null, familleOlactive?: string | null): Promise<void>;
export function moveFavori(uid: string, from: string, itemId: string, parfumId: string, nom: string | null, marque: string | null, imageUrl: string | null, familleOlactive?: string | null): Promise<void>;
// Best-effort : fetch le parfum pour inclure les champs de filtrage (longevity, sillage...)
```

### `src/services/wardrobe.ts`
```ts
// Wardrobe — collection unifiée (ownership states + metadata)
export function onWardrobe(uid: string, cb: (items: WardrobeItem[]) => void): () => void;
export async function addToWardrobe(uid: string, parfumId: string, ownership: 'have' | 'want' | 'had' | 'sample' | 'decant', nom?: string, marque?: string, imageUrl?: string, familleOlactive?: string, sizeMl?: number | null, parfum?: Parfum): Promise<void>;
// parfum optionnel — si fourni, évite un fetch Supabase pour peupler les champs de filtrage
export async function updateWardrobeItem(uid: string, parfumId: string, data: Partial<Pick<WardrobeItem, 'ownership' | 'rating' | 'notes' | 'shelfIds' | 'sizeMl' | 'isSignature'>>): Promise<void>;
export async function removeFromWardrobe(uid: string, parfumId: string): Promise<void>;
export async function isInWardrobe(uid: string, parfumId: string): Promise<WardrobeItem | null>;

// Shelves — étagères custom
export function onShelves(uid: string, cb: (shelves: Shelf[]) => void): () => void;
export async function createShelf(uid: string, name: string, icon?: string, color?: string): Promise<string>;
export async function updateShelf(uid: string, shelfId: string, data: Partial<Pick<Shelf, 'name' | 'icon' | 'color' | 'order'>>): Promise<void>;
export async function deleteShelf(uid: string, shelfId: string): Promise<void>;

// SOTD — Parfum du jour (stocké par date YYYY-MM-DD)
export async function getTodaySotd(uid: string): Promise<SotdEntry | null>;
export async function setSotd(uid: string, parfumId: string, nom: string, marque: string, imageUrl?: string | null): Promise<void>;
```

### `src/services/theme-storage.ts`
```ts
// Persistance de la préférence de thème dans AsyncStorage
export type ThemeMode = 'system' | 'light' | 'dark';
export function getThemeMode(): Promise<ThemeMode>;
export function setThemeMode(mode: ThemeMode): Promise<void>;
```

### `src/services/openai-vision.ts`
```ts
// Analyse d'image via GPT-4o Vision (Edge Function `analyze-perfume-image`)
export function analyzeImage(base64: string): Promise<ScanResult>;
export function analyzeMultipleImages(imagesBase64: string[]): Promise<ScanResult>;
```

### `src/services/storage.ts`
```ts
// Supabase Storage (bucket public `parfum-images`) — upload d'images parfum
export function uploadParfumImage(parfumId: string, localUri: string, filename?: string): Promise<string>;
```

### `src/services/push.ts`
```ts
// Expo Push Notifications — notifications push (remplace fcm.ts ; tokens en table push_tokens)
export function requestFcmPermission(): Promise<boolean>;
export function deleteFcmToken(): Promise<void>;
export function createNotificationChannels(): Promise<void>;
export function startFcmRegistration(uid: string): () => void;
```

### `src/services/voice-search.ts`
```ts
// Edge Function `transcribe-voice` (OpenAI Whisper-1) — fallback vocal
export function transcribeVoice(audioBase64: string, mimeType: string): Promise<string>;
```

### `src/services/scentlist.ts`
```ts
// Carnet d'essais (parfums à sentir / sentis) — table scentlist
export function onScentList(uid: string, cb: (items: UserScentItem[]) => void): () => void;
export function addToScentList(uid: string, parfum: Parfum): Promise<void>;
export function updateScentItem(uid: string, parfumId: string,
  data: Partial<Pick<UserScentItem, 'verdict' | 'rating' | 'notes' | 'status' | 'triedAt'>>): Promise<void>;
export function markScentTried(uid: string, parfumId: string,
  data: { verdict: ScentVerdict | null; rating: number | null; notes: string | null }): Promise<void>;
export function removeFromScentList(uid: string, parfumId: string): Promise<void>;
export function isInScentList(uid: string, parfumId: string): Promise<UserScentItem | null>;
export function moveScentToWardrobe(uid: string, item: UserScentItem,
  ownership: WardrobeItem['ownership'], sizeMl?: number | null): Promise<void>;
```

### `src/services/account.ts`
```ts
// Compte — Supabase : deleteAccount = Edge Function `delete-user-account` (CASCADE),
// exportAccountData = RPC `export_user_data`, le reste en PostgREST.
export function deleteAccount(): Promise<void>;
export function reauthenticate(password?: string): Promise<void>;
export function exportAccountData(): Promise<string>;
export function shareAccountData(): Promise<void>;
export function getAccountDataSummary(uid: string): Promise<AccountDataSummary>;
export function deleteAllScans(uid: string): Promise<number>;
export function deleteAllFcmTokens(uid: string): Promise<void>;   // purge push_tokens
export function deleteAllPriceAlerts(uid: string): Promise<number>;
export function clearWeatherCoords(uid: string): Promise<void>;
```

### `src/services/weather.ts`
```ts
// Open-Meteo API (gratuit, sans clé) + cache 30 min — GPS uniquement (pas de fallback ville, v6.18)
export interface WeatherData { temperature: number; weatherCode: number; isDay: boolean; dailyMax: number; dailyMin: number; dailyWeatherCode: number; fetchedAt: number; }
export function fetchWeather(lat: number, lon: number): Promise<WeatherData | null>;
```

### `src/services/haptics.ts`
```ts
// Retours haptiques
export function hapticsLight(): void;
export function hapticsSuccess(): void;
export function hapticsError(): void;
```

### `src/services/catalog-bridge.ts`
```ts
// Pont mémoire inter-écrans (scan → détail)
export function setPendingParfum(p: Parfum): void;
export function consumePendingParfum(): Parfum | null;
export function setPendingCatalogQuery(q: string): void;
export function consumePendingCatalogQuery(): string | null;
```

---

## §2 — Hooks

### `useTheme()` — `src/theme/ThemeContext.tsx`
```ts
interface ThemeContextValue {
  theme: Theme;           // Objet thème actif (lightTheme ou darkTheme)
  mode: ThemeMode;        // 'system' | 'light' | 'dark'
  resolvedMode: 'light' | 'dark';  // Mode effectif
  setMode: (m: ThemeMode) => void;
}
export function useTheme(): ThemeContextValue;
```

### `useAuthContext()` — `src/contexts/AuthContext.tsx`
```ts
interface AuthContextValue {
  user: AppUser | null;   // { uid, email, displayName, photoURL, providers } — commun Firebase/Supabase
  authReady: boolean;
  isAdmin: boolean;
  isAuthenticated: boolean;
  register(email: string, password: string): Promise<{ user: AppUser }>;
  login(email: string, password: string): Promise<{ user: AppUser }>;
  loginWithGoogle(): Promise<{ user: AppUser }>;
  logout(): Promise<void>;
}
```

### `useFavoris(uid)` — `src/hooks/useFavoris.ts`
```ts
// Hook Firestore temps réel pour les favoris
export function useFavoris(uid: string | null): {
  items: FilterableItem[];
  loading: boolean;
  removeFavori: (id: string) => Promise<void>;
};
```

### `useCollection(uid)` — `src/hooks/useCollection.ts`
```ts
// Hook Firestore temps réel pour la collection
export function useCollection(uid: string | null): {
  items: UserCollectionItem[];
  loading: boolean;
  remove: (id: string) => Promise<void>;
};
```

### `useWishlist(uid)` — `src/hooks/useWishlist.ts`
```ts
// Hook Firestore temps réel pour la wishlist
export function useWishlist(uid: string | null): {
  items: UserWishlistItem[];
  loading: boolean;
  remove: (id: string) => Promise<void>;
};
```

### `useScans(uid)` — `src/hooks/useScans.ts`
```ts
// Hook Firestore temps réel pour l'historique des scans
export function useScans(uid: string | null): {
  scans: UserScan[];
  loading: boolean;
  removeScan: (id: string) => Promise<void>;
};
```

### `useWardrobe(uid)` — `src/hooks/useWardrobe.ts`
```ts
// Hook Firestore temps réel pour la garde-robe
export function useWardrobe(uid: string | null): {
  items: WardrobeItem[];
  loading: boolean;
  add: (parfumId: string, ownership: WardrobeItem['ownership'], nom?: string, marque?: string, imageUrl?: string, familleOlactive?: string) => Promise<void>;
  update: (parfumId: string, data: Partial<Pick<WardrobeItem, 'ownership' | 'rating' | 'notes' | 'shelfIds' | 'sizeMl'>>) => Promise<void>;
  remove: (parfumId: string) => Promise<void>;
  checkInWardrobe: (parfumId: string) => Promise<WardrobeItem | null>;
};
```

### `useShelves(uid)` — `src/hooks/useShelves.ts`
```ts
// Hook CRUD étagères (Firestore temps réel)
export function useShelves(uid: string | null): {
  shelves: Shelf[];
  create: (name: string, icon?: string, color?: string) => Promise<void>;
  update: (shelfId: string, data: Partial<Pick<Shelf, 'name' | 'icon' | 'color' | 'order'>>) => Promise<void>;
  remove: (shelfId: string) => Promise<void>;
};
```

### `useSotd(uid)` — `src/hooks/useSotd.ts`
```ts
// Hook Parfum du jour (lecture/écriture + état local optimiste)
export function useSotd(uid: string | null): {
  sotd: SotdEntry | null;
  setTodaySotd: (item: WardrobeItem) => Promise<void>;
  refresh: () => Promise<void>;
};
```

### `useScentList(uid)` — `src/hooks/useScentList.ts`
```ts
// Carnet d'essais temps réel
export function useScentList(uid: string | null): {
  items: UserScentItem[];
  toTry: UserScentItem[];
  tried: UserScentItem[];
  loading: boolean;
  add: (parfum: Parfum) => Promise<void>;
  update: (parfumId: string, data: Partial<Pick<UserScentItem, 'verdict' | 'rating' | 'notes' | 'status' | 'triedAt'>>) => Promise<void>;
  markTried: (parfumId: string, data: { verdict: ScentVerdict | null; rating: number | null; notes: string | null }) => Promise<void>;
  remove: (parfumId: string) => Promise<void>;
  moveToWardrobe: (item: UserScentItem, ownership: WardrobeItem['ownership'], sizeMl?: number | null) => Promise<void>;
};
```

### `useDensityPreference()` — `src/hooks/useDensityPreference.ts`
```ts
// Persistance AsyncStorage du mode d'affichage grille — partage catalogue + recherche
export function useDensityPreference(): {
  density: CardMode;     // 'comfortable' | 'compactPlus' | 'list'
  setDensity: (mode: CardMode) => void;
};
```

### `useVoiceSearch()` — `src/hooks/useVoiceSearch.ts`
```ts
// Reconnaissance vocale on-device (expo-speech-recognition) + enregistrement audio (expo-audio)
// Architecture dual-mode : STT local + fallback Whisper (Cloud Function)
export function useVoiceSearch(): {
  state: 'idle' | 'listening' | 'processing' | 'error';
  transcript: string;
  start(config?: { continuous?: boolean }): Promise<void>;
  stop(): Promise<void>;
  cancel(): void;
  getAudioForFallback(): Promise<{ audioBase64: string; mimeType: string } | null>;
};
```

### `useWeather(enabled?: boolean)` — `src/hooks/useWeather.ts`
```ts
// Météo actuelle via expo-location (GPS uniquement, pas de fallback ville — v6.18) → Open-Meteo
export function useWeather(enabled?: boolean): {
  weather: WeatherData | null;
  loading: boolean;
  error: string | null;
  coords: { lat: number; lon: number } | null;
  refresh: () => void;
};
```

---

## §3 — Theme Reference

### `src/theme/theme.ts`

```ts
// Double palette light/dark
export const lightTheme: Theme;
export const darkTheme: Theme;
export type Theme = typeof lightTheme;

// Alias de rétrocompatibilité (à ne plus utiliser)
export const theme = lightTheme;

interface Theme {
  colors: { /* 28 tokens couleur */ };
  fonts: { /* display, body, sizes */ };
  radius: { /* sm, base, card, full */ };
  spacing: { /* xs → 3xl */ };
  shadow: { /* card, elevated, button, scanCircle */ };
}
```

### Pattern de consommation obligatoire

```tsx
import { useTheme, type Theme } from '../theme/ThemeContext';

function getStyles(t: Theme) {
  return {
    container: { backgroundColor: t.colors.background },
    title: { color: t.colors.text, fontFamily: t.fonts.display.fontFamily },
  } as const;
}

export default function MonComposant() {
  const { theme } = useTheme();
  const s = useMemo(() => getStyles(theme), [theme]);
  // ...
}
```

---

## §4 — Modèles

### `src/models/parfum.interface.ts`
```ts
interface Parfum {
  id: string;
  marque: string;
  nom: string;
  annee?: number;
  familleOlactive: string;
  notesTete: string[];
  notesCoeur: string[];
  notesFond: string[];
  imageUrl?: string;
  perfumers?: string[];      // nez — signature dorée sous le badgeRow de la fiche détail
  // ...
}
```

### `src/models/user-collection.interface.ts`
```ts
interface UserCollectionItem {
  id: string;
  parfumId: string;
  marque?: string;
  nom?: string;
  imageUrl?: string;
  addedAt: Date;
}
```

### `src/models/user-wishlist.interface.ts`
```ts
interface UserWishlistItem {
  id: string;
  parfumId: string;
  marque?: string;
  nom?: string;
  imageUrl?: string;
  familleOlactive?: string;
  addedAt: Date;
}
```

### `src/models/user-favori.interface.ts`
```ts
interface UserFavori {
  id: string;
  parfumId: string;
  nom?: string;
  marque?: string;
  imageUrl?: string;
  familleOlactive?: string;
  bestPrice?: number;       // dénormalisé — badge promo
  referencePrice?: number;   // dénormalisé — calcul remise
  annee?: number;            // dénormalisé — chip année
  longevity?: string | null;          // dénormalisé — filtre Tenue
  sillage?: string | null;            // dénormalisé — filtre Sillage
  seasonScores?: { spring?: number; summer?: number; fall?: number; winter?: number } | null; // dénormalisé, nettoyé — filtre Saison
  notes?: string[] | null;            // dénormalisé (tête+cœur+fond dédupliqués) — recherche par note
  addedAt: Date;
}
```

### `src/models/user-scan.interface.ts`
```ts
interface UserScan {
  id: string;
  marque?: string;
  nom?: string;
  typeParfum?: string;
  volumeMl?: number;
  rawText?: string;
  parfumId?: string;
  imageUrl?: string;
  familleOlactive?: string;
  annee?: number;            // dénormalisé
  bestPrice?: number;        // dénormalisé
  status?: 'success' | 'no-result' | 'error';
  scannedAt: Date;
}
```

### `src/models/wardrobe.interface.ts`
```ts
interface WardrobeItem {
  parfumId: string;
  nom: string | null;
  marque: string | null;
  imageUrl: string | null;
  familleOlactive: string | null;
  ownership: 'have' | 'want' | 'had' | 'sample' | 'decant';
  rating: number | null;
  notes: string | null;
  shelfIds: string[];
  sizeMl: number | null;
  sotdCount: number;
  isSignature: boolean;
  longevity?: string | null;          // dénormalisé — filtre Tenue
  sillage?: string | null;            // dénormalisé — filtre Sillage
  seasonScores?: { spring?: number; summer?: number; fall?: number; winter?: number } | null; // dénormalisé — filtre Saison
  allNotes?: string[] | null;         // dénormalisé (tête+cœur+fond dédupliqués) — recherche par note
  addedAt: Date;
  updatedAt: Date;
}

interface Shelf {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  order: number;
  createdAt: Date;
}

interface SotdEntry {
  parfumId: string;
  nom: string;
  marque: string;
  imageUrl: string | null;
}
```

### `src/models/user-scent.interface.ts`
```ts
type ScentVerdict = 'love' | 'like' | 'meh' | 'dislike';

interface UserScentItem {
  id: string;
  parfumId: string;
  nom: string | null;
  marque: string | null;
  imageUrl: string | null;
  familleOlactive: string | null;
  status: 'to_try' | 'tried';
  verdict: ScentVerdict | null;
  rating: number | null;
  notes: string | null;
  triedAt: Date | null;
  bestPrice?: number;
  referencePrice?: number;
  addedAt: Date;
  updatedAt: Date;
}
```

---

## §5 — Utilitaires

### `src/utils/ownership.ts`
```ts
// Labels centralisés pour les états de garde-robe
export const OWNERSHIP_LABELS: Record<WardrobeItem['ownership'], string>;
export function ownershipLabel(o: WardrobeItem['ownership']): string;
export function wardrobeToCardItem(item: WardrobeItem): { id, nom, marque, imageUrl, familleOlactive, source };
```

### `src/utils/translate-note.ts`
```ts
export function translateNote(note: string): string;
// Traduit les noms de notes olfactives EN → FR
```

### `src/utils/error-translator.ts`
```ts
export function translateSupabaseError(e: unknown): string;
// Traduit les erreurs Supabase (codes gotrue + PostgREST/SQLSTATE) en messages FR
```

### `src/utils/note-descriptions.ts`
```ts
// Descriptions détaillées des notes olfactives (FR)
export const NOTE_DESCRIPTIONS: Record<string, string>;
export function getNoteDescription(note: string): string | null;
```

### `src/utils/season.ts`
```ts
// Constantes et helpers saisonniers (importable par l'app et les scripts tsx)
export type SeasonKey = 'spring' | 'summer' | 'fall' | 'winter';
export const SEASON_ORDER: SeasonKey[];
export const SEASON_META: Record<SeasonKey, { label: string; icon: string; token, tokenSoft }>;
export function normalizeSeasonKey(name: string): SeasonKey | null;
export const SEASON_MATCH_THRESHOLD = 50;
export function seasonScoresFromRanking(ranking): Partial<Record<SeasonKey, number>> | null;
```

### `src/utils/favori-filters.ts`
```ts
// Types, prédicats et helpers purs pour les filtres favoris
export type LongevityBucket = 'weak' | 'moderate' | 'long' | 'eternal';
export type SillageFilterId = 'intimate' | 'moderate' | 'powerful';
export function longevityBucket(v): LongevityBucket | null;
export function sillageBucket(v): SillageBucket | null;
export const LONGEVITY_OPTIONS: { bucket, label }[];
export const SILLAGE_OPTIONS: { id, label, buckets }[];
export interface FavoritesFilters { families, seasons, longevity, sillage };
export const EMPTY_FAVORI_FILTERS: FavoritesFilters;
export function countActiveFilters(f): number;
export function matchesFavoriFilters(fav, f): boolean;
export function favoriMatchesSearch(fav, q): boolean;
export function buildFavoriFilterFields(p): { longevity, sillage, seasonScores, notes };
```

---

## §6 — Composants

### `Button` — `src/components/Button.tsx`

Bouton 4 variantes. Toujours en `Inter_600SemiBold`.

```ts
interface Props {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  icon?: string;
  loading?: boolean;
  disabled?: boolean;
  onPress: () => void;
  children: React.ReactNode;
}
```

### `PriceDisplay` — `src/components/PriceDisplay.tsx`

Affichage prix avec code couleur (deal/fair/overpriced).

```ts
interface Props {
  bestPrice: number;
  referencePrice?: number;
  priceValue?: 'deal' | 'fair' | 'overpriced';
  large?: boolean;
}
```

### `EmptyState` — `src/components/EmptyState.tsx`

État vide 5 variantes : `collection | favoris | historique | wardrobe | scentlist`.

```ts
interface Props {
  variant: 'collection' | 'favoris' | 'historique' | 'wardrobe' | 'scentlist';
  onAction?: () => void;
}
```

### `ImageViewerPopup` — `src/components/ImageViewerPopup.tsx`

Popup lightbox plein écran pour afficher la photo du parfum en grand. Fond sombre invariant (light + dark), image maximisée en `contain`, bouton close ancré safe-area top-right, tap backdrop pour fermer.

```ts
interface Props {
  visible: boolean;
  imageUrl: string;
  brand?: string;
  onClose: () => void;
}
```

### `NoteDetailPopup` — `src/components/NoteDetailPopup.tsx`

Popup affichant le détail d'une note olfactive (nom français, description, couche olfactive).

```ts
interface Props {
  visible: boolean;
  noteEn: string;
  layer: 'Tête' | 'Cœur' | 'Fond';
  color: string;
  onClose: () => void;
}
```

### `ActionSheet` — `src/components/ActionSheet.tsx`

Bottom sheet custom pour les menus contextuels (long-press sur favoris/scans). Animation spring + backdrop avec `withTiming`.

```ts
interface ActionItem {
  icon: string;
  label: string;
  onPress: () => void;
  destructive?: boolean;
}

interface Props {
  visible: boolean;
  title?: string;
  actions: ActionItem[];
  onClose: () => void;
}
```

### `ParfumCard` — `src/components/ParfumCard.tsx`

Carte parfum 4 modes — point d'entree unique pour l'affichage catalogue, recherche, favoris, historique, wardrove.

```ts
export type CardMode = 'compact' | 'comfortable' | 'compactPlus' | 'list';

interface Props {
  parfum: Parfum;
  mode?: CardMode;         // defaut: 'comfortable'
  onPressOverride?: () => void;
}
```

| Mode | Usage | Taille image | Contenu |
|---|---|---|---|
| `compact` | Rangees horizontales | 140×186 | Marque + nom (2 lignes) + prix + badge promo (>10%) |
| `comfortable` | Grille 2 col (defaut) | ratio 3:4 | Marque + nom + tags (famille, annee) + notes de tete (3) + price dot (deal/fair/overpriced) + prix + badge promo |
| `compactPlus` | Grille 2 col dense | 90px | Marque (abregee) + nom (1 ligne) + price dot + prix |
| `list` | Liste verticale | 56×74 | Marque + nom + tags + price dot + prix + prix barre + chevron |

### `CatalogPage` — `src/features/catalog/CatalogPage.tsx`

Page catalogue principale — structure hybride rangees editoriales + grille filtrable.

```ts
interface Props {
  onScroll?: (y: number) => void;  // drive le show/hide du DockBar parent
}
```

**Structure** : capsules marques → « Pour vous » (rangee) → « Meilleures affaires » (rangee) → « Explorer par famille » (ambiance cards) → « Icones intemporelles » (rangee, repliee) → grille « Tous les parfums » avec controles densite + filtre.

### `FilterSheet` — `src/components/FilterSheet.tsx`

Bottom sheet multi-facettes (Famille, Saison, Tenue, Sillage) partagé entre Favoris et Parfumerie.
Chips multi-sélection avec compteurs, application live, saisons colorées via tokens dédiés.

```ts
interface Props {
  visible: boolean;
  items: FilterableItem[];
  filters: FavoritesFilters;
  resultCount: number;
  onFiltersChange: (next: FavoritesFilters) => void;
  onReset: () => void;
  onClose: () => void;
}
```

### `BrandCapsules` — `src/features/catalog/BrandCapsules.tsx`

Pastilles marques rectangulaires (42px hauteur, nom complet) en scroll horizontal.

```ts
interface Props {
  onViewAll: () => void;
  onBrandTap: (brand: string) => void;
}
```

### `CatalogRow` — `src/features/catalog/CatalogRow.tsx`

Rangee editoriale horizontale avec titre Playfair Display, sous-titre optionnel, chevron collapse/expand, et action « Voir tout → ».

```ts
interface Props {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  children: React.ReactNode;  // cartes ParfumCard en mode compact
}
```

### `FamilyAmbianceCards` — `src/features/catalog/FamilyAmbianceCards.tsx`

6 cartes d'ambiance (140×80) pour explorer les familles olfactives. Chaque carte utilise un fond `theme.colors[*Soft]` + icone Ionicons + couleur d'accent — entierement theme-aware (light + dark).

```ts
interface Props {
  onFamilyTap: (query: string) => void;
}
```

### `BrandSheet` — `src/features/catalog/BrandSheet.tsx`

Bottom sheet alphabétique A-Z (« Toutes les marques »). Modal avec FlatList groupée par lettre, barre de recherche, index latéral rapide.

```ts
interface Props {
  visible: boolean;
  onClose: () => void;
  onSelectBrand: (brand: string) => void;
}
```

### `NavigationChromeContext` — `src/features/navigation/NavigationChromeContext.tsx`

Contexte React partagé par les onglets du navigateur `TopTabs`. Fournit `reportScroll(y)` (écrit dans `scrollY` SharedValue), `resetDock()` (réaffiche le dock après un changement d'onglet — swipe ou tap), et `dockTranslateY` (SharedValue animée : 0 = visible, 120 = caché). La logique de hide-on-scroll est centralisée ici (`useAnimatedReaction` sur `scrollY` → `withTiming` sur `dockTranslateY`). Chaque écran d'onglet appelle `reportScroll` depuis son `onScroll`. Un seul écran visible à la fois → zéro conflit d'écriture.

### `DockBar` — `src/features/navigation/DockBar.tsx` — custom tabBar TopTabs

Barre flottante 4 onglets + FAB Scan central, verre dépoli (BlurView). Fonctionne comme `tabBar` custom du navigateur `TopTabs` (`expo-router/js-top-tabs`). Reçoit `{ state, navigation, position }` (MaterialTopTabBarProps vendorisés). L'indicateur doré est piloté en continu via `position` (RN Animated.Value ponté vers `indicatorLeft` SharedValue) ; le spring sur `state.index` sert de fallback. La géométrie de l'indicateur est exportée via `getIndicatorLeft(screenWidth, tabVisualIndex)` et `getIndicatorLeftAtProgress(screenWidth, progress)` (fonctions pures, testables). Le FAB central (`router.push('/scan')`) est rendu entre le 2e et 3e onglet. L'onglet Profil affiche l'avatar utilisateur si connecté. Hide-on-scroll via `dockTranslateY` du `NavigationChromeContext`. Accessibilité : chaque onglet a `accessibilityRole="tab"` + `accessibilityLabel`.

### `SearchChrome` — `src/features/search/SearchChrome.tsx`

Chrome partagé rendu dans le layout des tabs (`(tabs)/_layout.tsx`). Contient la barre de recherche persistante (BlurView), le FAB micro, le `VoiceOverlay`, et toute la logique de recherche vocale (STT on-device + fallback Whisper). Auto-masqué sur l'onglet Profil (`usePathname() === '/profile'`).

---

## §7 — Algorithme de recherche

### Vue d'ensemble

La recherche est 100 % Postgres via la RPC `search_parfums`, sans API externe. Chaque parfum (~25 100 lignes dans `parfums`) porte deux colonnes **générées** : `search_text` (texte normalisé, index GIN `pg_trgm`) et `search_vector` (tsvector, config `french_unaccent` = `unaccent` + dictionnaire `simple`, sans stemming). L'utilisateur tape → debounce 150ms → RPC → top 50. Le client ajoute un cache LRU + prefix cache. `searchKeywords` n'est plus stocké.

### Couche 1 — Indexation (colonnes générées, migration 0003)

`search_text = norm_txt(marque || ' ' || nom)` (lowercase + `unaccent` + remplacement des non-alnum par espace). `search_vector = to_tsvector('french_unaccent', marque+nom+famille+notes)`. Index : `gin(search_text gin_trgm_ops)` (préfixe + typo) + `gin(search_vector)` (FTS). `norm_txt`/`immutable_unaccent` vivent dans `supabase/migrations/0001`.

### Couche 2 — Tokenisation de la requête (client, pour le prefix cache)

Même logique qu'historiquement : lowercase → split espaces → `normalize` + split `_` → filtre `STOP_WORDS` + min 2 chars → max 4 tokens triés par longueur desc (`src/utils/normalize.ts`).

### Couche 3 — RPC `search_parfums(q, max_results)` (scoring serveur)

La RPC fait tout le scoring côté Postgres :

- **Candidats** : `search_text %> token` (word-similarity trgm, joint sur chaque token) ∪ `search_vector @@ tsquery`.
- **matchScore** = Σ `word_similarity(token, search_text)` par token (≈ ancien `token.len / bestKeyword.len`).
- **exactMatch** = +10 si ≥ 2 tokens ET `search_text` contient la query normalisée.
- **popBonus** = `ln(greatest(review_count, rating_count, popularity_score) + 1) / 2`.
- **Fuzzy** : si < 5 résultats, `similarity(search_text, q) > 0.25` (Jaccard trgm natif — remplace l'ancien fallback `$`-padded côté client).
- **Dédup** : `DISTINCT ON (norm_txt(marque), norm_txt(nom))` + `ORDER BY score DESC, pop DESC LIMIT max_results`.

### Couche 4 — Caches client (`src/services/impl/catalog.supabase.ts`)

#### Cache exact (LRU, 200 entrées, TTL 10 min)
`peekSearchCache()` / `clearSearchCache()` exposés (rate limiter, mutations admin).

#### Prefix cache
Si une query plus courte est en cache (et **même nombre de mots**), re-score local sur `search_text` avec la formule matchScore/exactMatch/popBonus identique ; fallthrough RPC si < 5 résultats re-scorés.

#### Recherches récentes (AsyncStorage)
Les 5 dernières recherches persistent dans `@parfumscan/recent-searches`.

### Couche 5 — Debounce et anti-race (`useCatalog`)

| Mécanisme | Détail |
|---|---|
| **Debounce** | 150ms avant d'appeler `searchParfumsCached` |
| **Seuil** | Query < 3 caractères → pas de requête |
| **Anti-race** | `requestIdRef` incrémenté à chaque frappe ; seuls les résultats du dernier ID sont appliqués |
| **Unmount safety** | `mountedRef` empêche `setState` après démontage |

### Flux complet (catalogue)

```
Frappe utilisateur
  → useCatalog.search() [debounce 150ms, requestIdRef anti-race]
    → searchParfumsCached(query)
      → Cache exact (LRU) ? return
      → Tokenisation + filtrage stop words
      → Prefix cache (si même nombre de mots) ? re-score local → return si ≥ 5
      → RPC search_parfums (scoring + fuzzy + dédup + limit 50)
      → Dédoublonnage sécurité marque+nom
      → Cache (LRU) + return top 50
    → setParfums(results)
```

### Dédoublonnage marque+nom (`dedupByMarqueNom`, `impl/search-shared.ts`)

Filtre par clé `normalize(marque) + '_' + normalize(nom)`, garde le 1er (meilleur score). Appliqué côté RPC (`DISTINCT ON`) + sécurité client (sortie de `searchParfumsCached`/`searchParfumFromScan`/prefix cache).

### `searchParfumFromScan` — Recherche optimisée scan (client, inchangé)

Le scan GPT-4o Vision fournit marque + nom structurés. `searchParfumFromScan` appelle `searchParfumsCached([marque, nom])` puis rescore côté client :

```
Bonus nom exact      = +50   (doc.nom normalisé === gptNom normalisé)
Bonus nom partiel    = +25   (l'un contient l'autre)
Bonus marque exacte  = +15   (doc.marque normalisée === gptMarque normalisée)
Bonus marque partiel = +8    (l'un contient l'autre)
→ Tri par bonus desc, tiebreaker bestPrice asc → dédup marque+nom
```

**Pourquoi** : le scan est de l'**identification** (l'utilisateur sait quel parfum il scanne) — le +50 garantit que le match de nom exact écrase les variants/flankers plus populaires.

### Autres requêtes catalogue

- `getSimilarParfums` → RPC `similar_parfums` (cardinalité de l'intersection `main_accords` × 10 + popularité/100, shuffle journalier via `setseed(hashtext(current_date))`).
- `getPersonalizedSuggestions` → RPC `personalized_suggestions` (scores famille × 3 + marque × 2 + popularité/20 calculés en SQL sur favoris+scans, exclus déjà vus).
- `getParfumsByPerfumer` → PostgREST `.contains('perfumers', [name])` + `order('popularity_score')` (index GIN `perfumers`).
