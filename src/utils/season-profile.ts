import {
  SEASON_ORDER,
  SEASON_META,
  normalizeSeasonKey,
  type SeasonKey,
} from './season';

// ─── Occasions (déplacé depuis la fiche détail) ──────────────────────────────
// Plusieurs clés EN → même label FR ; on déduplique par label en gardant le
// score max. Les clés inconnues sont ignorées (jamais de fallback brut).

export const OCCASION_META: Record<string, { label: string; icon: string }> = {
  casual:       { label: 'Jour',        icon: 'sunny' },
  day:          { label: 'Jour',        icon: 'sunny' },
  daily:        { label: 'Jour',        icon: 'sunny' },
  evening:      { label: 'Soirée',      icon: 'moon' },
  night:        { label: 'Soirée',      icon: 'moon' },
  'night out':  { label: 'Soirée',      icon: 'moon' },
  night_out:    { label: 'Soirée',      icon: 'moon' },
  party:        { label: 'Fête',        icon: 'musical-notes' },
  club:         { label: 'Fête',        icon: 'musical-notes' },
  work:         { label: 'Bureau',      icon: 'briefcase' },
  office:       { label: 'Bureau',      icon: 'briefcase' },
  business:     { label: 'Bureau',      icon: 'briefcase' },
  professional: { label: 'Bureau',      icon: 'briefcase' },
  date:         { label: 'Rendez-vous', icon: 'heart' },
  romantic:     { label: 'Rendez-vous', icon: 'heart' },
  formal:       { label: 'Formel',      icon: 'shirt' },
  sport:        { label: 'Sport',       icon: 'fitness' },
  leisure:      { label: 'Loisir',      icon: 'game-controller' },
};

export interface RankedItem { key: string; label: string; icon: string; score: number }

export function rankAndDedupe(ranking: { name: string; score: number }[] | null | undefined): RankedItem[] {
  if (!ranking) return [];
  const byLabel = new Map<string, RankedItem>();
  for (const item of ranking) {
    const k = item.name.toLowerCase().trim();
    const meta = OCCASION_META[k];
    if (!meta) continue;
    const existing = byLabel.get(meta.label);
    if (!existing || item.score > existing.score) {
      byLabel.set(meta.label, { key: k, label: meta.label, icon: meta.icon, score: item.score });
    }
  }
  return [...byLabel.values()].sort((a, b) => b.score - a.score);
}

// ─── Phrases d'émanation par saison (affichées au tap, descriptives) ─────────

export const SEASON_PHRASES: Record<SeasonKey, string> = {
  spring: 'Il s’épanouit quand l’air se réchauffe et que la peau se découvre.',
  summer: 'Chaleur, sel et lumière : il donne le meilleur sous le soleil.',
  fall:   'Il épouse l’air frais et les matières qui reviennent.',
  winter: 'Il se love dans le froid et réchauffe de l’intérieur.',
};

// Accroche lookbook par saison dominante (voix aphoristique, ≤ 6 mots, métaphore
// sensorielle). Distincte de la ligne factuelle du hero (« Hiver · Soirée ») :
// c'est l'italic #2 de la fiche, non adjacente (pyramide + accords + perf entre).
export const SEASON_HEADLINE: Record<SeasonKey, string> = {
  spring: 'La peau se découvre',
  summer: 'L’éclat des beaux jours',
  fall:   'Il épouse la fraîcheur',
  winter: 'Une chaleur intime',
};

// ─── Moment de la journée (dérivé du vote, pas inventé) ──────────────────────
// Les votes `day`/`night` existent dans season_ranking mais ne sont pas des
// saisons → on les lit à part. On n'affiche un moment que si l'écart est net.

const DAY_NIGHT_THRESHOLD = 0.25;

export const DAY_NIGHT_TEXT: Record<'day' | 'night', string> = {
  day: 'plutôt en journée',
  night: 'se porte plutôt le soir',
};

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
