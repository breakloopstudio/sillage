// __tests__/services/catalog-search.test.ts
// Tests searchParfumsCached + searchParfumFromScan (RPC Supabase)

import { supabase } from '../../src/services/supabase';
import { searchParfumsCached, searchParfumFromScan, SearchError, clearSearchCache } from '../../src/services/catalog';

const mockRpc = supabase.rpc as jest.Mock;

function row(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    nom: overrides.nom ?? 'Parfum Test',
    marque: overrides.marque ?? 'Marque Test',
    review_count: overrides.review_count ?? 100,
    rating_count: overrides.rating_count ?? 200,
    popularity_score: overrides.popularity_score ?? 150,
    search_text: overrides.search_text ?? `${(overrides.marque ?? 'marque test').toLowerCase()} ${(overrides.nom ?? 'parfum test').toLowerCase()}`,
    best_price: overrides.best_price ?? null,
    ...overrides,
  };
}

beforeEach(() => {
  mockRpc.mockReset();
  clearSearchCache();
});

describe('searchParfumsCached', () => {
  it('returns [] for queries < 2 chars', async () => {
    expect(await searchParfumsCached('a')).toEqual([]);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('calls RPC search_parfums with correct args', async () => {
    mockRpc.mockResolvedValue({ data: [row('p1', { nom: 'Chance', marque: 'Chanel' })], error: null });
    const results = await searchParfumsCached('chanel');
    expect(mockRpc).toHaveBeenCalledWith('search_parfums', { q: 'chanel', max_results: 50 });
    expect(results).toHaveLength(1);
    expect(results[0].nom).toBe('Chance');
    expect(results[0].marque).toBe('Chanel');
  });

  it('throws SearchError on RPC error', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'Network error' } });
    await expect(searchParfumsCached('chanel')).rejects.toThrow(SearchError);
  });

  it('deduplicates by marque+nom', async () => {
    mockRpc.mockResolvedValue({
      data: [
        row('p1', { nom: 'Sauvage', marque: 'Dior', popularity_score: 200 }),
        row('p2', { nom: 'Sauvage', marque: 'Dior', popularity_score: 100 }),
      ],
      error: null,
    });
    const results = await searchParfumsCached('dior sauvage');
    expect(results).toHaveLength(1);
  });

  it('caches results (second call does not hit RPC)', async () => {
    mockRpc.mockResolvedValue({ data: [row('p1')], error: null });
    await searchParfumsCached('test');
    expect(mockRpc).toHaveBeenCalledTimes(1);
    await searchParfumsCached('test');
    expect(mockRpc).toHaveBeenCalledTimes(1);
  });

  it('clearSearchCache forces new RPC call', async () => {
    mockRpc.mockResolvedValue({ data: [row('p1')], error: null });
    await searchParfumsCached('test');
    clearSearchCache();
    await searchParfumsCached('test');
    expect(mockRpc).toHaveBeenCalledTimes(2);
  });

  it('maps snake_case rows to camelCase Parfum', async () => {
    mockRpc.mockResolvedValue({
      data: [row('p1', {
        nom: 'N°5', marque: 'Chanel', best_price: 89.99,
        notes_tete: ['Aldehydes'], notes_coeur: ['Jasmine'], notes_fond: ['Sandalwood'],
        image_url: 'https://img.webp', famille_olfactive: 'Floral',
      })],
      error: null,
    });
    const [p] = await searchParfumsCached('chanel');
    expect(p.bestPrice).toBe(89.99);
    expect(p.notesTete).toEqual(['Aldehydes']);
    expect(p.imageUrl).toBe('https://img.webp');
    expect(p.familleOlactive).toBe('Floral');
  });
});

describe('searchParfumFromScan', () => {
  it('returns [] if both marque and nom are null', async () => {
    expect(await searchParfumFromScan(null, null)).toEqual([]);
  });

  it('boosts exact nom match (+50) above partial', async () => {
    mockRpc.mockResolvedValue({
      data: [
        row('p1', { nom: 'Sauvage Parfum', marque: 'Dior', search_text: 'dior sauvage parfum' }),
        row('p2', { nom: 'Sauvage', marque: 'Dior', search_text: 'dior sauvage' }),
      ],
      error: null,
    });
    const results = await searchParfumFromScan('Dior', 'Sauvage');
    expect(results[0].id).toBe('p2');
  });

  it('boosts exact marque match (+15)', async () => {
    mockRpc.mockResolvedValue({
      data: [
        row('p1', { nom: 'Test', marque: 'Diorissimo', search_text: 'diorissimo test' }),
        row('p2', { nom: 'Test', marque: 'Dior', search_text: 'dior test' }),
      ],
      error: null,
    });
    const results = await searchParfumFromScan('Dior', 'Test');
    expect(results[0].id).toBe('p2');
  });
});
