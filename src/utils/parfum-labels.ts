import type { Parfum } from '../models';

export function typeParfumLabel(v: string | null | undefined): string | null {
  if (!v) return null;
  const k = v.toLowerCase().replace(/[^a-z]/g, '');
  if (!k) return null;
  if (k.includes('extrait') || k.includes('pure')) return 'Extrait';
  if (k.includes('edp') || k.includes('eaudeparfum')) return 'Eau de Parfum';
  if (k.includes('edt') || k.includes('eaudetoilette')) return 'Eau de Toilette';
  if (k.includes('edc') || k.includes('eaudecologne') || k === 'cologne') return 'Eau de Cologne';
  if (k.includes('parfum') || k.includes('perfume')) return 'Parfum';
  const trimmed = v.trim();
  if (!trimmed) return null;
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

export function genderLabel(v: string | null | undefined): string | null {
  if (!v) return null;
  const k = v.toLowerCase().replace(/[^a-z]/g, '');
  if (!k) return null;
  if (k.includes('unisex') || k.includes('shared') || k.includes('mixte')) return 'Mixte';
  if (k.includes('women') || k.includes('female') || k.includes('femme')) return 'Femme';
  if (k.includes('men') || k.includes('male') || k.includes('homme')) return 'Homme';
  return null;
}

const CONC_SUFFIXES = [
  'eau de parfum', 'eau de toilette', 'eau de cologne', 'extrait de parfum',
  'parfum', 'perfume', 'cologne', 'edp', 'edt', 'edc',
];

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

export function resolveConcentration(p: Parfum | null | undefined): string | null {
  if (!p) return null;
  return concentrationFromName(p.nom);
}

export function communityRatingLabel(p: Parfum | null | undefined): string | null {
  if (!p) return null;
  let v: number | null = null;
  if (typeof p.ratingScore === 'number' && !Number.isNaN(p.ratingScore)) v = p.ratingScore;
  else if (typeof p.rating === 'string') {
    const parsed = parseFloat(p.rating);
    if (!Number.isNaN(parsed)) v = parsed;
  }
  if (v === null) return null;
  return v.toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}
