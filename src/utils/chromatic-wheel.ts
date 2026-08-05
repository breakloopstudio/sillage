// src/utils/chromatic-wheel.ts — Taxonomie de la roue chromatique (v2)
// Disque colorimétrique plein : 12 teintes équidistantes de 30° sur l'anneau
// (hue réelle : red 0° → pink 330°) + 4 neutres au centre (noir, blanc, gris,
// brun — le brun est une teinte désaturée, pas une hue). Chaque couleur mappe
// vers le vocabulaire olfactif du catalogue : accords (main_accords, GIN) +
// notes (search_vector FTS) + affinité saisonnière. Mappings curés et validés
// contre data/clean (25 110 parfums) — la roue snappe vers l'ancre la plus
// proche (hueToAnchor). Labels/taglines résolus via i18next à l'affichage (§23).

import i18next from 'i18next';
import type { SeasonKey } from './season';

export type ChromaticKey =
  | 'red' | 'orange' | 'yellow' | 'lime' | 'green' | 'teal'
  | 'cyan' | 'blue' | 'indigo' | 'purple' | 'magenta' | 'pink'
  | 'black' | 'white' | 'gray' | 'brown';

export interface ChromaticColor {
  key: ChromaticKey;
  label: string;
  tagline: string;
  /** Position sur l'anneau (0-360, 0 = rouge en haut, sens horaire). null = neutre (centre). */
  hue: number | null;
  /** Affinité saisonnière — boost du scoring RPC (season_ranking). */
  season: SeasonKey | null;
  /** Accords Fragrantica (lowercase exact du catalogue, ≤ 8). */
  accords: string[];
  /** Notes de pyramide (anglais, ≤ 6) — matchées via search_vector. */
  notes: string[];
}

export const CHROMATIC_WHEEL: ChromaticColor[] = [
  {
    key: 'red',
    get label() { return i18next.t('chroma.red.label'); },
    get tagline() { return i18next.t('chroma.red.tagline'); },
    hue: 0,
    season: 'winter',
    accords: ['warm spicy', 'amber', 'rose', 'animalic'],
    notes: ['saffron', 'cinnamon', 'rose', 'tuberose', 'ylang-ylang'],
  },
  {
    key: 'orange',
    get label() { return i18next.t('chroma.orange.label'); },
    get tagline() { return i18next.t('chroma.orange.tagline'); },
    hue: 30,
    season: 'fall',
    accords: ['amber', 'honey', 'warm spicy', 'balsamic', 'vanilla'],
    notes: ['mandarin orange', 'blood orange', 'honey', 'beeswax', 'apricot', 'immortelle'],
  },
  {
    key: 'yellow',
    get label() { return i18next.t('chroma.yellow.label'); },
    get tagline() { return i18next.t('chroma.yellow.tagline'); },
    hue: 60,
    season: 'summer',
    accords: ['citrus', 'yellow floral', 'tropical', 'coconut'],
    notes: ['bergamot', 'neroli', 'orange blossom', 'coconut', 'mimosa', 'solar notes'],
  },
  {
    key: 'lime',
    get label() { return i18next.t('chroma.lime.label'); },
    get tagline() { return i18next.t('chroma.lime.tagline'); },
    hue: 90,
    season: 'summer',
    accords: ['citrus', 'green'],
    notes: ['lime', 'lemon', 'grapefruit', 'yuzu', 'citron', 'lemon verbena'],
  },
  {
    key: 'green',
    get label() { return i18next.t('chroma.green.label'); },
    get tagline() { return i18next.t('chroma.green.tagline'); },
    hue: 120,
    season: 'spring',
    accords: ['green', 'aromatic', 'mossy', 'earthy'],
    notes: ['galbanum', 'vetiver', 'mint', 'oakmoss', 'green tea', 'fig'],
  },
  {
    key: 'teal',
    get label() { return i18next.t('chroma.teal.label'); },
    get tagline() { return i18next.t('chroma.teal.tagline'); },
    hue: 150,
    season: 'summer',
    accords: ['aquatic', 'green'],
    notes: ['cucumber', 'bamboo', 'lotus', 'water lily', 'watery notes', 'melon'],
  },
  {
    key: 'cyan',
    get label() { return i18next.t('chroma.cyan.label'); },
    get tagline() { return i18next.t('chroma.cyan.tagline'); },
    hue: 180,
    season: 'summer',
    accords: ['ozonic', 'mineral', 'aldehydic'],
    notes: ['ozonic notes', 'mineral notes', 'aldehydes', 'calone', 'sea water', 'watery notes'],
  },
  {
    key: 'blue',
    get label() { return i18next.t('chroma.blue.label'); },
    get tagline() { return i18next.t('chroma.blue.tagline'); },
    hue: 210,
    season: 'summer',
    accords: ['aquatic', 'marine', 'salty'],
    notes: ['sea notes', 'marine notes', 'water notes', 'sea salt', 'algae', 'seaweed'],
  },
  {
    key: 'indigo',
    get label() { return i18next.t('chroma.indigo.label'); },
    get tagline() { return i18next.t('chroma.indigo.tagline'); },
    hue: 240,
    season: null,
    accords: ['lavender', 'iris', 'smoky'],
    notes: ['lavender', 'iris', 'frankincense', 'olibanum', 'violet leaf', 'orris root'],
  },
  {
    key: 'purple',
    get label() { return i18next.t('chroma.purple.label'); },
    get tagline() { return i18next.t('chroma.purple.tagline'); },
    hue: 270,
    season: null,
    accords: ['violet', 'iris', 'powdery'],
    notes: ['violet', 'iris', 'heliotrope', 'orchid', 'lilac', 'orris'],
  },
  {
    key: 'magenta',
    get label() { return i18next.t('chroma.magenta.label'); },
    get tagline() { return i18next.t('chroma.magenta.tagline'); },
    hue: 300,
    season: 'spring',
    accords: ['tuberose', 'white floral', 'tropical'],
    notes: ['tuberose', 'gardenia', 'jasmine sambac', 'frangipani', 'osmanthus', 'tiare flower'],
  },
  {
    key: 'pink',
    get label() { return i18next.t('chroma.pink.label'); },
    get tagline() { return i18next.t('chroma.pink.tagline'); },
    hue: 330,
    season: 'spring',
    accords: ['rose', 'fruity'],
    notes: ['peony', 'raspberry', 'strawberry', 'cherry', 'red berries', 'litchi'],
  },
  {
    key: 'black',
    get label() { return i18next.t('chroma.black.label'); },
    get tagline() { return i18next.t('chroma.black.tagline'); },
    hue: null,
    season: 'winter',
    accords: ['smoky', 'leather', 'oud', 'earthy', 'animalic', 'tobacco'],
    notes: ['incense', 'frankincense', 'myrrh', 'labdanum', 'benzoin', 'opoponax'],
  },
  {
    key: 'white',
    get label() { return i18next.t('chroma.white.label'); },
    get tagline() { return i18next.t('chroma.white.tagline'); },
    hue: null,
    season: null,
    accords: ['white floral', 'musky', 'soapy', 'aldehydic'],
    notes: ['white musk', 'jasmine', 'lily-of-the-valley', 'freesia', 'magnolia', 'aldehydes'],
  },
  {
    key: 'gray',
    get label() { return i18next.t('chroma.gray.label'); },
    get tagline() { return i18next.t('chroma.gray.tagline'); },
    hue: null,
    season: null,
    accords: ['metallic', 'mineral', 'aldehydic', 'ozonic'],
    notes: ['aldehydes', 'flint', 'iris', 'violet leaf'],
  },
  {
    key: 'brown',
    get label() { return i18next.t('chroma.brown.label'); },
    get tagline() { return i18next.t('chroma.brown.tagline'); },
    hue: null,
    season: 'fall',
    accords: ['woody', 'tobacco', 'coffee'],
    notes: ['cocoa', 'chocolate', 'rum', 'tonka bean', 'chestnut', 'hazelnut'],
  },
];

/** Ancres chromatiques de l'anneau (triées par hue croissante). */
export const RING_ANCHORS: ChromaticColor[] = CHROMATIC_WHEEL
  .filter(c => c.hue !== null)
  .sort((a, b) => (a.hue ?? 0) - (b.hue ?? 0));

/** Neutres du disque central (noir, blanc, gris, brun — ordre de la grille 2×2). */
export const CENTER_NEUTRALS: ChromaticColor[] =
  CHROMATIC_WHEEL.filter(c => c.hue === null);

export function getColorByKey(key: string | null | undefined): ChromaticColor | undefined {
  if (!key) return undefined;
  return CHROMATIC_WHEEL.find(c => c.key === key);
}

/** Distance angulaire signée la plus courte entre deux hues (−180..180). */
export function hueDistance(a: number, b: number): number {
  const d = ((b - a + 540) % 360) - 180;
  return d;
}

/** Index de l'ancre la plus proche d'un angle (0-360, snap Voronoi circulaire).
 *  Tie-break : première ancre en hue croissante (`<` strict).
 *  MIROIR : le worklet nearestAnchorIdx de ChromaticWheel réplique cette logique
 *  (les worklets ne peuvent pas appeler ce module) — garder les deux en phase. */
export function nearestAnchorIndex(hues: number[], deg: number): number {
  const h = ((deg % 360) + 360) % 360;
  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < hues.length; i++) {
    const dist = Math.abs(hueDistance(h, hues[i]));
    if (dist < bestDist) {
      bestDist = dist;
      best = i;
    }
  }
  return best;
}

/** Ancre de l'anneau la plus proche d'une teinte (snap Voronoi circulaire). */
export function hueToAnchor(hue: number): ChromaticColor {
  return RING_ANCHORS[nearestAnchorIndex(RING_ANCHORS.map(a => a.hue ?? 0), hue)];
}

/** Index de la pastille neutre touchée (−1 si aucune). Géométrie pure, testée —
 *  MIROIR worklet : nearestPadIdx dans ChromaticWheel. */
export function hitPadIndex(
  x: number,
  y: number,
  centers: { x: number; y: number }[],
  hitRadius: number,
): number {
  let best = -1;
  let bestDist = hitRadius;
  for (let i = 0; i < centers.length; i++) {
    const d = Math.hypot(x - centers[i].x, y - centers[i].y);
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  }
  return best;
}

// ─── Conversions couleur (disque SVG : spectre continu) ──────────────────────

/** HSV → hex. h en degrés (0-360), s et v en 0-1. */
export function hsvToHex(h: number, s: number, v: number): string {
  const hue = ((h % 360) + 360) % 360;
  const c = v * s;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = v - c;
  let r = 0, g = 0, b = 0;
  if (hue < 60) { r = c; g = x; }
  else if (hue < 120) { r = x; g = c; }
  else if (hue < 180) { g = c; b = x; }
  else if (hue < 240) { g = x; b = c; }
  else if (hue < 300) { r = x; b = c; }
  else { r = c; b = x; }
  const to255 = (n: number) => Math.round((n + m) * 255);
  const hex = (n: number) => to255(n).toString(16).padStart(2, '0');
  return `#${hex(r)}${hex(g)}${hex(b)}`.toUpperCase();
}

/** Teinte d'un hex (composante H de HSV, 0-360). Retourne 0 si achromatique. */
export function hexToHue(hexColor: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hexColor.trim());
  if (!m) return 0;
  const int = parseInt(m[1], 16);
  const r = ((int >> 16) & 255) / 255;
  const g = ((int >> 8) & 255) / 255;
  const b = (int & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (d === 0) return 0;
  let h: number;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return ((h * 60) + 360) % 360;
}

// ─── Palette UI (nuancier light/dark — précédent SHELF_COLORS) ───────────────
// swatch = pastille de la teinte ; soft = fond de bannière ; ink = texte sur soft.
// Le disque SVG (spectre + désaturation centrale) est invariant entre thèmes
// (contenu/instrument, esprit §2.3) ; cette palette suit le thème pour les
// surfaces textuelles (bannière /search, dots de la carte ambiance).

export interface ChromaSwatch {
  swatch: string;
  soft: string;
  ink: string;
}

export const CHROMA_PALETTE_LIGHT: Record<ChromaticKey, ChromaSwatch> = {
  red:     { swatch: '#B83A3A', soft: '#F9ECEC', ink: '#8E2B2B' },
  orange:  { swatch: '#C96A2B', soft: '#FAF0E4', ink: '#9A4E1D' },
  yellow:  { swatch: '#C9A322', soft: '#FAF5DF', ink: '#7A6216' },
  lime:    { swatch: '#7BA829', soft: '#F1F6E3', ink: '#55731D' },
  green:   { swatch: '#3E8E5A', soft: '#EAF3EC', ink: '#2C6B43' },
  teal:    { swatch: '#2A9D8F', soft: '#E6F4F2', ink: '#1D6E64' },
  cyan:    { swatch: '#1FA8C0', soft: '#E4F5F8', ink: '#167386' },
  blue:    { swatch: '#3D7AB5', soft: '#EAF1F8', ink: '#2C5C8A' },
  indigo:  { swatch: '#4A5BB5', soft: '#EBEEF8', ink: '#35438A' },
  purple:  { swatch: '#7E5AA8', soft: '#F1ECF7', ink: '#5E4281' },
  magenta: { swatch: '#C2359B', soft: '#F9E9F4', ink: '#8F2672' },
  pink:    { swatch: '#C25A8C', soft: '#F9ECF3', ink: '#94426B' },
  black:   { swatch: '#211C26', soft: '#EDEBE8', ink: '#17131A' },
  white:   { swatch: '#E9E5DE', soft: '#F7F5F1', ink: '#6E6963' },
  gray:    { swatch: '#7A7570', soft: '#F0EFEC', ink: '#57534E' },
  brown:   { swatch: '#8A5A33', soft: '#F4EDE4', ink: '#684325' },
};

export const CHROMA_PALETTE_DARK: Record<ChromaticKey, ChromaSwatch> = {
  red:     { swatch: '#E06B5F', soft: '#2A1210', ink: '#F0A89E' },
  orange:  { swatch: '#E08A4A', soft: '#291809', ink: '#F0B98A' },
  yellow:  { swatch: '#E0C24A', soft: '#282208', ink: '#EBD98A' },
  lime:    { swatch: '#A3CC4F', soft: '#1D260C', ink: '#C4DE8A' },
  green:   { swatch: '#5FBF8A', soft: '#0F2A1E', ink: '#9AD8B5' },
  teal:    { swatch: '#4FC2B4', soft: '#0D2622', ink: '#8ADDD2' },
  cyan:    { swatch: '#4FC6DA', soft: '#0C262B', ink: '#8ADCEA' },
  blue:    { swatch: '#6FA3DE', soft: '#16222F', ink: '#A8C8EA' },
  indigo:  { swatch: '#7C8FDE', soft: '#141A30', ink: '#B3BFEF' },
  purple:  { swatch: '#A98AD4', soft: '#1F1830', ink: '#CBB5E8' },
  magenta: { swatch: '#E06BC0', soft: '#2A0F22', ink: '#F0A8DC' },
  pink:    { swatch: '#E07BA1', soft: '#2A121C', ink: '#F0B3C9' },
  black:   { swatch: '#050308', soft: '#1C1822', ink: '#C9C4CE' },
  white:   { swatch: '#F2EFE9', soft: '#242228', ink: '#E5E0EA' },
  gray:    { swatch: '#9A948E', soft: '#1E1C1A', ink: '#C5C0BA' },
  brown:   { swatch: '#B9854E', soft: '#27190F', ink: '#D8B18A' },
};

export function chromaSwatch(key: ChromaticKey, mode: 'light' | 'dark'): ChromaSwatch {
  return mode === 'dark' ? CHROMA_PALETTE_DARK[key] : CHROMA_PALETTE_LIGHT[key];
}
