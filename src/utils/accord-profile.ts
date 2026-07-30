import { translateNote } from './translate-note';

export interface AccordRow {
  raw: string;
  display: string;
  pct: number;
  label: string | null;
  colorIndex: number;
}

export const ACCORD_GROUPS: { name: string; words: string[] }[] = [
  { name: 'amber', words: ['vanilla', 'vanille', 'amber', 'ambre', 'ambery', 'gourmand', 'oriental', 'caramel', 'tonka', 'benzoin', 'benjoin', 'honey', 'miel', 'milk', 'lait', 'balsamic', 'balsamique', 'resin', 'resine'] },
  { name: 'wood', words: ['wood', 'woody', 'bois', 'boise', 'cedar', 'cedre', 'sandalwood', 'santal', 'vetiver', 'oud', 'patchouli', 'moss', 'mousse', 'earthy', 'terreux', 'agarwood'] },
  { name: 'leather', words: ['leather', 'cuir', 'tobacco', 'tabac', 'smoky', 'smoke', 'fume', 'burnt', 'brule', 'birch'] },
  { name: 'floral', words: ['floral', 'florale', 'flower', 'fleur', 'rose', 'jasmine', 'jasmin', 'peony', 'pivoine', 'orange blossom', 'fleur d', 'ylang', 'tuberose', 'tubereuse', 'lily', 'lys', 'muguet', 'violet', 'violette'] },
  { name: 'powder', words: ['powdery', 'poudre', 'powder', 'musk', 'musc', 'iris', 'cosmetic', 'cosmetique', 'rice', 'riz', 'heliotrope'] },
  { name: 'green', words: ['aromatic', 'aromatique', 'green', 'vert', 'lavender', 'lavande', 'rosemary', 'romarin', 'herb', 'herbes', 'galbanum', 'fougere', 'fougère', 'basil', 'basilic', 'mint', 'menthe'] },
  { name: 'spice', words: ['spicy', 'spice', 'epice', 'épicé', 'cinnamon', 'cannelle', 'pepper', 'poivre', 'clove', 'girofle', 'cardamom', 'cardamome', 'saffron', 'safran', 'nutmeg', 'muscade', 'ginger', 'gingembre', 'anis'] },
  { name: 'fresh', words: ['citrus', 'agrume', 'hesperide', 'hespéridé', 'lemon', 'citron', 'bergamot', 'bergamote', 'marine', 'marin', 'aquatic', 'aquatique', 'ozone', 'ozonique', 'aldehydic', 'aldehyde', 'fresh', 'frais', 'neroli', 'grapefruit', 'pamplemousse'] },
];

const WORD_SCORE: Record<string, { pct: number; label: string }> = {
  dominant: { pct: 95, label: 'Dominant' },
  prominent: { pct: 75, label: 'Présent' },
  moderate: { pct: 50, label: 'Modéré' },
  soft: { pct: 28, label: 'Discret' },
  subtle: { pct: 15, label: 'En fond' },
  faint: { pct: 6, label: 'En fond' },
};

function labelFromScore(n: number): string {
  if (n >= 85) return 'Dominant';
  if (n >= 65) return 'Présent';
  if (n >= 40) return 'Modéré';
  if (n >= 20) return 'Discret';
  return 'En fond';
}

function parsePct(value: string): { pct: number; label: string | null } {
  const trimmed = value.trim();
  const n = parseInt(trimmed.replace('%', ''), 10);
  if (!isNaN(n)) return { pct: Math.max(0, Math.min(100, n)), label: labelFromScore(n) };
  const word = WORD_SCORE[trimmed.toLowerCase()];
  if (word) return word;
  return { pct: 40, label: null };
}

export function accordColorIndex(raw: string): number {
  const hay = ` ${raw.toLowerCase()} `;
  for (let g = 0; g < ACCORD_GROUPS.length; g++) {
    for (const w of ACCORD_GROUPS[g].words) {
      if (hay.includes(` ${w}`) || hay.includes(`${w} `) || hay.includes(` ${w} `)) return g;
    }
  }
  let h = 0;
  for (let i = 0; i < raw.length; i++) h = (h * 31 + raw.charCodeAt(i)) >>> 0;
  return h % ACCORD_GROUPS.length;
}

export function buildAccords(
  accords: string[] | undefined,
  percentages: Record<string, string> | undefined,
): AccordRow[] {
  if (!accords || accords.length === 0) return [];

  const mapped = accords.map(raw => {
    const fromPct = percentages ? percentages[raw] : undefined;
    const parsed = fromPct != null ? parsePct(fromPct) : { pct: null as number | null, label: null as string | null };
    return {
      raw,
      display: translateNote(raw),
      pct: parsed.pct,
      label: parsed.label,
      colorIndex: accordColorIndex(raw),
    };
  });

  const hasAny = mapped.some(m => m.pct !== null);
  if (hasAny) {
    const known = mapped.filter(m => m.pct !== null).map(m => m.pct as number);
    const floor = Math.max(8, Math.min(...known) - 10);
    for (const m of mapped) if (m.pct === null) m.pct = floor;
  } else {
    mapped.forEach((m, i) => { m.pct = Math.max(45, 100 - i * 12); });
  }

  return mapped
    .sort((a, b) => (b.pct as number) - (a.pct as number))
    .slice(0, 5)
    .map(m => ({ ...m, pct: m.pct as number }));
}

export const ACCORD_APHORISMS: string[] = [
  'La chaleur qui enveloppe',
  "L'ancrage sous la peau",
  'La caresse fumée',
  "Le cœur qui s'ouvre",
  "Le voile qui s'attarde",
  'La fraîcheur coupée',
  'Le frisson sur la langue',
  "L'éclat qui ouvre",
];

export function accordAphorism(colorIndex: number): string {
  return ACCORD_APHORISMS[colorIndex % ACCORD_APHORISMS.length] ?? ACCORD_APHORISMS[0];
}
