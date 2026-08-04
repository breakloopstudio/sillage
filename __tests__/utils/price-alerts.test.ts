import { suggestTargetPrice, alertVariation, formatVariation, priceAlertDropAbs, priceAlertState, alertProgress, watchSavings } from '../../src/utils/price-alerts';

describe('suggestTargetPrice', () => {
  it('returns null without a usable best price', () => {
    expect(suggestTargetPrice(null)).toBeNull();
    expect(suggestTargetPrice(undefined)).toBeNull();
    expect(suggestTargetPrice(0)).toBeNull();
    expect(suggestTargetPrice(-5)).toBeNull();
  });

  it('targets a good price (~25% under official) when near the reference price', () => {
    expect(suggestTargetPrice(100, 100)).toBe(75);
    expect(suggestTargetPrice(95, 100)).toBe(75);
  });

  it('shaves ~10% off the best price when already discounted', () => {
    expect(suggestTargetPrice(80, 100)).toBe(70);
    expect(suggestTargetPrice(100, 200)).toBe(90);
  });

  it('falls back to best price when no reference price', () => {
    expect(suggestTargetPrice(50, null)).toBe(45);
    expect(suggestTargetPrice(50)).toBe(45);
  });

  it('rounds to the nearest 5 euros (min 5)', () => {
    expect(suggestTargetPrice(33, null)).toBe(30);
    expect(suggestTargetPrice(6, null)).toBe(5);
  });
});

describe('alertVariation', () => {
  it('returns null on missing or zero initial price', () => {
    expect(alertVariation(null, 80)).toBeNull();
    expect(alertVariation(0, 80)).toBeNull();
    expect(alertVariation(100, null)).toBeNull();
  });

  it('computes a negative ratio for a price drop', () => {
    expect(alertVariation(100, 82)).toBeCloseTo(-0.18);
  });

  it('computes a positive ratio for a price rise', () => {
    expect(alertVariation(100, 105)).toBeCloseTo(0.05);
  });
});

describe('formatVariation', () => {
  // Locale-aware (i18n Phase 0) : pourcentage signé en français, conventions ICU.
  const pct = new Intl.NumberFormat('fr', { style: 'percent', signDisplay: 'exceptZero', maximumFractionDigits: 0 });

  it('formats a drop with the locale minus sign', () => {
    expect(formatVariation(-0.18)).toBe(pct.format(-0.18));
    expect(formatVariation(-0.18)).toContain('18');
  });

  it('formats a rise with a plus sign', () => {
    expect(formatVariation(0.05)).toBe(pct.format(0.05));
    expect(formatVariation(0.05)).toContain('+');
  });

  it('formats zero without a sign', () => {
    expect(formatVariation(0)).toBe(pct.format(0));
  });
});

describe('priceAlertDropAbs', () => {
  it('returns null when the anchor or current price is missing', () => {
    expect(priceAlertDropAbs(null, 80)).toBeNull();
    expect(priceAlertDropAbs(100, null)).toBeNull();
  });

  it('returns a negative delta on a drop', () => {
    expect(priceAlertDropAbs(100, 82)).toBe(-18);
  });

  it('returns a positive delta on a rise', () => {
    expect(priceAlertDropAbs(100, 105)).toBe(5);
  });
});

describe('priceAlertState', () => {
  it('returns null without a target or current price', () => {
    expect(priceAlertState(null, 80)).toBeNull();
    expect(priceAlertState(70, null)).toBeNull();
  });

  it('is reached when the current price is at or below the target', () => {
    expect(priceAlertState(70, 70)).toBe('reached');
    expect(priceAlertState(70, 65)).toBe('reached');
  });

  it('is near when the current price is within 10% above the target', () => {
    expect(priceAlertState(70, 77)).toBe('near');
    expect(priceAlertState(70, 71)).toBe('near');
  });

  it('is watching when the current price is well above the target', () => {
    expect(priceAlertState(70, 90)).toBe('watching');
  });
});

describe('alertProgress', () => {
  it('returns null when any input is missing', () => {
    expect(alertProgress(null, 50, 75)).toBeNull();
    expect(alertProgress(100, null, 75)).toBeNull();
    expect(alertProgress(100, 50, null)).toBeNull();
  });

  it('returns null when the target is not below the anchor (span <= 0)', () => {
    expect(alertProgress(100, 100, 90)).toBeNull();
    expect(alertProgress(100, 120, 90)).toBeNull();
  });

  it('returns 0 when the current price is at or above the anchor', () => {
    expect(alertProgress(100, 50, 100)).toBe(0);
    expect(alertProgress(100, 50, 110)).toBe(0);
  });

  it('returns 1 when the current price is at or below the target', () => {
    expect(alertProgress(100, 50, 50)).toBe(1);
    expect(alertProgress(100, 50, 40)).toBe(1);
  });

  it('returns 0.5 at the midpoint', () => {
    expect(alertProgress(100, 50, 75)).toBe(0.5);
  });

  it('clamps above 1 and below 0', () => {
    expect(alertProgress(100, 50, 20)).toBe(1);
    expect(alertProgress(100, 50, 200)).toBe(0);
  });
});

describe('watchSavings', () => {
  it('returns 0 for an empty list or missing prices', () => {
    expect(watchSavings([])).toBe(0);
    expect(watchSavings([{ initialPrice: null, currentPrice: 80 }])).toBe(0);
    expect(watchSavings([{ initialPrice: 100, currentPrice: null }])).toBe(0);
  });

  it('sums only the drops', () => {
    expect(watchSavings([
      { initialPrice: 100, currentPrice: 80 },
      { initialPrice: 50, currentPrice: 55 },
    ])).toBe(20);
  });
});
