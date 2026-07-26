// src/utils/suggest.ts — Index de suggestions type-ahead (marques + noms populaires)
// Logique pure : construction de l'index et matching préfixe insensible aux accents.

import { normalize } from './normalize';

export interface SuggestionRow {
  id: string;
  nom: string;
  marque: string;
  pop: number;
}

export interface SuggestionTerm {
  kind: 'brand' | 'parfum';
  label: string;
  sub?: string;
  id?: string;
  pop: number;
  key: string;
}

export interface SuggestionIndex {
  brands: SuggestionTerm[];
  names: SuggestionTerm[];
}

export function buildSuggestionIndex(rows: SuggestionRow[]): SuggestionIndex {
  const brandMap = new Map<string, SuggestionTerm>();
  const names: SuggestionTerm[] = [];
  for (const r of rows) {
    const marque = (r.marque ?? '').trim();
    const nom = (r.nom ?? '').trim();
    if (marque) {
      const key = normalize(marque);
      if (key && !brandMap.has(key)) {
        brandMap.set(key, { kind: 'brand', label: marque, pop: r.pop, key });
      }
    }
    if (nom) {
      const key = normalize(nom);
      if (key) {
        names.push({
          kind: 'parfum',
          label: nom,
          sub: marque || undefined,
          id: r.id,
          pop: r.pop,
          key,
        });
      }
    }
  }
  return { brands: [...brandMap.values()], names };
}

function matchScore(key: string, q: string): number {
  if (key === q) return 100;
  if (key.startsWith(q)) return 80;
  if (key.split('_').some(w => w.startsWith(q))) return 60;
  if (key.includes(q)) return 40;
  return -1;
}

interface Scored {
  term: SuggestionTerm;
  s: number;
}

const BRAND_BONUS = 15;

export function matchSuggestions(index: SuggestionIndex, query: string, limit = 6): SuggestionTerm[] {
  const q = normalize(query);
  if (!q) return [];

  const scoreTerm = (t: SuggestionTerm): Scored | null => {
    const base = matchScore(t.key, q);
    if (base < 0) return null;
    const kindBonus = t.kind === 'brand' ? BRAND_BONUS : 0;
    return { term: t, s: base + kindBonus + Math.min(t.pop / 1000, 10) };
  };

  const scored = [...index.brands, ...index.names]
    .map(scoreTerm)
    .filter((x): x is Scored => x !== null)
    .sort((a, b) => b.s - a.s);

  const seen = new Set<string>();
  const out: SuggestionTerm[] = [];
  for (const { term } of scored) {
    const k = `${term.kind}_${term.key}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(term);
    if (out.length >= limit) break;
  }
  return out;
}
