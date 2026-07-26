import { normalize, normalizeId } from '../../src/utils/normalize';

describe('normalize', () => {
  it('lowercases the string', () => {
    expect(normalize('JEAN PAUL')).toBe('jean_paul');
  });

  it('removes diacritics (accents)', () => {
    expect(normalize('Jean-Paul Gaultier')).toBe('jean_paul_gaultier');
    expect(normalize('Dior Homme Intense')).toBe('dior_homme_intense');
    expect(normalize('Yves Saint Laurent')).toBe('yves_saint_laurent');
  });

  it('replaces non-alphanumeric characters with underscore', () => {
    expect(normalize("L'Homme")).toBe('l_homme');
    expect(normalize('N°5')).toBe('n_5');
    expect(normalize('Eau de Parfum (EDP)')).toBe('eau_de_parfum_edp');
  });

  it('trims leading and trailing underscores', () => {
    expect(normalize('!!!Sauvage!!!')).toBe('sauvage');
  });

  it('handles empty string', () => {
    expect(normalize('')).toBe('');
  });

  it('handles string with only special chars', () => {
    expect(normalize('!!!')).toBe('');
  });
});

describe('normalizeId', () => {
  it('behaves identically to normalize', () => {
    const input = 'Jean-Paul Gaultier Le Mâle';
    expect(normalizeId(input)).toBe(normalize(input));
  });
});
