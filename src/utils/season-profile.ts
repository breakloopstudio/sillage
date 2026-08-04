import i18next from 'i18next';
import {
  SEASON_ORDER,
  SEASON_META,
  normalizeSeasonKey,
  type SeasonKey,
} from './season';

// ─── Occasions (déplacé depuis la fiche détail) ──────────────────────────────
// Plusieurs clés EN → même clé de label i18n ; on déduplique par clé de label
// (indépendant de la langue) en gardant le score max. Les clés inconnues sont
// ignorées (jamais de fallback brut).

export type OccasionLabelKey =
  | 'occasions.day'
  | 'occasions.evening'
  | 'occasions.party'
  | 'occasions.work'
  | 'occasions.romantic'
  | 'occasions.formal'
  | 'occasions.sport'
  | 'occasions.leisure';

export const OCCASION_META: Record<string, { labelKey: OccasionLabelKey; icon: string }> = {
  casual:       { labelKey: 'occasions.day',      icon: 'sunny' },
  day:          { labelKey: 'occasions.day',      icon: 'sunny' },
  daily:        { labelKey: 'occasions.day',      icon: 'sunny' },
  evening:      { labelKey: 'occasions.evening',  icon: 'moon' },
  night:        { labelKey: 'occasions.evening',  icon: 'moon' },
  'night out':  { labelKey: 'occasions.evening',  icon: 'moon' },
  night_out:    { labelKey: 'occasions.evening',  icon: 'moon' },
  party:        { labelKey: 'occasions.party',    icon: 'musical-notes' },
  club:         { labelKey: 'occasions.party',    icon: 'musical-notes' },
  work:         { labelKey: 'occasions.work',     icon: 'briefcase' },
  office:       { labelKey: 'occasions.work',     icon: 'briefcase' },
  business:     { labelKey: 'occasions.work',     icon: 'briefcase' },
  professional: { labelKey: 'occasions.work',     icon: 'briefcase' },
  date:         { labelKey: 'occasions.romantic', icon: 'heart' },
  romantic:     { labelKey: 'occasions.romantic', icon: 'heart' },
  formal:       { labelKey: 'occasions.formal',   icon: 'shirt' },
  sport:        { labelKey: 'occasions.sport',    icon: 'fitness' },
  leisure:      { labelKey: 'occasions.leisure',  icon: 'game-controller' },
};

export interface RankedItem { key: string; label: string; icon: string; score: number }

export function rankAndDedupe(ranking: { name: string; score: number }[] | null | undefined): RankedItem[] {
  if (!ranking) return [];
  const byLabelKey = new Map<OccasionLabelKey, RankedItem>();
  for (const item of ranking) {
    const k = item.name.toLowerCase().trim();
    const meta = OCCASION_META[k];
    if (!meta) continue;
    const existing = byLabelKey.get(meta.labelKey);
    if (!existing || item.score > existing.score) {
      byLabelKey.set(meta.labelKey, { key: k, label: i18next.t(meta.labelKey), icon: meta.icon, score: item.score });
    }
  }
  return [...byLabelKey.values()].sort((a, b) => b.score - a.score);
}

// ─── Moment de la journée (dérivé du vote, pas inventé) ──────────────────────
// Les votes `day`/`night` existent dans season_ranking mais ne sont pas des
// saisons → on les lit à part. On n'affiche un moment que si l'écart est net.
// (Textes d'affichage : encore inline FR dans SeasonProfile — clés i18n
// ajoutées à l'extraction du composant.)

const DAY_NIGHT_THRESHOLD = 0.25;

export function dayNightLabel(day: number, night: number): 'day' | 'night' | null {
  const max = Math.max(day, night);
  if (max <= 0) return null;
  if (Math.abs(day - night) / max < DAY_NIGHT_THRESHOLD) return null;
  return night > day ? 'night' : 'day';
}

// ─── Profil « Quand le porter » ──────────────────────────────────────────────

export interface SeasonColumn {
  key: SeasonKey;
  label: string;
  icon: string;
  token: 'seasonSpring' | 'seasonSummer' | 'seasonFall' | 'seasonWinter';
  tokenSoft: 'seasonSpringSoft' | 'seasonSummerSoft' | 'seasonFallSoft' | 'seasonWinterSoft';
  score: number;
  ratio: number;
  isTop: boolean;
}

export interface SeasonProfileData {
  columns: SeasonColumn[];
  seasonMax: number;
  topSeasonKey: SeasonKey | null;
  occasions: RankedItem[];
  topOccasions: RankedItem[];
  dayNight: 'day' | 'night' | null;
}

interface SeasonInput {
  seasonRanking?: { name: string; score: number }[] | null;
  occasionRanking?: { name: string; score: number }[] | null;
}

export function buildSeasonProfile(parfum: SeasonInput | null | undefined): SeasonProfileData | null {
  if (!parfum) return null;

  const seasonScores = new Map<SeasonKey, number>();
  let dayScore = 0;
  let nightScore = 0;

  if (parfum.seasonRanking) {
    for (const item of parfum.seasonRanking) {
      const raw = item.name.toLowerCase().trim();
      const k = normalizeSeasonKey(item.name);
      if (k) {
        seasonScores.set(k, Math.max(seasonScores.get(k) ?? 0, item.score));
      } else if (raw === 'day') {
        dayScore = Math.max(dayScore, item.score);
      } else if (raw === 'night') {
        nightScore = Math.max(nightScore, item.score);
      }
    }
  }

  const seasonMax = Math.max(0, ...seasonScores.values());
  const topSeasonKey = seasonMax > 0
    ? (SEASON_ORDER.find(k => seasonScores.get(k) === seasonMax) ?? null)
    : null;

  const columns: SeasonColumn[] = SEASON_ORDER.map(key => {
    const meta = SEASON_META[key];
    const score = seasonScores.get(key) ?? 0;
    return {
      key,
      label: meta.label,
      icon: meta.icon,
      token: meta.token,
      tokenSoft: meta.tokenSoft,
      score,
      ratio: seasonMax > 0 ? score / seasonMax : 0,
      isTop: key === topSeasonKey,
    };
  });

  const occasions = rankAndDedupe(parfum.occasionRanking);

  if (seasonMax === 0 && occasions.length === 0) return null;

  return {
    columns,
    seasonMax,
    topSeasonKey,
    occasions,
    topOccasions: occasions.slice(0, 3),
    dayNight: dayNightLabel(dayScore, nightScore),
  };
}
