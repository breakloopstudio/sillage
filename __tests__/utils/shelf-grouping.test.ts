import type { UserParfum, Shelf } from '../../src/models/user-parfum.interface';
import {
  groupItemsByShelf,
  orphanItems,
  signatureItems,
  favoriteItems,
  hasShelfMatter,
  inspireMissing,
} from '../../src/utils/shelf-grouping';

function up(over: Partial<UserParfum> & { parfumId: string }): UserParfum {
  return {
    status: 'have',
    verdict: null,
    rating: null,
    notes: null,
    triedAt: null,
    shelfIds: [],
    sotdCount: 0,
    isSignature: false,
    nom: 'Nom',
    marque: 'Marque',
    imageUrl: null,
    familleOlactive: null,
    addedAt: new Date(0),
    updatedAt: new Date(0),
    ...over,
  };
}

function shelf(id: string, order = 0): Shelf {
  return {
    id,
    name: id,
    icon: null,
    color: null,
    description: null,
    isPublic: false,
    order,
    createdAt: new Date(0),
  };
}

describe('groupItemsByShelf', () => {
  it('keeps shelf order and groups members', () => {
    const shelves = [shelf('b', 1), shelf('a', 0)];
    const items = [
      up({ parfumId: 'p1', shelfIds: ['a'] }),
      up({ parfumId: 'p2', shelfIds: ['b'] }),
      up({ parfumId: 'p3', shelfIds: ['a', 'b'] }),
    ];
    const groups = groupItemsByShelf(items, shelves);
    expect(groups.map((g) => g.shelf.id)).toEqual(['b', 'a']);
    expect(groups[0].items.map((i) => i.parfumId)).toEqual(['p2', 'p3']);
    expect(groups[1].items.map((i) => i.parfumId)).toEqual(['p1', 'p3']);
  });

  it('includes empty shelves with an empty items list', () => {
    const groups = groupItemsByShelf([up({ parfumId: 'p1', shelfIds: ['a'] })], [shelf('a'), shelf('empty')]);
    expect(groups[1].shelf.id).toBe('empty');
    expect(groups[1].items).toEqual([]);
  });
});

describe('orphanItems', () => {
  it('returns only items on no shelf', () => {
    const items = [
      up({ parfumId: 'p1', shelfIds: [] }),
      up({ parfumId: 'p2', shelfIds: ['a'] }),
      up({ parfumId: 'p3', shelfIds: [] }),
    ];
    expect(orphanItems(items).map((i) => i.parfumId)).toEqual(['p1', 'p3']);
  });
});

describe('signatureItems', () => {
  it('returns only signature items', () => {
    const items = [
      up({ parfumId: 'p1', isSignature: true }),
      up({ parfumId: 'p2', isSignature: false }),
    ];
    expect(signatureItems(items).map((i) => i.parfumId)).toEqual(['p1']);
  });
});

describe('favoriteItems', () => {
  it('returns items whose id is in favIds', () => {
    const items = [up({ parfumId: 'p1' }), up({ parfumId: 'p2' }), up({ parfumId: 'p3' })];
    expect(favoriteItems(items, new Set(['p2', 'p3'])).map((i) => i.parfumId)).toEqual(['p2', 'p3']);
  });
});

describe('hasShelfMatter', () => {
  it('is false when everything is empty', () => {
    expect(hasShelfMatter([], [up({ parfumId: 'p1' })], new Set())).toBe(false);
  });

  it('is true when a custom shelf exists', () => {
    expect(hasShelfMatter([shelf('a')], [], new Set())).toBe(true);
  });

  it('is true when a signature exists', () => {
    expect(hasShelfMatter([], [up({ parfumId: 'p1', isSignature: true })], new Set())).toBe(true);
  });

  it('is true when an item is also a favorite', () => {
    expect(hasShelfMatter([], [up({ parfumId: 'p1' })], new Set(['p1']))).toBe(true);
  });
});

describe('inspireMissing', () => {
  const item = (parfumId: string) => ({ parfumId, nom: 'n', marque: 'm', imageUrl: null, familleOlactive: null });

  it('returns only items not already in the parfumerie', () => {
    const items = [item('p1'), item('p2'), item('p3')];
    expect(inspireMissing(items, new Set(['p2'])).map((i) => i.parfumId)).toEqual(['p1', 'p3']);
  });

  it('returns all when nothing is owned', () => {
    expect(inspireMissing([item('p1'), item('p2')], new Set())).toHaveLength(2);
  });

  it('returns none when everything is owned (no duplicates on re-inspire)', () => {
    expect(inspireMissing([item('p1'), item('p2')], new Set(['p1', 'p2']))).toEqual([]);
  });
});
