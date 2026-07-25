// src/services/impl/sql-utils.ts — Petits helpers partagés des impl Supabase

/** timestamptz (string ISO) → Date ; undefined si absent. */
export function toDate(v: unknown): Date | undefined {
  return typeof v === 'string' ? new Date(v) : undefined;
}

/** Date du jour au format YYYY-MM-DD (heure locale) — clé de la table sotd. */
export function today(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
