// __tests__/utils/scan-match.test.ts — Fuzzy Levenshtein, alias marques, barème nom

import {
  levenshtein, fuzzySimilarity, canonicalBrand, fuzzyNameBonus,
  brandsRelated, brandQueryForms,
  SCORE_NOM_EXACT, SCORE_NOM_PARTIEL, FUZZY_THRESHOLD,
} from '../../src/utils/scan-match';

describe('levenshtein', () => {
  it('0 pour des chaînes identiques', () => {
    expect(levenshtein('sauvage', 'sauvage')).toBe(0);
  });

  it('distance 1 pour une substitution', () => {
    expect(levenshtein('sauvage', 'sauvagf')).toBe(1);
  });

  it('distance 2 pour deux lettres manquantes (« savag » → « sauvage »)', () => {
    expect(levenshtein('savag', 'sauvage')).toBe(2);
  });

  it("longueur de l'autre pour une chaîne vide", () => {
    expect(levenshtein('', 'abc')).toBe(3);
    expect(levenshtein('abc', '')).toBe(3);
  });

  it('cas classiques', () => {
    expect(levenshtein('kitten', 'sitting')).toBe(3);
  });
});

describe('fuzzySimilarity', () => {
  it('1 pour des chaînes identiques (même casse/accents)', () => {
    expect(fuzzySimilarity('Sauvage', 'sauvage')).toBe(1);
    expect(fuzzySimilarity('Élixir', 'elixir')).toBe(1);
  });

  it('proche de 1 pour une typo', () => {
    expect(fuzzySimilarity('sauvag', 'sauvage')).toBeGreaterThan(0.8); // 1 lettre manquante
    expect(fuzzySimilarity('savag', 'sauvage')).toBeGreaterThan(0.6); // 2 lettres manquantes
  });

  it('0 pour une chaîne vide', () => {
    expect(fuzzySimilarity('', 'sauvage')).toBe(0);
  });

  it('faible pour des chaînes sans rapport', () => {
    expect(fuzzySimilarity('sauvage', 'aventus')).toBeLessThan(0.4);
  });
});

describe('canonicalBrand', () => {
  it('alias abrégés → clé commune', () => {
    expect(canonicalBrand('YSL')).toBe('ysl');
    expect(canonicalBrand('Yves Saint Laurent')).toBe('ysl');
    expect(canonicalBrand('MFK')).toBe(canonicalBrand('Maison Francis Kurkdjian'));
    expect(canonicalBrand('JPG')).toBe(canonicalBrand('Jean Paul Gaultier'));
  });

  it('variantes de maisons → clé commune', () => {
    expect(canonicalBrand('Rabanne')).toBe(canonicalBrand('Paco Rabanne'));
    expect(canonicalBrand('Bulgari')).toBe(canonicalBrand('Bvlgari'));
    expect(canonicalBrand('Thierry Mugler')).toBe(canonicalBrand('Mugler'));
    expect(canonicalBrand('Christian Dior')).toBe(canonicalBrand('Dior'));
  });

  it('marque sans alias → valeur normalisée', () => {
    expect(canonicalBrand('Xerjoff')).toBe('xerjoff');
    expect(canonicalBrand('Creed')).toBe('creed');
  });

  it('Casamorati (sous-ligne Xerjoff) → clé dédiée', () => {
    expect(canonicalBrand('Casamorati')).toBe('casamorati_1888');
    expect(canonicalBrand('Casamorati 1888')).toBe('casamorati_1888');
  });
});

describe('brandsRelated (sous-ligne ↔ maison mère)', () => {
  it('Casamorati 1888 ↔ Xerjoff', () => {
    expect(brandsRelated('casamorati_1888', 'xerjoff')).toBe(true);
    expect(brandsRelated('xerjoff', 'casamorati_1888')).toBe(true);
  });

  it('marques sans lien → false', () => {
    expect(brandsRelated('dior', 'chanel')).toBe(false);
    expect(brandsRelated('xerjoff', 'creed')).toBe(false);
  });
});

describe('brandQueryForms', () => {
  it('Casamorati → formes de surface du catalogue', () => {
    const forms = brandQueryForms('Casamorati');
    expect(forms).toContain('Casamorati 1888');
    expect(forms).toContain('Casamorati');
  });
});

describe('fuzzyNameBonus', () => {
  it('match exact → SCORE_NOM_EXACT', () => {
    expect(fuzzyNameBonus('Sauvage', 'Sauvage')).toBe(SCORE_NOM_EXACT);
    expect(fuzzyNameBonus("J'Adore", 'j adore')).toBe(SCORE_NOM_EXACT);
  });

  it('inclusion → SCORE_NOM_PARTIEL (flankers)', () => {
    expect(fuzzyNameBonus('Sauvage Elixir', 'Sauvage')).toBe(SCORE_NOM_PARTIEL);
    expect(fuzzyNameBonus('Sauvage', 'Sauvage Elixir')).toBe(SCORE_NOM_PARTIEL);
  });

  it('flanker « nom (année) » : l année est ignorée (exact)', () => {
    // « Ombre Leather » prononcé doit matcher « Ombré Leather (2018) » au score exact.
    expect(fuzzyNameBonus('Ombré Leather (2018)', 'Ombre Leather')).toBe(SCORE_NOM_EXACT);
    expect(fuzzyNameBonus('Dior Homme Intense (2011)', 'Dior Homme Intense')).toBe(SCORE_NOM_EXACT);
  });

  it('année nue (sans parenthèses) reste discriminante → inclusion seulement', () => {
    // « Dior Homme Intense 2011 » (année nue au catalogue) vs « Dior Homme Intense » :
    // l'année nue est discriminante (750 noms du catalogue finissent par une année
    // nue) → pas d'exact, mais inclusion (flanker) quand même.
    expect(fuzzyNameBonus('Dior Homme Intense 2011', 'Dior Homme Intense')).toBe(SCORE_NOM_PARTIEL);
    // Noms avec chiffres non-année ne sont pas affectés.
    expect(fuzzyNameBonus('1 Million', '1 Million')).toBe(SCORE_NOM_EXACT);
    expect(fuzzyNameBonus('Chanel No 5', 'Chanel No 5')).toBe(SCORE_NOM_EXACT);
  });

  it('typo → bonus fuzzy dégradé (ni 0 ni exact)', () => {
    const bonus = fuzzyNameBonus('Sauvage', 'Savag');
    expect(bonus).toBeGreaterThan(0);
    expect(bonus).toBeLessThan(SCORE_NOM_EXACT);
  });

  it('sous le seuil → 0', () => {
    expect(fuzzyNameBonus('Sauvage', 'Aventus')).toBe(0);
  });

  it('chaîne vide → 0', () => {
    expect(fuzzyNameBonus('', 'Sauvage')).toBe(0);
    expect(fuzzyNameBonus('Sauvage', '')).toBe(0);
  });

  it('le seuil FUZZY_THRESHOLD est cohérent avec une typo de 2 lettres', () => {
    // « Sauvage » lu « Sauvge » (1 lettre) passe ; un mot à moitié faux non.
    expect(fuzzySimilarity('sauvge', 'sauvage')).toBeGreaterThan(FUZZY_THRESHOLD);
    expect(fuzzySimilarity('sav', 'sauvage')).toBeLessThan(FUZZY_THRESHOLD);
  });
});
