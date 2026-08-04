// src/utils/format-price.ts — Formatage monétaire / numérique locale-aware.
// La locale suit la langue active i18next — jamais de locale hardcodée.
// (i18next non initialisé → langue source 'fr', ex. scripts Node.)

import i18next from 'i18next';

function activeLocale(): string {
  return i18next.isInitialized ? i18next.language : 'fr';
}

const cache = new Map<string, Intl.NumberFormat>();

function formatter(key: string, make: () => Intl.NumberFormat): Intl.NumberFormat {
  let fmt = cache.get(key);
  if (!fmt) {
    fmt = make();
    cache.set(key, fmt);
  }
  return fmt;
}

export function formatPrice(value: number, opts?: { decimals?: number }): string {
  if (!Number.isFinite(value)) return '— €';
  const decimals = opts?.decimals ?? 2;
  const lng = activeLocale();
  const fmt = formatter(`price:${lng}:${decimals}`, () => new Intl.NumberFormat(lng, {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }));
  return fmt.format(value);
}

/** Nombre groupé selon la locale (« 1 299 » en FR, « 1,299 » en EN). */
export function formatNumber(value: number): string {
  const lng = activeLocale();
  const fmt = formatter(`num:${lng}`, () => new Intl.NumberFormat(lng));
  return fmt.format(value);
}

/** Décimales fixes selon la locale (notes communauté « 4,4 »). */
export function formatDecimal(value: number, digits = 1): string {
  const lng = activeLocale();
  const fmt = formatter(`dec:${lng}:${digits}`, () => new Intl.NumberFormat(lng, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }));
  return fmt.format(value);
}

/**
 * Remise signée (« −23 % » en FR, « -23% » en EN) — conventions par locale via ICU.
 * Contrat : `pct` est un pourcentage POSITIF (23 = réduction de 23 %) ; le signe
 * moins est forcé. Pour une variation signée libre, voir formatVariationPct.
 */
export function formatDiscount(pct: number): string {
  const lng = activeLocale();
  const fmt = formatter(`disc:${lng}`, () => new Intl.NumberFormat(lng, {
    style: 'percent',
    signDisplay: 'always',
    maximumFractionDigits: 0,
  }));
  return fmt.format(-Math.abs(pct) / 100);
}

/** Variation signée (« −18 % », « +5 % », « 0 % ») — conventions par locale via ICU. */
export function formatVariationPct(variationRatio: number): string {
  const lng = activeLocale();
  const fmt = formatter(`var:${lng}`, () => new Intl.NumberFormat(lng, {
    style: 'percent',
    signDisplay: 'exceptZero',
    maximumFractionDigits: 0,
  }));
  return fmt.format(variationRatio);
}
