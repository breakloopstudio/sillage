import { getWmoMeta, mapTempToSeason, WMO_META } from '../../src/utils/weather-codes';

describe('getWmoMeta', () => {
  it('returns metadata for known codes', () => {
    expect(getWmoMeta(0).label).toBe('Ensoleillé');
    expect(getWmoMeta(71).icon).toBe('snow');
    expect(getWmoMeta(95).label).toBe('Orage');
  });

  it('falls back to code 1 for unknown codes', () => {
    const fallback = getWmoMeta(999);
    expect(fallback).toEqual(WMO_META[1]);
  });
});

describe('mapTempToSeason', () => {
  it('maps temperature ranges to seasons', () => {
    expect(mapTempToSeason(35)).toBe('summer');
    expect(mapTempToSeason(29)).toBe('summer');
    expect(mapTempToSeason(25)).toBe('spring');
    expect(mapTempToSeason(20)).toBe('spring');
    expect(mapTempToSeason(15)).toBe('fall');
    expect(mapTempToSeason(10)).toBe('fall');
    expect(mapTempToSeason(5)).toBe('winter');
    expect(mapTempToSeason(-10)).toBe('winter');
  });

  it('handles boundary values', () => {
    expect(mapTempToSeason(28)).toBe('spring');
    expect(mapTempToSeason(19.9)).toBe('fall');
    expect(mapTempToSeason(9.9)).toBe('winter');
  });
});
