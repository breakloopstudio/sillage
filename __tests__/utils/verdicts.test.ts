import { VERDICT_OPTIONS, verdictLabel } from '../../src/utils/verdicts';

describe('verdicts', () => {
  it('exposes the four verdicts', () => {
    expect(VERDICT_OPTIONS.map((o) => o.key)).toEqual(['love', 'like', 'meh', 'dislike']);
  });

  it('maps each verdict to its label', () => {
    expect(verdictLabel('love')).toBe('Coup de cœur');
    expect(verdictLabel('like')).toBe("J'aime");
    expect(verdictLabel('meh')).toBe('Mitigé');
    expect(verdictLabel('dislike')).toBe('Pas pour moi');
  });

  it('returns null for empty input', () => {
    expect(verdictLabel(null)).toBeNull();
    expect(verdictLabel(undefined)).toBeNull();
  });
});
