// src/utils/season.ts — Constantes, types et helpers saisonniers partagés
// (catalogue fiche détail, filtres favoris, scripts backfill)

export type SeasonKey = 'spring' | 'summer' | 'fall' | 'winter';

export const SEASON_ORDER: SeasonKey[] = ['spring', 'summer', 'fall', 'winter'];

export const SEASON_META: Record<SeasonKey, {
  label: string;
  withArticle: string;
  icon: string;
  token: 'seasonSpring' | 'seasonSummer' | 'seasonFall' | 'seasonWinter';
  tokenSoft: 'seasonSpringSoft' | 'seasonSummerSoft' | 'seasonFallSoft' | 'seasonWinterSoft';
}> = {
  spring: { label: 'Printemps', withArticle: 'le printemps', icon: 'flower-outline', token: 'seasonSpring', tokenSoft: 'seasonSpringSoft' },
  summer: { label: 'Été',       withArticle: "l'été",        icon: 'sunny',          token: 'seasonSummer', tokenSoft: 'seasonSummerSoft' },
  fall:   { label: 'Automne',   withArticle: "l'automne",    icon: 'leaf',           token: 'seasonFall',   tokenSoft: 'seasonFallSoft' },
  winter: { label: 'Hiver',     withArticle: "l'hiver",      icon: 'snow',           token: 'seasonWinter', tokenSoft: 'seasonWinterSoft' },
};

export function currentSeason(date: Date = new Date()): SeasonKey {
  const m = date.getMonth();
  if (m >= 2 && m <= 4) return 'spring';
  if (m >= 5 && m <= 7) return 'summer';
  if (m >= 8 && m <= 10) return 'fall';
  return 'winter';
}

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
