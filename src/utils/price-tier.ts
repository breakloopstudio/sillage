export type PriceTier = 'deal' | 'fair' | 'overpriced' | null;

export function priceTier(bestPrice: number | null | undefined, referencePrice: number | null | undefined): PriceTier {
  if (typeof bestPrice !== 'number' || bestPrice <= 0) return null;
  if (typeof referencePrice !== 'number' || referencePrice <= 0) return null;
  const ratio = bestPrice / referencePrice;
  if (ratio < 0.8) return 'deal';
  if (ratio < 1.05) return 'fair';
  return 'overpriced';
}
