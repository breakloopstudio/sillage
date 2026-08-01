import { normaliseId } from './fragrantica';

/**
 * Parsing des titres de fiches Fragrantica au format Apify :
 *   « <nom> <marque> <type?> - a fragrance for <genre> <année?> »
 *
 * Port exact de la fonction historique d'import-fresh.ts — partagée par
 * import-fresh (calcul de l'id BDD) et scrape-perfumes --format=clean
 * (merge des fichiers data/clean par id calculée).
 */

export interface ParsedTitle {
  nom: string;
  annee: number | undefined;
  typeParfum: string | undefined;
  genderLabel: string | undefined;
}

// ─── Concentration dérivée du nom officiel ───────────────────────────────────
// Miroir de src/utils/parfum-labels.ts (concentrationFromName + typeParfumLabel).
// Le <title> SEO de Fragrantica porte un mot-clé générique (« cologne » / « perfume »)
// qui ne reflète pas le flacon ; la seule source fiable est le suffixe du nom (h1).
// Garder synchronisé avec l'app.

const CONC_SUFFIXES = [
  'eau de parfum', 'eau de toilette', 'eau de cologne', 'extrait de parfum',
  'parfum', 'perfume', 'cologne', 'edp', 'edt', 'edc',
];

function typeParfumLabel(v: string): string | null {
  const k = v.toLowerCase().replace(/[^a-z]/g, '');
  if (!k) return null;
  if (k.includes('extrait') || k.includes('pure')) return 'Extrait';
  if (k.includes('edp') || k.includes('eaudeparfum')) return 'Eau de Parfum';
  if (k.includes('edt') || k.includes('eaudetoilette')) return 'Eau de Toilette';
  if (k.includes('edc') || k.includes('eaudecologne') || k === 'cologne') return 'Eau de Cologne';
  if (k.includes('parfum') || k.includes('perfume')) return 'Parfum';
  const trimmed = v.trim();
  return trimmed ? trimmed.charAt(0).toUpperCase() + trimmed.slice(1) : null;
}

export function concentrationFromName(nom: string | null | undefined): string | null {
  if (!nom) return null;
  const trimmed = nom.trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();
  for (const s of CONC_SUFFIXES) {
    const tail = ` ${s}`;
    if (lower.endsWith(tail)) {
      const before = trimmed.slice(0, trimmed.length - tail.length).trim();
      if (before.length > 0) return typeParfumLabel(s);
    }
  }
  return null;
}

export function parseTitle(title: string, brandName: string): ParsedTitle {
  const parts = title.split(' - ');
  const left = (parts[0] ?? '').trim();
  const right = (parts[1] ?? '').trim();

  let nom = left;

  const brandLower = brandName.toLowerCase();
  const leftLower = left.toLowerCase();
  const lastBrandIdx = leftLower.lastIndexOf(brandLower);

  if (lastBrandIdx !== -1) {
    nom = left.slice(0, lastBrandIdx).trim();
  }

  if (!nom) nom = left;

  // Concentration dérivée du nom officiel (suffixe), jamais du <title> SEO bruité.
  const typeParfum = concentrationFromName(nom) ?? undefined;

  let annee: number | undefined;
  if (right) {
    const yearMatch = right.match(/\b(\d{4})\b/);
    if (yearMatch) {
      annee = parseInt(yearMatch[1], 10);
      if (annee < 1900 || annee > 2030) annee = undefined;
    }
  }

  let genderLabel: string | undefined;
  if (right) {
    const rl = right.toLowerCase();
    if (rl.includes('women and men') || rl.includes('men and women') || rl.includes('women & men') || rl.includes('unisex')) {
      genderLabel = 'unisex';
    } else if (rl.includes('women') || rl.includes('female')) {
      genderLabel = 'female';
    } else if (rl.includes('men') || rl.includes('male')) {
      genderLabel = 'male';
    }
  }

  return { nom, annee, typeParfum, genderLabel };
}

/** Id BDD d'un parfum = normaliseId(marque_nom) — même formule qu'import-fresh. */
export function parfumIdFromTitle(title: string, brandName: string): string {
  const { nom } = parseTitle(title, brandName);
  return normaliseId(`${brandName}_${nom}`);
}
