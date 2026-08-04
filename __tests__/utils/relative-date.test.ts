import { formatRelativeShort } from '../../src/utils/relative-date';

const MIN = 60000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

describe('formatRelativeShort', () => {
  it('returns null for a missing date', () => {
    expect(formatRelativeShort(null)).toBeNull();
    expect(formatRelativeShort(undefined)).toBeNull();
  });

  it('returns "à l’instant" for now', () => {
    expect(formatRelativeShort(new Date())).toBe('à l’instant');
  });

  it('returns minutes below an hour', () => {
    expect(formatRelativeShort(new Date(Date.now() - 30 * MIN))).toBe('il y a 30 min');
  });

  it('returns hours below a day', () => {
    expect(formatRelativeShort(new Date(Date.now() - 3 * HOUR))).toBe('il y a 3 h');
  });

  it('returns days below a week', () => {
    expect(formatRelativeShort(new Date(Date.now() - 2 * DAY))).toBe('il y a 2 j');
  });

  it('falls back to an absolute short date after 7 days', () => {
    const date = new Date(Date.now() - 10 * DAY);
    const result = formatRelativeShort(date);
    expect(result).not.toContain('il y a');
    expect(result).toBe(
      new Intl.DateTimeFormat('fr', { day: 'numeric', month: 'short', year: 'numeric' }).format(date)
    );
  });
});
