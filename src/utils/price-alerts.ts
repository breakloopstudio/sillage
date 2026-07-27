// src/utils/price-alerts.ts — Helpers purs pour les alertes prix
// Suggestion du prix cible + calcul de variation depuis l'activation.

function round5(v: number): number {
  return Math.max(5, Math.round(v / 5) * 5);
}

/**
 * Suggère un prix cible pré-rempli pour l'utilisateur.
 * - Prix proche de l'officiel (≥ 90%) → vise un « bon prix » (~25% sous l'officiel).
 * - Déjà en promo → grappille ~10% sous le meilleur prix actuel.
 * Arrondi au palier de 5 € (minimum 5 €). null si pas de prix exploitable.
 */
export function suggestTargetPrice(bestPrice?: number | null, referencePrice?: number | null): number | null {
  if (typeof bestPrice !== 'number' || bestPrice <= 0) return null;
  const ref = typeof referencePrice === 'number' && referencePrice > 0 ? referencePrice : null;
  if (ref !== null && bestPrice >= ref * 0.9) return round5(ref * 0.75);
  return round5(bestPrice * 0.9);
}

/**
 * Variation du prix courant vs prix à l'activation.
 * Négatif = baisse (« −18% »), positif = hausse. null si données manquantes.
 */
export function alertVariation(initialPrice: number | null, currentPrice: number | null): number | null {
  if (initialPrice == null || currentPrice == null || initialPrice <= 0) return null;
  return (currentPrice - initialPrice) / initialPrice;
}

/** Formate une variation en pourcentage signé (« −18 % », « +5 % »). */
export function formatVariation(variation: number): string {
  const pct = Math.round(variation * 100);
  const sign = pct > 0 ? '+' : pct < 0 ? '\u2212' : '';
  return `${sign}${Math.abs(pct)}\u00A0%`;
}
