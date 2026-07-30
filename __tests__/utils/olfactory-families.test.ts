import { OLFACTORY_FAMILIES, getFamilyByKey, getFamilyByValue } from '../../src/utils/olfactory-families';

describe('olfactory-families', () => {
  it('defines the six FR families', () => {
    expect(OLFACTORY_FAMILIES.map((f) => f.key)).toEqual([
      'boisee', 'florale', 'hesperidee', 'ambree', 'gourmande', 'aromatique',
    ]);
  });

  it('assigns each English value to exactly one family (no duplicates)', () => {
    const all = OLFACTORY_FAMILIES.flatMap((f) => f.values);
    expect(new Set(all).size).toBe(all.length);
  });

  it('looks up a family by key', () => {
    expect(getFamilyByKey('boisee')?.label).toBe('Boisée');
    expect(getFamilyByKey(null)).toBeUndefined();
    expect(getFamilyByKey('unknown')).toBeUndefined();
  });

  it('looks up a family by English value (case/space tolerant)', () => {
    expect(getFamilyByValue('woody')?.key).toBe('boisee');
    expect(getFamilyByValue('White Floral')?.key).toBe('florale');
    expect(getFamilyByValue('  citrus  ')?.key).toBe('hesperidee');
    expect(getFamilyByValue(undefined)).toBeUndefined();
    expect(getFamilyByValue('pizza')).toBeUndefined();
  });
});
