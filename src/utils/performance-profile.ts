// src/utils/performance-profile.ts — Crans UI longévité/sillage
// Labels résolus via i18next à la construction (fonctions, jamais au scope module — §23).

import i18next from 'i18next';

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

type LongValueKey = `perf.longevity.values.v${1 | 2 | 3 | 4 | 5}`;
type LongTickKey = `perf.longevity.ticks.t${1 | 2 | 3 | 4 | 5}`;
type LongHourKey = `perf.longevity.hours.h${1 | 2 | 3 | 4 | 5}`;
type LongEmanationKey = `perf.longevity.emanations.e${1 | 2 | 3 | 4 | 5}`;
type SillValueKey = `perf.sillage.values.v${1 | 2 | 3 | 4}`;
type SillTickKey = `perf.sillage.ticks.t${1 | 2 | 3 | 4}`;
type SillEmanationKey = `perf.sillage.emanations.e${1 | 2 | 3 | 4}`;

const LONG_TICK_KEYS: LongTickKey[] = [
  'perf.longevity.ticks.t1', 'perf.longevity.ticks.t2', 'perf.longevity.ticks.t3',
  'perf.longevity.ticks.t4', 'perf.longevity.ticks.t5',
];
const SILL_TICK_KEYS: SillTickKey[] = [
  'perf.sillage.ticks.t1', 'perf.sillage.ticks.t2', 'perf.sillage.ticks.t3', 'perf.sillage.ticks.t4',
];

const LONG_VALUE_KEYS: Record<number, LongValueKey> = {
  1: 'perf.longevity.values.v1',
  2: 'perf.longevity.values.v2',
  3: 'perf.longevity.values.v3',
  4: 'perf.longevity.values.v4',
  5: 'perf.longevity.values.v5',
};

const SILL_VALUE_KEYS: Record<number, SillValueKey> = {
  1: 'perf.sillage.values.v1',
  2: 'perf.sillage.values.v2',
  3: 'perf.sillage.values.v3',
  4: 'perf.sillage.values.v4',
};

const LONG_EMANATION_KEYS: Record<number, LongEmanationKey> = {
  1: 'perf.longevity.emanations.e1',
  2: 'perf.longevity.emanations.e2',
  3: 'perf.longevity.emanations.e3',
  4: 'perf.longevity.emanations.e4',
  5: 'perf.longevity.emanations.e5',
};

const SILL_EMANATION_KEYS: Record<number, SillEmanationKey> = {
  1: 'perf.sillage.emanations.e1',
  2: 'perf.sillage.emanations.e2',
  3: 'perf.sillage.emanations.e3',
  4: 'perf.sillage.emanations.e4',
};

// Estimation en heures dérivée du cran de longévité (traduction, pas une mesure).
const LONG_HOUR_KEYS: Record<number, LongHourKey> = {
  1: 'perf.longevity.hours.h1',
  2: 'perf.longevity.hours.h2',
  3: 'perf.longevity.hours.h3',
  4: 'perf.longevity.hours.h4',
  5: 'perf.longevity.hours.h5',
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
        label: i18next.t('perf.longevity.label'),
        icon: 'time-outline',
        level: ll,
        valueLabel: i18next.t(LONG_VALUE_KEYS[ll] ?? 'perf.longevity.values.v3'),
        hours: i18next.t(LONG_HOUR_KEYS[ll] ?? 'perf.longevity.hours.h2'),
        ticks: LONG_TICK_KEYS.map(k => i18next.t(k)),
        emanation: i18next.t(LONG_EMANATION_KEYS[ll] ?? 'perf.longevity.emanations.e2'),
      }
    : null;

  const sillDim: PerfDimension | null = sl > 0
    ? {
        key: 'sillage',
        label: i18next.t('perf.sillage.label'),
        icon: 'radio-outline',
        level: sl,
        valueLabel: i18next.t(SILL_VALUE_KEYS[sl] ?? 'perf.sillage.values.v2'),
        ticks: SILL_TICK_KEYS.map(k => i18next.t(k)),
        emanation: i18next.t(SILL_EMANATION_KEYS[sl] ?? 'perf.sillage.emanations.e2'),
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
      label: i18next.t('perf.longevity.label'),
      icon: 'time-outline',
      level,
      valueLabel: i18next.t(LONG_VALUE_KEYS[level] ?? 'perf.longevity.values.v3'),
      hours: i18next.t(LONG_HOUR_KEYS[level] ?? 'perf.longevity.hours.h2'),
      ticks: LONG_TICK_KEYS.map(k => i18next.t(k)),
      emanation: i18next.t(LONG_EMANATION_KEYS[level] ?? 'perf.longevity.emanations.e2'),
    };
  }
  return {
    key,
    label: i18next.t('perf.sillage.label'),
    icon: 'radio-outline',
    level,
    valueLabel: i18next.t(SILL_VALUE_KEYS[level] ?? 'perf.sillage.values.v2'),
    ticks: SILL_TICK_KEYS.map(k => i18next.t(k)),
    emanation: i18next.t(SILL_EMANATION_KEYS[level] ?? 'perf.sillage.emanations.e2'),
  };
}
