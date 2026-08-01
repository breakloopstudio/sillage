import { parseTitle, parfumIdFromTitle, concentrationFromName } from '../../scripts/lib/title';

describe('scripts/lib/title — concentrationFromName', () => {
  it('reads the concentration from the official name suffix', () => {
    expect(concentrationFromName('The Most Wanted Parfum')).toBe('Parfum');
    expect(concentrationFromName('Black Opium Eau de Parfum')).toBe('Eau de Parfum');
  });

  it('returns null when the name carries no concentration', () => {
    expect(concentrationFromName('Viking')).toBeNull();
  });

  it('protects a name that IS the concentration word', () => {
    expect(concentrationFromName('Cologne')).toBeNull();
  });
});

describe('scripts/lib/title — parseTitle', () => {
  it('derives the concentration from the name, not the SEO title', () => {
    const r = parseTitle('The Most Wanted Parfum Azzaro - a fragrance for men 2022', 'Azzaro');
    expect(r.nom).toBe('The Most Wanted Parfum');
    expect(r.typeParfum).toBe('Parfum');
    expect(r.annee).toBe(2022);
    expect(r.genderLabel).toBe('male');
  });

  it('leaves typeParfum undefined when the name has no concentration', () => {
    const r = parseTitle('Viking Creed - a fragrance for men 2017', 'Creed');
    expect(r.nom).toBe('Viking');
    expect(r.typeParfum).toBeUndefined();
  });

  it('ignores a noisy SEO concentration trailing the brand', () => {
    const r = parseTitle('The Most Wanted Parfum Azzaro cologne - a fragrance for men', 'Azzaro');
    expect(r.nom).toBe('The Most Wanted Parfum');
    expect(r.typeParfum).toBe('Parfum');
  });
});

describe('scripts/lib/title — parfumIdFromTitle (id stability)', () => {
  it('produces the same id whether or not the SEO title carries a noisy concentration', () => {
    const noisy = parfumIdFromTitle('The Most Wanted Parfum Azzaro cologne - a fragrance for men', 'Azzaro');
    const clean = parfumIdFromTitle('The Most Wanted Parfum Azzaro - a fragrance for men', 'Azzaro');
    expect(noisy).toBe(clean);
  });

  it('produces the same id for a name without concentration', () => {
    const noisy = parfumIdFromTitle('Viking Creed perfume - a fragrance for men', 'Creed');
    const clean = parfumIdFromTitle('Viking Creed - a fragrance for men', 'Creed');
    expect(noisy).toBe(clean);
  });
});
