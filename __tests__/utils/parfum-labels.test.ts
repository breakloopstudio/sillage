import { typeParfumLabel, genderLabel, genderIcons, communityRatingLabel, concentrationFromName, resolveConcentration } from '../../src/utils/parfum-labels';
import type { Parfum } from '../../src/models';

const mk = (o: Partial<Parfum>): Parfum => o as Parfum;

describe('typeParfumLabel', () => {
  it('normalizes concentrations to canonical French labels', () => {
    expect(typeParfumLabel('eau de parfum')).toBe('Eau de Parfum');
    expect(typeParfumLabel('EDT')).toBe('Eau de Toilette');
    expect(typeParfumLabel('Extrait de Parfum')).toBe('Extrait');
  });

  it('fixes the bare "cologne" casing bug', () => {
    expect(typeParfumLabel('cologne')).toBe('Eau de Cologne');
    expect(typeParfumLabel('Cologne')).toBe('Eau de Cologne');
    expect(typeParfumLabel('eau de cologne')).toBe('Eau de Cologne');
  });

  it('maps the bare "perfume" / "parfum" concentration', () => {
    expect(typeParfumLabel('perfume')).toBe('Parfum');
    expect(typeParfumLabel('Perfume')).toBe('Parfum');
    expect(typeParfumLabel('parfum')).toBe('Parfum');
  });

  it('capitalizes unknown values instead of leaking raw lowercase', () => {
    expect(typeParfumLabel('mist')).toBe('Mist');
  });

  it('returns null for empty input', () => {
    expect(typeParfumLabel(null)).toBeNull();
    expect(typeParfumLabel(undefined)).toBeNull();
    expect(typeParfumLabel('   ')).toBeNull();
  });
});

describe('genderLabel', () => {
  it('maps known genders to French labels', () => {
    expect(genderLabel('men')).toBe('Homme');
    expect(genderLabel('Women')).toBe('Femme');
    expect(genderLabel('unisex')).toBe('Mixte');
  });

  it('returns null for unknown or empty values (defensive)', () => {
    expect(genderLabel('unknown')).toBeNull();
    expect(genderLabel(null)).toBeNull();
    expect(genderLabel('')).toBeNull();
  });
});

describe('genderIcons', () => {
  it('maps genders to icon glyph(s)', () => {
    expect(genderIcons('men')).toEqual(['male-outline']);
    expect(genderIcons('Women')).toEqual(['female-outline']);
    expect(genderIcons('unisex')).toEqual(['male-outline', 'female-outline']);
  });

  it('returns an empty array for unknown or empty values', () => {
    expect(genderIcons('unknown')).toEqual([]);
    expect(genderIcons(null)).toEqual([]);
    expect(genderIcons('')).toEqual([]);
  });
});

describe('communityRatingLabel', () => {
  it('formats ratingScore with one French decimal', () => {
    expect(communityRatingLabel(mk({ ratingScore: 4.32 }))).toBe('4,3');
  });

  it('falls back to the rating string', () => {
    expect(communityRatingLabel(mk({ rating: '3.8' }))).toBe('3,8');
  });

  it('prefers ratingScore over rating', () => {
    expect(communityRatingLabel(mk({ ratingScore: 4, rating: '2' }))).toBe('4,0');
  });

  it('skips NaN ratingScore and falls back', () => {
    expect(communityRatingLabel(mk({ ratingScore: NaN, rating: '4.5' }))).toBe('4,5');
  });

  it('returns null without any rating', () => {
    expect(communityRatingLabel(mk({}))).toBeNull();
    expect(communityRatingLabel(null)).toBeNull();
  });
});

describe('concentrationFromName', () => {
  it('reads the concentration from the official name suffix', () => {
    expect(concentrationFromName('The Most Wanted Parfum')).toBe('Parfum');
    expect(concentrationFromName('Black Opium Eau de Parfum')).toBe('Eau de Parfum');
    expect(concentrationFromName('Acqua di Gio Eau de Toilette')).toBe('Eau de Toilette');
    expect(concentrationFromName('4711 Eau de Cologne')).toBe('Eau de Cologne');
  });

  it('returns null when the name carries no concentration', () => {
    expect(concentrationFromName('Viking')).toBeNull();
  });

  it('protects a name that IS the concentration word (e.g. Mugler Cologne)', () => {
    expect(concentrationFromName('Cologne')).toBeNull();
  });

  it('requires a word boundary before the suffix', () => {
    expect(concentrationFromName('Nparfum')).toBeNull();
  });

  it('returns null for empty input', () => {
    expect(concentrationFromName(null)).toBeNull();
    expect(concentrationFromName('')).toBeNull();
  });
});

describe('resolveConcentration', () => {
  it('trusts the name over a noisy scraped typeParfum', () => {
    expect(resolveConcentration(mk({ nom: 'The Most Wanted Parfum', typeParfum: 'cologne' }))).toBe('Parfum');
  });

  it('ignores the SEO-generic typeParfum when the name has no concentration', () => {
    expect(resolveConcentration(mk({ nom: 'Viking', typeParfum: 'cologne' }))).toBeNull();
  });
});
