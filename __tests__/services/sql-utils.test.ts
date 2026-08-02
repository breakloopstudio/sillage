import { toDate, toNum, today } from '../../src/services/impl/sql-utils';

describe('toDate', () => {
  it('converts ISO string to Date', () => {
    const d = toDate('2026-07-15T10:30:00Z');
    expect(d).toBeInstanceOf(Date);
    expect(d!.toISOString()).toBe('2026-07-15T10:30:00.000Z');
  });

  it('returns undefined for null', () => {
    expect(toDate(null)).toBeUndefined();
  });

  it('returns undefined for undefined', () => {
    expect(toDate(undefined)).toBeUndefined();
  });

  it('returns undefined for a number', () => {
    expect(toDate(12345)).toBeUndefined();
  });

  it('returns undefined for an empty string', () => {
    const d = toDate('');
    expect(d).toBeInstanceOf(Date);
    expect(d!.getTime()).toBeNaN();
  });
});

describe('toNum', () => {
  it('passes through a number', () => {
    expect(toNum(42)).toBe(42);
    expect(toNum(0)).toBe(0);
    expect(toNum(-3.14)).toBe(-3.14);
  });

  it('converts a numeric string (PostgREST numeric column)', () => {
    expect(toNum('89.99')).toBe(89.99);
    expect(toNum('4.5')).toBe(4.5);
    expect(toNum('0')).toBe(0);
    expect(toNum('-12')).toBe(-12);
  });

  it('returns null for null', () => {
    expect(toNum(null)).toBeNull();
  });

  it('returns null for undefined', () => {
    expect(toNum(undefined)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(toNum('')).toBeNull();
  });

  it('returns null for non-numeric string', () => {
    expect(toNum('abc')).toBeNull();
    expect(toNum('12abc')).toBeNull();
  });

  it('passes through NaN (typeof number)', () => {
    expect(toNum(NaN)).toBeNaN();
  });

  it('returns null for boolean', () => {
    expect(toNum(true)).toBeNull();
    expect(toNum(false)).toBeNull();
  });

  it('returns null for object', () => {
    expect(toNum({})).toBeNull();
    expect(toNum([])).toBeNull();
  });
});

describe('today', () => {
  it('returns YYYY-MM-DD format', () => {
    const result = today();
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('pads single-digit month and day', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 0, 5, 14, 30));
    expect(today()).toBe('2026-01-05');
    jest.useRealTimers();
  });

  it('handles December correctly', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 11, 25));
    expect(today()).toBe('2026-12-25');
    jest.useRealTimers();
  });
});
