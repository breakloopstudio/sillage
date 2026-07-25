// src/utils/season.ts — Constantes, types et helpers saisonniers partagés
// (catalogue fiche détail, filtres favoris, scripts backfill)

export type SeasonKey = 'spring' | 'summer' | 'fall' | 'winter';

export const SEASON_ORDER: SeasonKey[] = ['spring', 'summer', 'fall', 'winter'];

export const SEASON_META: Record<SeasonKey, {
  label: string;
  icon: string;
  token: 'seasonSpring' | 'seasonSummer' | 'seasonFall' | 'seasonWinter';
  tokenSoft: 'seasonSpringSoft' | 'seasonSummerSoft' | 'seasonFallSoft' | 'seasonWinterSoft';
}> = {
  spring: { label: 'Printemps', icon: 'flower-outline', token: 'seasonSpring', tokenSoft: 'seasonSpringSoft' },
  summer: { label: 'Été',       icon: 'sunny',          token: 'seasonSummer', tokenSoft: 'seasonSummerSoft' },
  fall:   { label: 'Automne',   icon: 'leaf',           token: 'seasonFall',   tokenSoft: 'seasonFallSoft' },
  winter: { label: 'Hiver',     icon: 'snow',           token: 'seasonWinter', tokenSoft: 'seasonWinterSoft' },
};

export function normalizeSeasonKey(name: string): SeasonKey | null {
  const k = name.toLowerCase().trim();
  if (k === 'autumn') return 'fall';
  return (SEASON_ORDER as string[]).includes(k) ? (k as SeasonKey) : null;
}

export const SEASON_MATCH_THRESHOLD = 50;

export function seasonScoresFromRanking(
  ranking: { name: string; score: number }[] | null | undefined,
): Partial<Record<SeasonKey, number>> | null {
  if (!ranking || ranking.length === 0) return null;
  const map: Partial<Record<SeasonKey, number>> = {};
  for (const item of ranking) {
    const k = normalizeSeasonKey(item.name);
    if (!k) continue;
    map[k] = Math.max(map[k] ?? 0, item.score);
  }
  return Object.keys(map).length > 0 ? map : null;
}
