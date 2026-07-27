import { suggestTargetPrice, alertVariation, formatVariation } from '../../src/utils/price-alerts';

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
  it('formats a drop with a typographic minus', () => {
    expect(formatVariation(-0.18)).toBe('\u221218\u00A0%');
  });

  it('formats a rise with a plus sign', () => {
    expect(formatVariation(0.05)).toBe('+5\u00A0%');
  });

  it('formats zero without a sign', () => {
    expect(formatVariation(0)).toBe('0\u00A0%');
  });
});
