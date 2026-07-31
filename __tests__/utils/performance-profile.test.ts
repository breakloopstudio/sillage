import {
  longevityLevel,
  sillageLevel,
  buildPerformance,
} from '../../src/utils/performance-profile';

describe('longevityLevel', () => {
  it('maps the five Fragrantica levels onto four cranks without skipping crank 3', () => {
    expect(longevityLevel('very weak')).toBe(1);
    expect(longevityLevel('weak')).toBe(1);
    expect(longevityLevel('moderate')).toBe(2);
    expect(longevityLevel('long lasting')).toBe(3);
    expect(longevityLevel('eternal')).toBe(4);
    expect(longevityLevel('very long lasting')).toBe(4);
  });

  it('returns 0 for missing input', () => {
    expect(longevityLevel(null)).toBe(0);
    expect(longevityLevel(undefined)).toBe(0);
  });
});

describe('sillageLevel', () => {
  it('maps the four Fragrantica levels onto four cranks without skipping crank 3', () => {
    expect(sillageLevel('intimate')).toBe(1);
    expect(sillageLevel('moderate')).toBe(2);
    expect(sillageLevel('strong')).toBe(3);
    expect(sillageLevel('enormous')).toBe(4);
  });

  it('treats legacy "heavy" as crank 3', () => {
    expect(sillageLevel('heavy')).toBe(3);
  });

  it('returns 0 for missing input', () => {
    expect(sillageLevel(null)).toBe(0);
  });
});


describe('buildPerformance', () => {
  it('builds both dimensions with ticks, value label and emanation', () => {
    const p = buildPerformance('long lasting', 'moderate');
    expect(p.longevity).not.toBeNull();
    expect(p.sillage).not.toBeNull();
    expect(p.longevity!.level).toBe(3);
    expect(p.longevity!.ticks).toHaveLength(4);
    expect(p.longevity!.valueLabel).toBe('Longue');
    expect(p.sillage!.level).toBe(2);
    expect(p.sillage!.valueLabel).toBe('Modéré');
    expect(p.longevity!.emanation.length).toBeGreaterThan(0);
  });

  it('returns null dimension when input missing', () => {
    const p = buildPerformance('long lasting', null);
    expect(p.longevity).not.toBeNull();
    expect(p.sillage).toBeNull();
  });

  it('returns null when both dimensions are missing', () => {
    const p = buildPerformance(null, undefined);
    expect(p.longevity).toBeNull();
    expect(p.sillage).toBeNull();
  });
});
