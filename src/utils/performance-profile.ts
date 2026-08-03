export type PerfDimensionKey = 'longevity' | 'sillage';

export interface PerfDimension {
  key: PerfDimensionKey;
  label: string;
  icon: string;
  level: number;
  valueLabel: string;
  hours?: string;
  ticks: string[];
  emanation: string;
}

export interface PerformanceProfile {
  longevity: PerfDimension | null;
  sillage: PerfDimension | null;
}

const LONG_TICKS = ['Matin', 'Midi', 'Soir', 'Nuit', 'Nuit +'];
const SILL_TICKS = ['Peau', 'Proche', 'Bras', 'Pièce'];

const LONG_VALUE: Record<number, string> = {
  1: 'Très courte',
  2: 'Courte',
  3: 'Modérée',
  4: 'Longue',
  5: 'Très longue',
};

const SILL_VALUE: Record<number, string> = {
  1: 'Intime',
  2: 'Modéré',
  3: 'Présent',
  4: 'Puissant',
};

const LONG_EMANATION: Record<number, string> = {
  1: 'Un éclat d’ouverture, déjà un souvenir.',
  2: "Elle s'estompe avant la fin de la matinée — à réserver aux occasions courtes.",
  3: "Elle vous accompagne jusqu'au milieu de journée, puis s'efface doucement.",
  4: 'Du café du matin au dernier verre : elle tient la distance, sans retouche.',
  5: 'Elle traverse la journée et s’attarde encore — une seconde peau qui ne vous quitte pas.',
};

const SILL_EMANATION: Record<number, string> = {
  1: 'Il reste au ras de la peau : on ne le devine qu’en s’approchant vraiment.',
  2: 'Il se révèle dans l’intimité d’une conversation, sans jamais précéder votre entrée.',
  3: 'Il vous entoure d’un halo perceptible à un bras tendu.',
  4: 'Il emplit l’espace autour de vous — on sent votre passage avant de vous voir.',
};

// Estimation en heures dérivée du cran de longévité (traduction, pas une mesure).
const LONG_HOURS: Record<number, string> = {
  1: '< 2 h',
  2: '2 – 4 h',
  3: '4 – 8 h',
  4: '8 – 12 h',
  5: '12 h +',
};

// Source strings (Fragrantica / legacy) : very weak | weak | moderate | long lasting | eternal
// (and legacy "very long lasting"). 5 source levels → 5 UI cranks (1:1).
// Ordre imposé : 'very weak' avant 'weak', 'very long' avant 'long' (includes()).
export function longevityLevel(v: string | null | undefined): number {
  if (!v) return 0;
  const k = v.toLowerCase().trim();
  if (k.includes('eternal') || k.includes('very long')) return 5;
  if (k.includes('long')) return 4;
  if (k.includes('moderate') || k.includes('modér')) return 3;
  if (k.includes('very weak')) return 1;
  if (k.includes('weak') || k.includes('short') || k.includes('court')) return 2;
  return 3;
}

// Source strings: intimate | moderate | strong | enormous (and legacy "heavy …").
export function sillageLevel(v: string | null | undefined): number {
  if (!v) return 0;
  const k = v.toLowerCase().trim();
  if (k.includes('enormous') || k.includes('very strong')) return 4;
  if (k.includes('strong') || k.includes('heavy') || k.includes('lourd')) return 3;
  if (k.includes('moderate') || k.includes('modér')) return 2;
  if (k.includes('intimate') || k.includes('soft') || k.includes('weak') || k.includes('léger') || k.includes('faible')) return 1;
  return 2;
}

export function buildPerformance(
  longevity: string | null | undefined,
  sillage: string | null | undefined,
): PerformanceProfile {
  const ll = longevityLevel(longevity);
  const sl = sillageLevel(sillage);

  const longDim: PerfDimension | null = ll > 0
    ? {
        key: 'longevity',
        label: 'Longévité',
        icon: 'time-outline',
        level: ll,
        valueLabel: LONG_VALUE[ll] ?? 'Modérée',
        hours: LONG_HOURS[ll] ?? LONG_HOURS[2],
        ticks: LONG_TICKS,
        emanation: LONG_EMANATION[ll] ?? LONG_EMANATION[2],
      }
    : null;

  const sillDim: PerfDimension | null = sl > 0
    ? {
        key: 'sillage',
        label: 'Sillage',
        icon: 'radio-outline',
        level: sl,
        valueLabel: SILL_VALUE[sl] ?? 'Modéré',
        ticks: SILL_TICKS,
        emanation: SILL_EMANATION[sl] ?? SILL_EMANATION[2],
      }
    : null;

  return { longevity: longDim, sillage: sillDim };
}

// Construit la dimension d'affichage pour un niveau donné (fusion Fragrantica +
// votes utilisateurs), en réutilisant icône/ticks/copy existants. Utilisé quand le
// niveau affiché vient de la RPC parfum_perf plutôt que de la string legacy.
export function perfDimensionAt(key: PerfDimensionKey, level: number | null): PerfDimension | null {
  if (level === null || level <= 0) return null;
  if (key === 'longevity') {
    return {
      key,
      label: 'Longévité',
      icon: 'time-outline',
      level,
      valueLabel: LONG_VALUE[level] ?? 'Modérée',
      hours: LONG_HOURS[level] ?? LONG_HOURS[2],
      ticks: LONG_TICKS,
      emanation: LONG_EMANATION[level] ?? LONG_EMANATION[2],
    };
  }
  return {
    key,
    label: 'Sillage',
    icon: 'radio-outline',
    level,
    valueLabel: SILL_VALUE[level] ?? 'Modéré',
    ticks: SILL_TICKS,
    emanation: SILL_EMANATION[level] ?? SILL_EMANATION[2],
  };
}
