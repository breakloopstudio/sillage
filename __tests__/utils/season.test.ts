import { currentSeason, normalizeSeasonKey, seasonScoresFromRanking, SEASON_META } from '../../src/utils/season';

describe('currentSeason', () => {
  it('maps winter months (Dec, Jan, Feb)', () => {
    expect(currentSeason(new Date(2026, 0, 15))).toBe('winter');
    expect(currentSeason(new Date(2026, 1, 15))).toBe('winter');
    expect(currentSeason(new Date(2026, 11, 15))).toBe('winter');
  });

  it('maps spring months (Mar, Apr, May)', () => {
    expect(currentSeason(new Date(2026, 2, 1))).toBe('spring');
    expect(currentSeason(new Date(2026, 3, 15))).toBe('spring');
    expect(currentSeason(new Date(2026, 4, 31))).toBe('spring');
  });

  it('maps summer months (Jun, Jul, Aug)', () => {
    expect(currentSeason(new Date(2026, 5, 1))).toBe('summer');
    expect(currentSeason(new Date(2026, 6, 26))).toBe('summer');
    expect(currentSeason(new Date(2026, 7, 31))).toBe('summer');
  });

  it('maps fall months (Sep, Oct, Nov)', () => {
    expect(currentSeason(new Date(2026, 8, 1))).toBe('fall');
    expect(currentSeason(new Date(2026, 9, 15))).toBe('fall');
    expect(currentSeason(new Date(2026, 10, 30))).toBe('fall');
  });
});

describe('SEASON_META.withArticle', () => {
  it('provides grammatically correct French articles', () => {
    expect(SEASON_META.spring.withArticle).toBe('le printemps');
    expect(SEASON_META.summer.withArticle).toBe("l'été");
    expect(SEASON_META.fall.withArticle).toBe("l'automne");
    expect(SEASON_META.winter.withArticle).toBe("l'hiver");
  });
});

describe('normalizeSeasonKey', () => {
  it('maps autumn to fall', () => {
    expect(normalizeSeasonKey('autumn')).toBe('fall');
  });

  it('accepts canonical keys case-insensitively', () => {
    expect(normalizeSeasonKey('Summer')).toBe('summer');
    expect(normalizeSeasonKey('WINTER')).toBe('winter');
  });

  it('rejects non-season keys (day/night)', () => {
    expect(normalizeSeasonKey('day')).toBeNull();
    expect(normalizeSeasonKey('night')).toBeNull();
  });
});

describe('seasonScoresFromRanking', () => {
  it('extracts season scores, ignoring day/night', () => {
    const ranking = [
      { name: 'winter', score: 4330 },
      { name: 'summer', score: 329 },
      { name: 'autumn', score: 3776 },
      { name: 'day', score: 1505 },
      { name: 'night', score: 3784 },
    ];
    expect(seasonScoresFromRanking(ranking)).toEqual({
      winter: 4330,
      summer: 329,
      fall: 3776,
    });
  });

  it('returns null for empty or missing ranking', () => {
    expect(seasonScoresFromRanking(null)).toBeNull();
    expect(seasonScoresFromRanking([])).toBeNull();
  });
});
