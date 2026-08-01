import { totalNotes, todayKey, type RunnerStats } from '../../src/features/runner/runner-stats';

const base: RunnerStats = {
  totalRuns: 0, totalDistance: 0, bestScore: 0, bestCombo: 0, bestNearMiss: 0,
  totalNearMiss: 0, totalShieldBreaks: 0, notesByType: {}, playDays: 0, lastPlayDay: '',
};

describe('totalNotes', () => {
  it('sums notes across types', () => {
    expect(totalNotes({ ...base, notesByType: { bergamote: 2, ambre: 3 } })).toBe(5);
  });

  it('returns 0 for an empty notebook', () => {
    expect(totalNotes(base)).toBe(0);
  });
});

describe('todayKey', () => {
  it('formats YYYY-MM-DD with zero padding', () => {
    expect(todayKey(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(todayKey(new Date(2026, 11, 25))).toBe('2026-12-25');
  });
});
