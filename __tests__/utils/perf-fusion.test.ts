import {
  PERF_CAP,
  perfCranks,
  perfScore,
  perfLevel,
  perfLabel,
  perfFragEquiv,
  type Breakout,
} from '../../src/utils/perf-fusion';

const ALLURE_LONG_BREAKOUT: Breakout = [
  { 'very weak': 93 },
  { weak: 280 },
  { moderate: 1537 },
  { 'long lasting': 981 },
  { eternal: 175 },
];

describe('perfCranks', () => {
  it('normalise le breakout Fragrantica (5 niveaux) en 4 crans UI', () => {
    expect(perfCranks(ALLURE_LONG_BREAKOUT, 'longevity')).toEqual([373, 1537, 981, 175]);
  });

  it('normalise le breakout sillage (4 niveaux) en 4 crans', () => {
    const bo: Breakout = [{ intimate: 442 }, { moderate: 1994 }, { strong: 608 }, { enormous: 221 }];
    expect(perfCranks(bo, 'sillage')).toEqual([442, 1994, 608, 221]);
  });

  it('retourne des crans nuls quand le breakout est absent', () => {
    expect(perfCranks(null, 'longevity')).toEqual([0, 0, 0, 0]);
    expect(perfCranks(undefined, 'sillage')).toEqual([0, 0, 0, 0]);
  });
});

describe('perfScore — jour 1 = Fragrantica pur', () => {
  it('à 0 vote utilisateur, la moyenne est exactement celle de Fragrantica', () => {
    const cranks = perfCranks(ALLURE_LONG_BREAKOUT, 'longevity');
    const score = perfScore(cranks, [0, 0, 0, 0]);
    // moyenne pondérée Fragrantica sur 4 crans : (373*1 + 1537*2 + 981*3 + 175*4) / 3066
    const attendu = (373 * 1 + 1537 * 2 + 981 * 3 + 175 * 4) / 3066;
    expect(score).not.toBeNull();
    expect(score!).toBeCloseTo(attendu, 4);
    expect(score!).toBeCloseTo(2.31, 2); // ≈ 2,31 → cran 2 (Modérée)
  });

  it('retourne null sans aucun vote', () => {
    expect(perfScore([0, 0, 0, 0], [0, 0, 0, 0])).toBeNull();
  });
});

describe('perfScore — borne (gros parfum) vs intact (petit parfum)', () => {
  it('borne le poids Fragrantica à CAP sur un parfum très voté, laissant nos votes dominer', () => {
    const cranks = perfCranks(ALLURE_LONG_BREAKOUT, 'longevity'); // total 3066 > CAP
    const avecUser = perfScore(cranks, [0, 300, 0, 0]); // 300 votes « moderate » (cran 2)
    const sansUser = perfScore(cranks, [0, 0, 0, 0]);
    expect(avecUser!).toBeLessThan(sansUser!); // nos votes font descendre le score vers moderate
    // avec 300 votes sur 100 équivalents frag, le score doit nettement tirer vers 2
    expect(avecUser!).toBeCloseTo(2.1, 1);
  });

  it('laisse Fragrantica intact (poids 1) sur un petit parfum sous CAP', () => {
    const petit: [number, number, number, number] = [10, 20, 15, 5]; // total 50 < CAP
    const score = perfScore(petit, [0, 0, 0, 0]);
    // poids = 50/50 = 1 → moyenne pure : (10+40+45+20)/50 = 2.3
    expect(score!).toBeCloseTo((10 * 1 + 20 * 2 + 15 * 3 + 5 * 4) / 50, 4);
    // 10 votes user sur 50 frag (poids 1) → influence proportionnelle réelle
    const avecUser = perfScore(petit, [0, 10, 0, 0]);
    expect(avecUser!).toBeLessThan(score!);
  });
});

describe('perfScore — souveraineté quand Fragrantica est absent', () => {
  it('sans votes Fragrantica, le score est 100% utilisateur', () => {
    expect(perfScore([0, 0, 0, 0], [0, 0, 5, 0])).toBeCloseTo(3, 5);
  });
});

describe('perfLevel / perfLabel / perfFragEquiv', () => {
  it('borne le cran dans 1..4 et arrondit', () => {
    expect(perfLevel(0.2)).toBe(1);
    expect(perfLevel(2.5)).toBe(3);
    expect(perfLevel(4.7)).toBe(4);
    expect(perfLevel(null)).toBeNull();
  });

  it('mappe les libellés FR des crans', () => {
    expect(perfLabel('longevity', 3)).toBe('Longue');
    expect(perfLabel('sillage', 2)).toBe('Modéré');
    expect(perfLabel('longevity', null)).toBeNull();
  });

  it('calcule l’équivalent Fragrantica retenu après borne', () => {
    expect(perfFragEquiv([373, 1537, 981, 175])).toBeCloseTo(100, 0); // 3066 borné à 100
    expect(perfFragEquiv([10, 20, 15, 5])).toBeCloseTo(50, 0); // intact
    expect(perfFragEquiv([0, 0, 0, 0])).toBe(0);
  });
});

describe('PERF_CAP', () => {
  it('est calibré sur la médiane réelle du catalogue', () => {
    expect(PERF_CAP).toBe(100);
  });
});
