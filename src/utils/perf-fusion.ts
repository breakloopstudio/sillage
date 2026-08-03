// Fusion des votes Fragrantica (breakout) avec les votes utilisateurs.
// Miroir exact du calcul SQL (0058_perf_longevity_5_cranks.sql) : normalisation
// du breakout en crans UI (longévité 5 crans 1:1, sillage 4 crans), borne
// `min(CAP, total)/total`, fusion, score→cran.
// Sert à la validation unitaire du contrat SQL.

export const PERF_CAP = 100; // calibré sur la médiane réelle du catalogue (56 votes)

export type PerfDimensionKey = 'longevity' | 'sillage';

/** Distribution brute par label, ex. [{"weak":280},{"moderate":1537}]. */
export type Breakout = Record<string, number>[] | null | undefined;

/** Normalise un breakout Fragrantica en crans UI : 5 (longévité) ou 4 (sillage). */
export function perfCranks(breakout: Breakout, dimension: PerfDimensionKey): number[] {
  const v = (labels: string[]): number => {
    if (!breakout) return 0;
    let sum = 0;
    for (const entry of breakout) {
      for (const lbl of labels) sum += entry[lbl] ?? 0;
    }
    return sum;
  };
  if (dimension === 'longevity') {
    return [v(['very weak']), v(['weak']), v(['moderate']), v(['long lasting']), v(['eternal'])];
  }
  return [v(['intimate']), v(['moderate']), v(['strong']), v(['enormous'])];
}

/**
 * Score moyen fusionné sur les crans de la dimension (5 longévité, 4 sillage).
 * cranksUser = comptes de votes utilisateurs par cran.
 * null si aucun vote des deux côtés.
 */
export function perfScore(
  cranksFrag: number[],
  cranksUser: number[],
  cap: number = PERF_CAP,
): number | null {
  const n = Math.max(cranksFrag.length, cranksUser.length);
  let fragTotal = 0;
  let userTotal = 0;
  for (let i = 0; i < n; i++) {
    fragTotal += cranksFrag[i] ?? 0;
    userTotal += cranksUser[i] ?? 0;
  }
  if (fragTotal + userTotal === 0) return null;
  const poids = fragTotal === 0 ? 0 : Math.min(cap, fragTotal) / fragTotal;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    const contrib = (cranksFrag[i] ?? 0) * poids + (cranksUser[i] ?? 0);
    num += (i + 1) * contrib;
    den += contrib;
  }
  return num / den;
}

/** Score fusionné → cran affiché, arrondi borné (5 longévité, 4 sillage). */
export function perfLevel(score: number | null, dimension: PerfDimensionKey): number | null {
  if (score === null) return null;
  const max = dimension === 'longevity' ? 5 : 4;
  return Math.max(1, Math.min(max, Math.round(score)));
}

const LONG_LABELS: Record<number, string> = { 1: 'Très courte', 2: 'Courte', 3: 'Modérée', 4: 'Longue', 5: 'Très longue' };
const SILL_LABELS: Record<number, string> = { 1: 'Intime', 2: 'Modéré', 3: 'Présent', 4: 'Puissant' };

/** Libellé FR d'un cran (mêmes seuils que l'app). */
export function perfLabel(dimension: PerfDimensionKey, level: number | null): string | null {
  if (level === null) return null;
  return dimension === 'longevity' ? (LONG_LABELS[level] ?? null) : (SILL_LABELS[level] ?? null);
}

/** Équivalent Fragrantica retenu après borne (pour transparence « X votes »). */
export function perfFragEquiv(cranksFrag: number[], cap: number = PERF_CAP): number {
  const total = cranksFrag.reduce((a, b) => a + b, 0);
  if (total === 0) return 0;
  return total * (Math.min(cap, total) / total);
}
