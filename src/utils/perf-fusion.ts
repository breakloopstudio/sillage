// Fusion des votes Fragrantica (breakout) avec les votes utilisateurs.
// Miroir exact du calcul SQL (0042_user_perf_votes.sql) : normalisation du
// breakout en 4 crans UI, borne `min(CAP, total)/total`, fusion, score→cran.
// Sert à la validation unitaire ET au recalcul optimiste après un vote (sans RPC).

export const PERF_CAP = 100; // calibré sur la médiane réelle du catalogue (56 votes)

export type PerfDimensionKey = 'longevity' | 'sillage';

/** Distribution brute par label, ex. [{"weak":280},{"moderate":1537}]. */
export type Breakout = Record<string, number>[] | null | undefined;

/** Normalise un breakout Fragrantica en 4 crans UI [c1, c2, c3, c4]. */
export function perfCranks(breakout: Breakout, dimension: PerfDimensionKey): [number, number, number, number] {
  const v = (labels: string[]): number => {
    if (!breakout) return 0;
    let sum = 0;
    for (const entry of breakout) {
      for (const lbl of labels) sum += entry[lbl] ?? 0;
    }
    return sum;
  };
  if (dimension === 'longevity') {
    return [v(['very weak', 'weak']), v(['moderate']), v(['long lasting']), v(['eternal'])];
  }
  return [v(['intimate']), v(['moderate']), v(['strong']), v(['enormous'])];
}

/**
 * Score moyen fusionné sur 4 crans.
 * cranksUser = comptes de votes utilisateurs par cran [c1, c2, c3, c4].
 * null si aucun vote des deux côtés.
 */
export function perfScore(
  cranksFrag: [number, number, number, number],
  cranksUser: [number, number, number, number],
  cap: number = PERF_CAP,
): number | null {
  const fragTotal = cranksFrag[0] + cranksFrag[1] + cranksFrag[2] + cranksFrag[3];
  const userTotal = cranksUser[0] + cranksUser[1] + cranksUser[2] + cranksUser[3];
  if (fragTotal + userTotal === 0) return null;
  const poids = fragTotal === 0 ? 0 : Math.min(cap, fragTotal) / fragTotal;
  let num = 0;
  let den = 0;
  for (let i = 0; i < 4; i++) {
    const contrib = cranksFrag[i] * poids + cranksUser[i];
    num += (i + 1) * contrib;
    den += contrib;
  }
  return num / den;
}

/** Score fusionné → cran affiché (1-4), arrondi borné. */
export function perfLevel(score: number | null): number | null {
  if (score === null) return null;
  return Math.max(1, Math.min(4, Math.round(score)));
}

const LONG_LABELS: Record<number, string> = { 1: 'Courte', 2: 'Modérée', 3: 'Longue', 4: 'Très longue' };
const SILL_LABELS: Record<number, string> = { 1: 'Intime', 2: 'Modéré', 3: 'Présent', 4: 'Puissant' };

/** Libellé FR d'un cran (mêmes seuils que l'app). */
export function perfLabel(dimension: PerfDimensionKey, level: number | null): string | null {
  if (level === null) return null;
  return dimension === 'longevity' ? (LONG_LABELS[level] ?? null) : (SILL_LABELS[level] ?? null);
}

/** Équivalent Fragrantica retenu après borne (pour transparence « X votes »). */
export function perfFragEquiv(cranksFrag: [number, number, number, number], cap: number = PERF_CAP): number {
  const total = cranksFrag[0] + cranksFrag[1] + cranksFrag[2] + cranksFrag[3];
  if (total === 0) return 0;
  return total * (Math.min(cap, total) / total);
}
