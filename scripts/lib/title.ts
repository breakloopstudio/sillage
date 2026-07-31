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

export function parseTitle(title: string, brandName: string): ParsedTitle {
  const parts = title.split(' - ');
  const left = (parts[0] ?? '').trim();
  const right = (parts[1] ?? '').trim();

  let nom = left;
  let typeParfum: string | undefined;

  const brandLower = brandName.toLowerCase();
  const leftLower = left.toLowerCase();
  const lastBrandIdx = leftLower.lastIndexOf(brandLower);

  if (lastBrandIdx !== -1) {
    nom = left.slice(0, lastBrandIdx).trim();
    const remainder = left.slice(lastBrandIdx + brandName.length).trim();
    const typeWords = [
      'eau de parfum', 'eau de toilette', 'eau de cologne', 'extrait de parfum',
      'parfum', 'perfume', 'cologne', 'edp', 'edt', 'edc',
    ];
    const remainderLower = remainder.toLowerCase();
    for (const tw of typeWords) {
      if (remainderLower.startsWith(tw)) {
        typeParfum = remainder.slice(0, tw.length).trim();
        break;
      }
    }
  }

  if (!nom) nom = left;

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
