// __tests__/functions/price-alert-helpers.test.ts
// Logique de déclenchement des alertes prix (Edge Function check-price-alerts).
// Fonctions pures importées depuis supabase/functions/_shared/helpers.ts.

import { evaluatePriceDrop, targetReached, toNum } from '../../supabase/functions/_shared/helpers';

describe('evaluatePriceDrop', () => {
  it('triggers at exactly 10%', () => {
    const r = evaluatePriceDrop(100, 90);
    expect(r.triggered).toBe(true);
    expect(r.dropPct).toBeCloseTo(0.10);
  });

  it('triggers on absolute drop ≥ 5€ even under 10%', () => {
    // 100 → 95 = 5% mais 5€ ≥ 5€
    expect(evaluatePriceDrop(100, 95).triggered).toBe(true);
  });

  it('does not trigger under both thresholds', () => {
    // 100 → 96 = 4% et 4€ < 5€
    expect(evaluatePriceDrop(100, 96).triggered).toBe(false);
  });

  it('guards null/zero prices', () => {
    expect(evaluatePriceDrop(null, 90).triggered).toBe(false);
    expect(evaluatePriceDrop(100, null).triggered).toBe(false);
    expect(evaluatePriceDrop(0, 90).triggered).toBe(false);
    expect(evaluatePriceDrop(100, 0).triggered).toBe(false);
  });
});

describe('targetReached', () => {
  it('triggers when current ≤ target', () => {
    expect(targetReached(50, 50)).toBe(true);
    expect(targetReached(50, 49)).toBe(true);
  });

  it('does not trigger when current > target', () => {
    expect(targetReached(50, 51)).toBe(false);
  });

  it('guards null/zero', () => {
    expect(targetReached(null, 50)).toBe(false);
    expect(targetReached(50, null)).toBe(false);
    expect(targetReached(0, 50)).toBe(false);
  });
});

describe('toNum (numeric PostgREST)', () => {
  it('coerces numeric strings and passes numbers through', () => {
    expect(toNum('89.99')).toBe(89.99);
    expect(toNum(89.99)).toBe(89.99);
    expect(toNum('70')).toBe(70);
  });

  it('returns null for invalid/empty', () => {
    expect(toNum(null)).toBeNull();
    expect(toNum(undefined)).toBeNull();
    expect(toNum('')).toBeNull();
    expect(toNum('abc')).toBeNull();
  });
});
