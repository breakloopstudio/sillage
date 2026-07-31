import {
  longevityBucket,
  sillageBucket,
  countActiveFilters,
  hasActiveFilters,
  EMPTY_FAVORI_FILTERS,
  type FavoritesFilters,
} from '../../src/utils/favori-filters';

describe('longevityBucket', () => {
  it('maps known strings to buckets', () => {
    expect(longevityBucket('Eternal')).toBe('eternal');
    expect(longevityBucket('very long lasting')).toBe('eternal');
    expect(longevityBucket('Long Lasting')).toBe('long');
    expect(longevityBucket('Moderate')).toBe('moderate');
    expect(longevityBucket('Weak')).toBe('weak');
  });

  it('returns null for unknown or empty', () => {
    expect(longevityBucket(null)).toBeNull();
    expect(longevityBucket(undefined)).toBeNull();
    expect(longevityBucket('')).toBeNull();
    expect(longevityBucket('unknown value')).toBeNull();
  });
});

describe('sillageBucket', () => {
  it('maps known strings to buckets', () => {
    expect(sillageBucket('Enormous')).toBe('enormous');
    expect(sillageBucket('Strong')).toBe('strong');
    expect(sillageBucket('Heavy')).toBe('strong');
    expect(sillageBucket('Moderate')).toBe('moderate');
    expect(sillageBucket('Intimate')).toBe('intimate');
    expect(sillageBucket('Soft')).toBe('intimate');
  });

  it('returns null for unknown or empty', () => {
    expect(sillageBucket(null)).toBeNull();
    expect(sillageBucket('')).toBeNull();
    expect(sillageBucket('xyz')).toBeNull();
  });
});

describe('countActiveFilters / hasActiveFilters', () => {
  it('counts 0 for empty filters', () => {
    expect(countActiveFilters(EMPTY_FAVORI_FILTERS)).toBe(0);
    expect(hasActiveFilters(EMPTY_FAVORI_FILTERS)).toBe(false);
  });

  it('counts each active facet', () => {
    const f: FavoritesFilters = {
      families: ['boisee', 'florale'],
      seasons: ['winter'],
      longevity: ['long'],
      sillage: [],
    };
    expect(countActiveFilters(f)).toBe(4);
    expect(hasActiveFilters(f)).toBe(true);
  });
});
