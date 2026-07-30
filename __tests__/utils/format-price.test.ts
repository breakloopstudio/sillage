import { formatPrice } from '../../src/utils/format-price';

const SPACES = String.fromCharCode(32, 160, 8239);
const norm = (s: string): string => s.split('').map((ch) => (SPACES.includes(ch) ? ' ' : ch)).join('');

describe('formatPrice', () => {
  it('formats with 2 decimals by default (fr-FR currency)', () => {
    expect(norm(formatPrice(89.99))).toBe('89,99 €');
  });

  it('formats rounded when decimals: 0', () => {
    expect(norm(formatPrice(89.99, { decimals: 0 }))).toBe('90 €');
    expect(norm(formatPrice(1299, { decimals: 0 }))).toBe('1 299 €');
  });

  it('groups thousands', () => {
    expect(norm(formatPrice(1299.5))).toBe('1 299,50 €');
  });

  it('falls back to a dash for non-finite values', () => {
    expect(formatPrice(NaN)).toBe('— €');
    expect(formatPrice(Infinity)).toBe('— €');
    expect(formatPrice(-Infinity)).toBe('— €');
  });
});
