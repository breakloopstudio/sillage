// __tests__/services/catalog-chroma.test.ts
// Tests getParfumsByColor (RPC chroma_parfums + cache mémoire partagé wheel→search)

import { supabase } from '../../src/services/supabase';
import { getParfumsByColor, clearSearchCache } from '../../src/services/catalog';
import { getColorByKey } from '../../src/utils/chromatic-wheel';

const mockRpc = supabase.rpc as jest.Mock;

function row(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    nom: overrides.nom ?? 'Parfum Test',
    marque: overrides.marque ?? 'Marque Test',
    popularity_score: overrides.popularity_score ?? 150,
    image_url: overrides.image_url ?? 'https://img/1.webp',
    ...overrides,
  };
}

beforeEach(() => {
  mockRpc.mockReset();
  clearSearchCache();
});

describe('getParfumsByColor', () => {
  it('returns [] for an unknown color key without calling RPC', async () => {
    expect(await getParfumsByColor('inexistante')).toEqual([]);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('calls RPC chroma_parfums with the taxonomy of the color', async () => {
    mockRpc.mockResolvedValue({ data: [row('p1')], error: null });
    const results = await getParfumsByColor('black');
    const def = getColorByKey('black')!;
    expect(mockRpc).toHaveBeenCalledWith('chroma_parfums', {
      p_accords: def.accords,
      p_notes: def.notes,
      p_season: def.season,
      p_limit: 50,
    });
    expect(results).toHaveLength(1);
  });

  it('passes season affinity (yellow → summer) or undefined', async () => {
    mockRpc.mockResolvedValue({ data: [], error: null });
    await getParfumsByColor('yellow');
    expect(mockRpc).toHaveBeenCalledWith('chroma_parfums', expect.objectContaining({ p_season: 'summer' }));
    mockRpc.mockClear();
    await getParfumsByColor('purple');
    expect(mockRpc).toHaveBeenCalledWith('chroma_parfums', expect.objectContaining({ p_season: undefined }));
  });

  it('caches results — second call does not hit RPC', async () => {
    mockRpc.mockResolvedValue({ data: [row('p1')], error: null });
    await getParfumsByColor('red');
    await getParfumsByColor('red');
    expect(mockRpc).toHaveBeenCalledTimes(1);
  });

  it('deduplicates in-flight requests (shared promise wheel→search)', async () => {
    let resolveRpc!: (v: unknown) => void;
    mockRpc.mockImplementation(() => new Promise(res => { resolveRpc = res; }));
    const p1 = getParfumsByColor('blue');
    const p2 = getParfumsByColor('blue');
    resolveRpc({ data: [row('p1')], error: null });
    const [r1, r2] = await Promise.all([p1, p2]);
    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(r1).toEqual(r2);
  });

  it('clearSearchCache purges the chroma cache', async () => {
    mockRpc.mockResolvedValue({ data: [row('p1')], error: null });
    await getParfumsByColor('green');
    clearSearchCache();
    await getParfumsByColor('green');
    expect(mockRpc).toHaveBeenCalledTimes(2);
  });

  it('deduplicates results by marque+nom', async () => {
    mockRpc.mockResolvedValue({
      data: [
        row('p1', { nom: 'Ambre', marque: 'Maison', popularity_score: 200 }),
        row('p2', { nom: 'Ambre', marque: 'Maison', popularity_score: 100 }),
      ],
      error: null,
    });
    const results = await getParfumsByColor('orange');
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('p1');
  });

  it('returns [] on RPC error (no throw, nothing cached)', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'Network error' } });
    expect(await getParfumsByColor('pink')).toEqual([]);
    // L'échec n'est pas caché : un nouvel appel retente la RPC
    expect(await getParfumsByColor('pink')).toEqual([]);
    expect(mockRpc).toHaveBeenCalledTimes(2);
  });
});
