// src/utils/normalize.ts — Utilitaires de normalisation des chaînes

export function normalize(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

export function normalizeId(s: string): string {
  return normalize(s);
}
