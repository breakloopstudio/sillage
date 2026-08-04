// __tests__/utils/collection-scan.test.ts — Helpers purs du scan de collection

import {
  pickDetectionMatch, isMatchableDetection, dedupeCollectionMatches,
  defaultSelectedIds, ownedIdSet, COLLECTION_MATCH_THRESHOLD,
} from '../../src/utils/collection-scan';
import type { CollectionMatch, Parfum } from '../../src/models';

function makeParfum(overrides: Partial<Parfum> = {}): Parfum {
  return {
    id: 'p1',
    marque: 'Dior',
    nom: 'Sauvage',
    familleOlactive: 'aromatique',
    notesTete: [], notesCoeur: [], notesFond: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeMatch(overrides: Partial<CollectionMatch> & { parfum?: Parfum } = {}): CollectionMatch {
  return {
    parfum: overrides.parfum ?? makeParfum(),
    confidence: 'high',
    textRead: true,
    visualMatch: false,
    ...overrides,
  };
}

describe('pickDetectionMatch', () => {
  it('retourne le top si son score atteint le seuil', () => {
    const top = { ...makeParfum(), _scanScore: COLLECTION_MATCH_THRESHOLD };
    expect(pickDetectionMatch([top])).toBe(top);
  });

  it('retourne null si le score est sous le seuil', () => {
    expect(pickDetectionMatch([{ ...makeParfum(), _scanScore: COLLECTION_MATCH_THRESHOLD - 1 }])).toBeNull();
  });

  it('retourne null sans score du tout', () => {
    expect(pickDetectionMatch([makeParfum()])).toBeNull();
  });

  it('retourne null sur liste vide', () => {
    expect(pickDetectionMatch([])).toBeNull();
  });
});

describe('isMatchableDetection', () => {
  it('true avec marque seule', () => {
    expect(isMatchableDetection({ textRead: false, marque: 'Dior', nom: null, typeParfum: null, confidence: 'low', alternatives: [] })).toBe(true);
  });

  it('true avec nom seul', () => {
    expect(isMatchableDetection({ textRead: false, marque: null, nom: 'Sauvage', typeParfum: null, confidence: 'low', alternatives: [] })).toBe(true);
  });

  it('false sans marque ni nom', () => {
    expect(isMatchableDetection({ textRead: false, marque: null, nom: null, typeParfum: null, confidence: 'low', alternatives: [] })).toBe(false);
  });
});

describe('dedupeCollectionMatches', () => {
  it('déduplique par id catalogue en gardant le premier', () => {
    const a = makeMatch({ confidence: 'high' });
    const b = makeMatch({ confidence: 'low' });
    const c = makeMatch({ parfum: makeParfum({ id: 'p2' }) });
    expect(dedupeCollectionMatches([a, b, c])).toEqual([a, c]);
  });

  it('liste vide → liste vide', () => {
    expect(dedupeCollectionMatches([])).toEqual([]);
  });
});

describe('defaultSelectedIds', () => {
  it('coche les vérifiés (confidence high) pas encore possédés', () => {
    const verified = makeMatch({ parfum: makeParfum({ id: 'ok' }), confidence: 'high' });
    const probable = makeMatch({ parfum: makeParfum({ id: 'probable' }), confidence: 'low' });
    const owned = makeMatch({ parfum: makeParfum({ id: 'owned' }), confidence: 'high' });
    const selected = defaultSelectedIds([verified, probable, owned], new Set(['owned']));
    expect(selected).toEqual(new Set(['ok']));
  });

  it('jamais de flacon déjà possédé', () => {
    const owned = makeMatch({ parfum: makeParfum({ id: 'owned' }), confidence: 'high' });
    expect(defaultSelectedIds([owned], new Set(['owned']))).toEqual(new Set());
  });
});

describe('ownedIdSet', () => {
  it('construit le Set des parfumId', () => {
    expect(ownedIdSet([{ parfumId: 'a' }, { parfumId: 'b' }, { parfumId: 'a' }])).toEqual(new Set(['a', 'b']));
  });
});
