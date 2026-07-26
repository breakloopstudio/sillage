import { buildMyParfums, pillOfItem, filterByPill, myParfumToCard, type MyParfum } from '../../src/utils/my-parfums';
import { favoriMatchesSearch } from '../../src/utils/favori-filters';
import type { UserFavori } from '../../src/models';
import type { UserParfum, UserParfumStatus } from '../../src/models/user-parfum.interface';

function makeFav(over: Partial<UserFavori> = {}): UserFavori {
  return {
    id: 'f1',
    parfumId: 'p1',
    addedAt: new Date('2026-01-01'),
    nom: 'Fav Nom',
    marque: 'Fav Marque',
    ...over,
  };
}

function makeUp(over: Partial<UserParfum> = {}): UserParfum {
  return {
    parfumId: 'p1',
    status: 'have',
    verdict: null,
    rating: null,
    notes: null,
    triedAt: null,
    shelfIds: [],
    sotdCount: 0,
    isSignature: false,
    nom: 'Up Nom',
    marque: 'Up Marque',
    imageUrl: null,
    familleOlactive: null,
    addedAt: new Date('2026-01-02'),
    updatedAt: new Date('2026-01-02'),
    ...over,
  };
}

function makeMy(status: UserParfumStatus | null): MyParfum {
  return {
    parfumId: 'p1', nom: 'N', marque: 'M', imageUrl: null, familleOlactive: null,
    longevity: null, sillage: null, seasonScores: null, notes: null, allNotes: null,
    status, verdict: null, rating: null, isFav: false, isSignature: false, shelfIds: [],
    addedAt: new Date(),
  };
}

describe('buildMyParfums', () => {
  it('favori sans user_parfum → status null, isFav true', () => {
    const [m] = buildMyParfums([makeFav()], []);
    expect(m.status).toBeNull();
    expect(m.isFav).toBe(true);
    expect(m.parfumId).toBe('p1');
  });

  it('user_parfum sans favori → isFav false, statut conservé', () => {
    const [m] = buildMyParfums([], [makeUp({ status: 'to_try' })]);
    expect(m.status).toBe('to_try');
    expect(m.isFav).toBe(false);
  });

  it('favori + user_parfum même parfumId → fusion dédupliquée', () => {
    const result = buildMyParfums([makeFav()], [makeUp({ status: 'have' })]);
    expect(result).toHaveLength(1);
    expect(result[0].isFav).toBe(true);
    expect(result[0].status).toBe('have');
  });

  it('champs display : user_parfum prioritaire, annee et bestPrice fallback favori', () => {
    const fav = makeFav({ annee: 2020, bestPrice: 50, imageUrl: 'fav.png' });
    const up = makeUp({ nom: 'Up Nom', bestPrice: undefined, imageUrl: null });
    const [m] = buildMyParfums([fav], [up]);
    expect(m.nom).toBe('Up Nom');
    expect(m.annee).toBe(2020);
    expect(m.bestPrice).toBe(50);
    expect(m.imageUrl).toBe('fav.png');
  });

  it('notes : allNotes depuis user_parfum, note perso depuis user_parfum.notes', () => {
    const fav = makeFav({ notes: ['bergamot'] });
    const up = makeUp({ allNotes: ['cedar'], notes: 'mon souvenir' });
    const [m] = buildMyParfums([fav], [up]);
    expect(m.allNotes).toEqual(['cedar']);
    expect(m.notes).toBe('mon souvenir');
  });

  it('aucun doublon par parfumId sur plusieurs entrées', () => {
    const favs = [makeFav({ parfumId: 'a' }), makeFav({ id: 'f2', parfumId: 'b' })];
    const ups = [makeUp({ parfumId: 'b' }), makeUp({ parfumId: 'c' })];
    const result = buildMyParfums(favs, ups);
    expect(result).toHaveLength(3);
    expect(result.map(m => m.parfumId).sort()).toEqual(['a', 'b', 'c']);
  });
});

describe('pillOfItem', () => {
  it('status null → to_stat', () => {
    expect(pillOfItem(makeMy(null))).toBe('to_stat');
  });

  it('to_try / want / tried → to_try', () => {
    expect(pillOfItem(makeMy('to_try'))).toBe('to_try');
    expect(pillOfItem(makeMy('want'))).toBe('to_try');
    expect(pillOfItem(makeMy('tried'))).toBe('to_try');
  });

  it('have → have, had → had', () => {
    expect(pillOfItem(makeMy('have'))).toBe('have');
    expect(pillOfItem(makeMy('had'))).toBe('had');
  });
});

describe('filterByPill', () => {
  const items = [makeMy(null), makeMy('to_try'), makeMy('have'), makeMy('had')];

  it('all retourne tout', () => {
    expect(filterByPill(items, 'all')).toHaveLength(4);
  });

  it('to_stat filtre les non statués', () => {
    const r = filterByPill(items, 'to_stat');
    expect(r).toHaveLength(1);
    expect(r[0].status).toBeNull();
  });

  it('have filtre les possédés', () => {
    const r = filterByPill(items, 'have');
    expect(r).toHaveLength(1);
    expect(r[0].status).toBe('have');
  });
});

describe('myParfumToCard', () => {
  it('mappe vers une forme Parfum pour ParfumCard', () => {
    const m = makeMy('have');
    m.nom = 'Bleu'; m.marque = 'Chanel'; m.bestPrice = 89; m.annee = 2014;
    const card = myParfumToCard(m);
    expect(card.id).toBe('p1');
    expect(card.nom).toBe('Bleu');
    expect(card.marque).toBe('Chanel');
    expect(card.bestPrice).toBe(89);
    expect(card.annee).toBe(2014);
  });
});

describe('compatibilité FilterableItem', () => {
  it('favoriMatchesSearch cherche dans allNotes et la note perso', () => {
    const m = makeMy('have');
    m.allNotes = ['bergamot'];
    m.notes = 'mon souvenir';
    expect(favoriMatchesSearch(m, 'bergamot')).toBe(true);
    expect(favoriMatchesSearch(m, 'souvenir')).toBe(true);
    expect(favoriMatchesSearch(m, 'xyz')).toBe(false);
  });
});
