import { buildAccords, accordColorIndex, ACCORD_GROUPS, ribbonWidths, type AccordRow } from '../../src/utils/accord-profile';

describe('accordColorIndex', () => {
  it('maps known accords to their semantic palette slot', () => {
    expect(accordColorIndex('Vanilla')).toBe(0);
    expect(accordColorIndex('Woody')).toBe(1);
    expect(accordColorIndex('Leather')).toBe(2);
    expect(accordColorIndex('Rose')).toBe(3);
    expect(accordColorIndex('Powdery')).toBe(4);
    expect(accordColorIndex('Aromatic')).toBe(5);
    expect(accordColorIndex('Spicy')).toBe(6);
    expect(accordColorIndex('Citrus')).toBe(7);
  });

  it('falls back to a stable index for unknown accords', () => {
    const a = accordColorIndex('zzz-unknown-accord');
    const b = accordColorIndex('zzz-unknown-accord');
    expect(a).toBe(b);
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThan(ACCORD_GROUPS.length);
  });

  it('never returns the primary/action slot count out of range', () => {
    for (let i = 0; i < 200; i++) {
      const idx = accordColorIndex(`random-${i}-xyz`);
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThan(ACCORD_GROUPS.length);
    }
  });
});

describe('buildAccords', () => {
  it('derives a French qualifier from word-based percentages', () => {
    const rows = buildAccords(['Vanilla', 'Iris'], { Vanilla: 'dominant', Iris: 'moderate' });
    const vanille = rows.find(r => r.raw === 'Vanilla')!;
    const iris = rows.find(r => r.raw === 'Iris')!;
    expect(vanille.label).toBe('Dominant');
    expect(vanille.pct).toBe(95);
    expect(iris.label).toBe('Modéré');
    expect(iris.pct).toBe(50);
  });

  it('derives a qualifier from numeric percentages by threshold', () => {
    const rows = buildAccords(['Leather'], { Leather: '92%' });
    expect(rows[0].label).toBe('Dominant');
    expect(rows[0].pct).toBe(92);
  });

  it('sorts by intensity descending and caps at five', () => {
    const accords = ['A', 'B', 'C', 'D', 'E', 'F'];
    const percentages: Record<string, string> = {
      A: '10', B: '90', C: '30', D: '70', E: '50', F: '95',
    };
    const rows = buildAccords(accords, percentages);
    expect(rows).toHaveLength(5);
    expect(rows[0].raw).toBe('F');
    expect(rows[1].raw).toBe('B');
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i - 1].pct).toBeGreaterThanOrEqual(rows[i].pct);
    }
  });

  it('keeps source order with graceful bars when no percentages exist', () => {
    const rows = buildAccords(['Vanilla', 'Leather', 'Iris'], undefined);
    expect(rows.map(r => r.raw)).toEqual(['Vanilla', 'Leather', 'Iris']);
    expect(rows.every(r => r.label === null)).toBe(true);
    expect(rows[0].pct).toBeGreaterThan(rows[1].pct);
  });

  it('returns an empty array for missing accords', () => {
    expect(buildAccords(undefined, undefined)).toEqual([]);
    expect(buildAccords([], {})).toEqual([]);
  });

  it('translates the display name', () => {
    const rows = buildAccords(['Vanilla'], { Vanilla: 'dominant' });
    expect(rows[0].display).toBeTruthy();
  });
});

describe('ribbonWidths', () => {
  it('returns widths summing to 100', () => {
    const rows = buildAccords(['Vanilla', 'Iris', 'Citrus'], { Vanilla: 'dominant', Iris: 'moderate', Citrus: 'soft' });
    const widths = ribbonWidths(rows);
    expect(widths).toHaveLength(rows.length);
    const sum = widths.reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(100, 5);
  });

  it('preserves the intensity ordering', () => {
    const mk = (raw: string, pct: number): AccordRow => ({ raw, display: raw, pct, label: null, colorIndex: 0 });
    const widths = ribbonWidths([mk('B', 60), mk('C', 30), mk('A', 10)]);
    expect(widths[0]).toBeCloseTo(60, 5);
    expect(widths[1]).toBeCloseTo(30, 5);
    expect(widths[2]).toBeCloseTo(10, 5);
  });

  it('falls back to equal widths when the total is zero', () => {
    const mk = (raw: string, pct: number): AccordRow => ({ raw, display: raw, pct, label: null, colorIndex: 0 });
    expect(ribbonWidths([mk('A', 0), mk('B', 0)])).toEqual([50, 50]);
  });

  it('returns an empty array for no rows', () => {
    expect(ribbonWidths([])).toEqual([]);
  });
});

