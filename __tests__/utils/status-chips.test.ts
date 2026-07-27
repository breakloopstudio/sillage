import { STATUS_CHIPS, chipForStatus, statusChipMeta } from '../../src/utils/status-chips';
import { VERDICT_OPTIONS, verdictLabel } from '../../src/utils/verdicts';

describe('chipForStatus', () => {
  it('maps have/had to their own chips', () => {
    expect(chipForStatus('have')).toBe('have');
    expect(chipForStatus('had')).toBe('had');
  });

  it('folds to_try/want/tried into to_try', () => {
    expect(chipForStatus('to_try')).toBe('to_try');
    expect(chipForStatus('want')).toBe('to_try');
    expect(chipForStatus('tried')).toBe('to_try');
  });

  it('returns null for null/undefined', () => {
    expect(chipForStatus(null)).toBeNull();
    expect(chipForStatus(undefined)).toBeNull();
  });
});

describe('statusChipMeta', () => {
  it('returns the chip for a status', () => {
    expect(statusChipMeta('have')?.id).toBe('have');
    expect(statusChipMeta('had')?.label).toBe('Fini');
    expect(statusChipMeta('to_try')?.id).toBe('to_try');
  });

  it('returns null for null status', () => {
    expect(statusChipMeta(null)).toBeNull();
  });

  it('exposes exactly 3 chips', () => {
    expect(STATUS_CHIPS).toHaveLength(3);
    expect(STATUS_CHIPS.map(c => c.id)).toEqual(['to_try', 'have', 'had']);
  });
});

describe('verdictLabel', () => {
  it('returns labels for verdicts', () => {
    expect(verdictLabel('dislike')).toBe('Pas pour moi');
    expect(verdictLabel('love')).toContain('Coup de');
    expect(verdictLabel('like')).toBeTruthy();
    expect(verdictLabel('meh')).toBeTruthy();
  });

  it('returns null for null/undefined', () => {
    expect(verdictLabel(null)).toBeNull();
    expect(verdictLabel(undefined)).toBeNull();
  });

  it('exposes the 4 verdicts in order', () => {
    expect(VERDICT_OPTIONS.map(o => o.key)).toEqual(['love', 'like', 'meh', 'dislike']);
  });
});
