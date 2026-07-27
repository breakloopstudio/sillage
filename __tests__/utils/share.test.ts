import {
  parfumShareUrl, profileShareUrl, parfumDeepLink, profileDeepLink,
  isValidPseudo, normalizePseudo, APP_SCHEME,
} from '../../src/utils/share';

describe('share URLs', () => {
  it('builds a parfum landing URL', () => {
    const url = parfumShareUrl('dior-sauvage');
    expect(url).toContain('/functions/v1/share');
    expect(url).toContain('type=parfum&id=dior-sauvage');
  });

  it('builds a profile landing URL', () => {
    expect(profileShareUrl('john')).toContain('type=profile&pseudo=john');
  });

  it('URL-encodes parameters', () => {
    expect(parfumShareUrl('a b')).toContain('id=a%20b');
    expect(profileShareUrl('a b')).toContain('pseudo=a%20b');
  });

  it('builds deep links with the app scheme', () => {
    expect(parfumDeepLink('xyz')).toBe(`${APP_SCHEME}://catalog/xyz`);
    expect(profileDeepLink('john')).toBe(`${APP_SCHEME}://u/john`);
  });
});

describe('isValidPseudo', () => {
  it('accepts valid pseudos', () => {
    expect(isValidPseudo('john')).toBe(true);
    expect(isValidPseudo('jean_dupont')).toBe(true);
    expect(isValidPseudo('a1b')).toBe(true);
    expect(isValidPseudo('ab-cd')).toBe(true);
    expect(isValidPseudo('a'.repeat(20))).toBe(true);
  });

  it('rejects invalid pseudos', () => {
    expect(isValidPseudo('ab')).toBe(false);           // trop court
    expect(isValidPseudo('a'.repeat(21))).toBe(false); // trop long
    expect(isValidPseudo('-abc')).toBe(false);         // commence par -
    expect(isValidPseudo('abc-')).toBe(false);         // finit par -
    expect(isValidPseudo('ABC')).toBe(false);          // majuscules
    expect(isValidPseudo('a b')).toBe(false);          // espace
    expect(isValidPseudo('a@b')).toBe(false);          // caractère interdit
  });
});

describe('normalizePseudo', () => {
  it('lowercases, trims and replaces spaces with underscores', () => {
    expect(normalizePseudo('  Jean Dupont  ')).toBe('jean_dupont');
    expect(normalizePseudo('ABC')).toBe('abc');
    expect(normalizePseudo('a  b')).toBe('a_b');
  });
});
