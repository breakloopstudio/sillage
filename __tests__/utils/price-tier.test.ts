import { priceTier } from '../../src/utils/price-tier';

describe('priceTier', () => {
  it('returns deal when ratio < 0.8', () => {
    expect(priceTier(70, 100)).toBe('deal');
    expect(priceTier(79, 100)).toBe('deal');
  });

  it('returns fair when 0.8 <= ratio < 1.05', () => {
    expect(priceTier(80, 100)).toBe('fair');
    expect(priceTier(100, 100)).toBe('fair');
    expect(priceTier(104, 100)).toBe('fair');
  });

  it('returns overpriced when ratio >= 1.05', () => {
    expect(priceTier(105, 100)).toBe('overpriced');
    expect(priceTier(150, 100)).toBe('overpriced');
  });

  it('returns null for missing or non-positive inputs', () => {
    expect(priceTier(null, 100)).toBeNull();
    expect(priceTier(undefined, 100)).toBeNull();
    expect(priceTier(100, null)).toBeNull();
    expect(priceTier(0, 100)).toBeNull();
    expect(priceTier(-5, 100)).toBeNull();
    expect(priceTier(100, 0)).toBeNull();
  });

  it('returns null for NaN (defensive)', () => {
    expect(priceTier(NaN, 100)).toBeNull();
    expect(priceTier(100, NaN)).toBeNull();
  });
});
