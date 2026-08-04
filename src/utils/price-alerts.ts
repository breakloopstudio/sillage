// src/utils/price-alerts.ts — Helpers purs pour les alertes prix
// Suggestion du prix cible + calcul de variation depuis l'activation.

import { formatVariationPct } from './format-price';

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

/** Formate une variation en pourcentage signé, locale-aware (« −18 % », « +5 % »). */
export function formatVariation(variation: number): string {
  return formatVariationPct(variation);
}

export type PriceAlertState = 'reached' | 'near' | 'watching';

/**
 * Baisse absolue en € depuis l'activation (négatif = baisse, positif = hausse).
 * null si l'ancre ou le prix courant manque.
 */
export function priceAlertDropAbs(initialPrice: number | null, currentPrice: number | null): number | null {
  if (initialPrice == null || currentPrice == null) return null;
  return currentPrice - initialPrice;
}

/**
 * État d'une alerte à cible, dérivé côté client (sans colonne dédiée en base).
 * - reached : le prix courant est sous la cible (objectif atteint).
 * - near    : le prix courant frôle la cible (≤ +10 % au-dessus).
 * - watching: veille normale.
 * null si la cible ou le prix courant manque (mode « baisse » sans cible → pas d'état).
 */
export function priceAlertState(targetPrice: number | null, currentPrice: number | null): PriceAlertState | null {
  if (targetPrice == null || currentPrice == null) return null;
  if (currentPrice <= targetPrice) return 'reached';
  if (currentPrice <= targetPrice * 1.1) return 'near';
  return 'watching';
}

/**
 * Progression d'une alerte à cible entre l'ancre d'activation et la cible (0 → 1).
 * null si une donnée manque ou si la cible n'est pas sous l'ancre (span ≤ 0).
 */
export function alertProgress(
  initialPrice: number | null,
  targetPrice: number | null,
  currentPrice: number | null
): number | null {
  if (initialPrice == null || targetPrice == null || currentPrice == null) return null;
  const span = initialPrice - targetPrice;
  if (span <= 0) return null;
  return Math.min(1, Math.max(0, (initialPrice - currentPrice) / span));
}

/** Somme des baisses constatées (initial − courant) sur un lot d'alertes suivies. */
export function watchSavings(
  rows: Array<{ initialPrice: number | null; currentPrice: number | null }>
): number {
  let total = 0;
  for (const r of rows) {
    if (r.initialPrice != null && r.currentPrice != null && r.currentPrice < r.initialPrice) {
      total += r.initialPrice - r.currentPrice;
    }
  }
  return total;
}
