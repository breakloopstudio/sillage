import {
  buildSeasonProfile,
  dayNightLabel,
  rankAndDedupe,
  SEASON_PHRASES,
} from '../../src/utils/season-profile';

describe('dayNightLabel', () => {
  it('returns null when there are no day/night votes', () => {
    expect(dayNightLabel(0, 0)).toBeNull();
  });

  it('returns null when day and night are too close', () => {
    expect(dayNightLabel(50, 50)).toBeNull();
    expect(dayNightLabel(50, 40)).toBeNull();
  });

  it('picks the dominant moment past the threshold', () => {
    expect(dayNightLabel(50, 30)).toBe('day');
    expect(dayNightLabel(10, 60)).toBe('night');
  });
});

describe('rankAndDedupe', () => {
  it('merges EN keys that share a FR label, keeping the max score', () => {
    const r = rankAndDedupe([
      { name: 'evening', score: 5 },
      { name: 'night', score: 9 },
    ]);
    expect(r).toHaveLength(1);
    expect(r[0].label).toBe('Soirée');
    expect(r[0].score).toBe(9);
  });

  it('sorts by score descending and ignores unknown keys', () => {
    const r = rankAndDedupe([
      { name: 'party', score: 3 },
      { name: 'xyz-unknown', score: 99 },
      { name: 'work', score: 7 },
    ]);
    expect(r.map(x => x.label)).toEqual(['Bureau', 'Fête']);
  });

  it('handles null/undefined', () => {
    expect(rankAndDedupe(null)).toEqual([]);
    expect(rankAndDedupe(undefined)).toEqual([]);
  });
});

describe('buildSeasonProfile', () => {
  it('returns null when there is nothing to show', () => {
    expect(buildSeasonProfile(null)).toBeNull();
    expect(buildSeasonProfile({})).toBeNull();
    expect(buildSeasonProfile({ seasonRanking: [], occasionRanking: [] })).toBeNull();
  });

  it('builds columns in season order with ratio + top, and extracts day/night', () => {
    const p = buildSeasonProfile({
      seasonRanking: [
        { name: 'summer', score: 100 },
        { name: 'winter', score: 40 },
        { name: 'autumn', score: 0 },
        { name: 'night', score: 80 },
        { name: 'day', score: 20 },
      ],
      occasionRanking: [{ name: 'evening', score: 6 }],
    });
    expect(p).not.toBeNull();
    expect(p!.seasonMax).toBe(100);
    expect(p!.topSeasonKey).toBe('summer');
    expect(p!.columns.map(c => c.key)).toEqual(['spring', 'summer', 'fall', 'winter']);
    const summer = p!.columns.find(c => c.key === 'summer')!;
    expect(summer.ratio).toBe(1);
    expect(summer.isTop).toBe(true);
    expect(p!.columns.find(c => c.key === 'fall')!.ratio).toBe(0);
    expect(p!.dayNight).toBe('night');
    expect(p!.topOccasions[0].label).toBe('Soirée');
  });

  it('shows occasions even when there is no season data', () => {
    const p = buildSeasonProfile({ occasionRanking: [{ name: 'work', score: 4 }] });
    expect(p).not.toBeNull();
    expect(p!.seasonMax).toBe(0);
    expect(p!.topSeasonKey).toBeNull();
    expect(p!.topOccasions).toHaveLength(1);
  });
});

describe('season editorial copy', () => {
  it('provides a phrase for every season', () => {
    for (const k of ['spring', 'summer', 'fall', 'winter'] as const) {
      expect(SEASON_PHRASES[k].trim().length).toBeGreaterThan(0);
    }
  });
});
