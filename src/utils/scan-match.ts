// src/utils/scan-match.ts — Helpers purs du rescoring scan.
// Fuzzy Levenshtein (typos de lecture), alias de maisons, barème nom/marque.
// Consommé par searchParfumFromScan (services/impl/catalog.supabase.ts).

import { normalize } from './normalize';

// ─── Barème (pondération nom > marque) ──────────────────────────────────────
export const SCORE_NOM_EXACT = 50;
export const SCORE_NOM_PARTIEL = 25;
export const SCORE_MARQUE_EXACT = 15;
export const SCORE_MARQUE_PARTIEL = 8;
export const SCORE_TYPE_MATCH = 12;
export const SCORE_TYPE_MISMATCH = -12;
// Seuil de similarité en dessous duquel le fuzzy n'accorde rien.
export const FUZZY_THRESHOLD = 0.55;
const FUZZY_MIN = 10;
const FUZZY_MAX = 40;

// ─── Similarité Levenshtein normalisée ──────────────────────────────────────
// Retourne 0..1 (1 = identiques). Robuste aux typos de l'OCR (« Savag » → « Sauvage »).
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  let prev: number[] = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const curr: number[] = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    prev = curr;
  }
  return prev[b.length];
}

export function fuzzySimilarity(a: string, b: string): number {
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const dist = levenshtein(na, nb);
  return 1 - dist / Math.max(na.length, nb.length);
}

// ─── Alias de maisons ───────────────────────────────────────────────────────
// La lecture GPT et le catalogue passent par la MÊME canonicalisation : les
// abréviations/variantes courantes matchent en exact des deux côtés. Clé =
// normalize() de la forme lue (accents retirés, non-alnum → _).
const BRAND_ALIASES: Record<string, string> = {
  ysl: 'ysl',
  yves_saint_laurent: 'ysl',
  saint_laurent: 'ysl',
  mfk: 'mfk',
  maison_francis_kurkdjian: 'mfk',
  francis_kurkdjian: 'mfk',
  jpg: 'jpg',
  jean_paul_gaultier: 'jpg',
  armani: 'armani',
  giorgio_armani: 'armani',
  dior: 'dior',
  christian_dior: 'dior',
  rabanne: 'paco_rabanne',
  paco_rabanne: 'paco_rabanne',
  bvlgari: 'bvlgari',
  bulgari: 'bvlgari',
  margiela: 'maison_margiela',
  maison_margiela: 'maison_margiela',
  maison_martin_margiela: 'maison_margiela',
  versace: 'versace',
  gianni_versace: 'versace',
  tomford: 'tom_ford',
  tom_ford: 'tom_ford',
  montblanc: 'montblanc',
  mont_blanc: 'montblanc',
  kilian: 'kilian',
  kilian_paris: 'kilian',
  by_kilian: 'kilian',
  narciso: 'narciso_rodriguez',
  narciso_rodriguez: 'narciso_rodriguez',
  valentino: 'valentino',
  maison_valentino: 'valentino',
  mugler: 'mugler',
  thierry_mugler: 'mugler',
  initio: 'initio',
  initio_parfums_prives: 'initio',
  marly: 'parfums_de_marly',
  parfums_de_marly: 'parfums_de_marly',
  penhaligon_s: 'penhaligon_s',
  penhaligons: 'penhaligon_s',
  l_artisan_parfumeur: 'l_artisan_parfumeur',
  artisan_parfumeur: 'l_artisan_parfumeur',
  frederic_malle: 'frederic_malle',
  editions_de_parfums_frederic_malle: 'frederic_malle',
  jean_patou: 'patou',
  patou: 'patou',
  casamorati: 'casamorati_1888',
  casamorati_1888: 'casamorati_1888',
  xerjoff_casamorati: 'casamorati_1888',
};

/** Canonicalise une maison (alias → clé commune, sinon la valeur normalisée). */
export function canonicalBrand(marque: string): string {
  const n = normalize(marque);
  return BRAND_ALIASES[n] ?? n;
}

// Sous-lignes stockées comme marques distinctes au catalogue ↔ maison mère :
// la lecture de la maison mère reste un match partiel sur la sous-ligne
// (« Xerjoff » lu → fiche Casamorati 1888).
const BRAND_LINEAGES: Record<string, string> = {
  casamorati_1888: 'xerjoff',
};

/** True si deux marques canonicalisées sont apparentées (sous-ligne ↔ maison mère). */
export function brandsRelated(a: string, b: string): boolean {
  return BRAND_LINEAGES[a] === b || BRAND_LINEAGES[b] === a;
}

// Clé canonique → formes de surface connues au catalogue (casse réelle).
// Sert à élargir la requête « marque seule » du scan (.in sur marque).
const CANONICAL_FORMS: Record<string, string[]> = {
  ysl: ['Yves Saint Laurent', 'YSL', 'Saint Laurent'],
  mfk: ['Maison Francis Kurkdjian', 'MFK'],
  jpg: ['Jean Paul Gaultier', 'JPG'],
  armani: ['Giorgio Armani', 'Armani'],
  dior: ['Dior', 'Christian Dior'],
  paco_rabanne: ['Paco Rabanne', 'Rabanne'],
  bvlgari: ['Bvlgari', 'Bulgari'],
  maison_margiela: ['Maison Margiela', 'Maison Martin Margiela', 'Margiela'],
  versace: ['Versace', 'Gianni Versace'],
  tom_ford: ['Tom Ford', 'TomFord'],
  montblanc: ['Montblanc', 'Mont Blanc'],
  kilian: ['By Kilian', 'Kilian Paris', 'Kilian'],
  narciso_rodriguez: ['Narciso Rodriguez', 'Narciso'],
  valentino: ['Valentino', 'Maison Valentino'],
  mugler: ['Mugler', 'Thierry Mugler'],
  initio: ['Initio Parfums Privés', 'Initio'],
  parfums_de_marly: ['Parfums de Marly', 'Marly'],
  penhaligon_s: ["Penhaligon's", 'Penhaligons'],
  l_artisan_parfumeur: ["L'Artisan Parfumeur", 'Artisan Parfumeur'],
  frederic_malle: ['Frédéric Malle', 'Editions de Parfums Frédéric Malle'],
  patou: ['Patou', 'Jean Patou'],
  casamorati_1888: ['Casamorati 1888', 'Casamorati', 'Xerjoff Casamorati'],
};

/** Formes de surface à interroger pour une maison lue (lecture + formes canoniques). */
export function brandQueryForms(marque: string): string[] {
  const trimmed = marque.trim();
  if (!trimmed) return [];
  const forms = CANONICAL_FORMS[canonicalBrand(trimmed)];
  return forms ? [...new Set([trimmed, ...forms])] : [trimmed];
}

// ─── Bonus « nom » ──────────────────────────────────────────────────────────
// exact > inclusion > fuzzy dégradé. Une typo de lecture ne retombe plus à 0.

// Flankers « nom (année) » : l'année entre parenthèses n'est jamais prononcée —
// « Ombre Leather » doit matcher « Ombré Leather (2018) » comme un exact.
const YEAR_SUFFIX = /\s*\((19|20)\d{2}\)\s*$/;

export function fuzzyNameBonus(docNom: string, candidate: string): number {
  const d = normalize(docNom.replace(YEAR_SUFFIX, ''));
  const c = normalize(candidate.replace(YEAR_SUFFIX, ''));
  if (!d || !c) return 0;
  if (d === c) return SCORE_NOM_EXACT;
  // Inclusion (flankers) — garde ≥3 caractères : un fragment de 1-2 lettres
  // contenu dans n'importe quel nom ne mérite pas +25.
  const included = d.includes(c) ? c : c.includes(d) ? d : null;
  if (included && included.length >= 3) return SCORE_NOM_PARTIEL;
  const sim = fuzzySimilarity(d, c);
  if (sim < FUZZY_THRESHOLD) return 0;
  return Math.round(FUZZY_MIN + (FUZZY_MAX - FUZZY_MIN) * ((sim - FUZZY_THRESHOLD) / (1 - FUZZY_THRESHOLD)));
}
