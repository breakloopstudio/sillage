import { getDailyChallenge } from '../../src/features/runner/runner-daily';

describe('getDailyChallenge', () => {
  it('is deterministic for a given date', () => {
    const d = new Date(2026, 7, 1);
    const a = getDailyChallenge(d);
    const b = getDailyChallenge(d);
    expect(a.id).toBe(b.id);
    expect(a.label).toBe(b.label);
  });

  it('varies across dates', () => {
    const ids = new Set<string>();
    for (let day = 1; day <= 30; day++) {
      ids.add(getDailyChallenge(new Date(2026, 7, day)).id);
    }
    expect(ids.size).toBeGreaterThan(1);
  });

  it('always yields a non-empty label and icon', () => {
    const ch = getDailyChallenge(new Date(2026, 0, 15));
    expect(ch.label.length).toBeGreaterThan(0);
    expect(ch.icon.length).toBeGreaterThan(0);
  });

  it('check fails at zero and passes at huge values', () => {
    const ch = getDailyChallenge(new Date(2026, 0, 15));
    const zero = { score: 0, distance: 0, maxCombo: 0, nearMiss: 0, shieldBreaks: 0, notesCollected: 0 };
    const huge = { score: 999999, distance: 999999, maxCombo: 999, nearMiss: 999, shieldBreaks: 999, notesCollected: 999 };
    expect(ch.check(zero)).toBe(false);
    expect(ch.check(huge)).toBe(true);
  });
});
