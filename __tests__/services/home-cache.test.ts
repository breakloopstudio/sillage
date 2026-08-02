import AsyncStorage from '@react-native-async-storage/async-storage';
import { getCached, setCached, getOrFetch, clearHomeCache } from '../../src/services/impl/home-cache';
import type { Parfum } from '../../src/models';

const PREFIX = '@sillage/home/v1/';

jest.mock('@react-native-async-storage/async-storage', () => {
  const store = new Map<string, string>();
  return {
    __esModule: true,
    default: {
      getItem: jest.fn(async (k: string) => (store.has(k) ? store.get(k)! : null)),
      setItem: jest.fn(async (k: string, v: string) => { store.set(k, v); }),
      removeItem: jest.fn(async (k: string) => { store.delete(k); }),
      getAllKeys: jest.fn(async () => Array.from(store.keys())),
      clear: jest.fn(async () => { store.clear(); }),
      __reset: () => store.clear(),
    },
  };
});

function parfum(id: string, extra: Partial<Parfum> = {}): Parfum {
  return {
    id,
    nom: `Nom ${id}`,
    marque: `Marque ${id}`,
    familleOlactive: 'floral',
    notesTete: [],
    notesCoeur: [],
    notesFond: [],
    createdAt: new Date('2026-01-02T03:04:05.000Z'),
    updatedAt: new Date('2026-01-03T04:05:06.000Z'),
    ...extra,
  } as Parfum;
}

beforeEach(() => {
  (AsyncStorage as unknown as { __reset: () => void }).__reset();
  (AsyncStorage.getItem as jest.Mock).mockClear();
  (AsyncStorage.setItem as jest.Mock).mockClear();
  (AsyncStorage.removeItem as jest.Mock).mockClear();
  (AsyncStorage.getAllKeys as jest.Mock).mockClear();
});

describe('home-cache getCached / setCached', () => {
  it('returns null on miss', async () => {
    expect(await getCached('missing')).toBeNull();
  });

  it('round-trips data through AsyncStorage', async () => {
    await setCached('popular', [parfum('a'), parfum('b')]);
    const cached = await getCached('popular');
    expect(cached).not.toBeNull();
    expect(cached!.data.map(p => p.id)).toEqual(['a', 'b']);
    expect(cached!.fresh).toBe(true);
  });

  it('restores Date fields on read', async () => {
    await setCached('dates', [parfum('d', { similarIdsCachedAt: new Date('2026-02-02T00:00:00.000Z') })]);
    const cached = await getCached('dates');
    const row = cached!.data[0];
    expect(row.createdAt).toBeInstanceOf(Date);
    expect((row.createdAt as Date).toISOString()).toBe('2026-01-02T03:04:05.000Z');
    expect(row.similarIdsCachedAt).toBeInstanceOf(Date);
  });

  it('ignores empty arrays (nothing persisted)', async () => {
    await setCached('empty', []);
    expect(await getCached('empty')).toBeNull();
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  });

  it('rejects envelopes with a different version', async () => {
    await AsyncStorage.setItem(PREFIX + 'old', JSON.stringify({ v: 999, t: Date.now(), data: [parfum('x')] }));
    expect(await getCached('old')).toBeNull();
  });

  it('marks cache stale past the TTL but still returns data', async () => {
    const now = 10_000_000;
    const spy = jest.spyOn(Date, 'now').mockReturnValue(now);
    await setCached('ttl', [parfum('t')]);
    spy.mockReturnValue(now + 60 * 60 * 1000);
    expect((await getCached('ttl'))!.fresh).toBe(true);
    spy.mockReturnValue(now + 7 * 60 * 60 * 1000);
    const stale = await getCached('ttl');
    expect(stale!.fresh).toBe(false);
    expect(stale!.data[0].id).toBe('t');
    spy.mockRestore();
  });
});

describe('home-cache getOrFetch', () => {
  it('fetches and writes the cache on success', async () => {
    const fetcher = jest.fn(async () => [parfum('f')]);
    const data = await getOrFetch('fetch-ok', fetcher);
    expect(data[0].id).toBe('f');
    expect(fetcher).toHaveBeenCalledTimes(1);
    const cached = await getCached('fetch-ok');
    expect(cached!.data[0].id).toBe('f');
  });

  it('deduplicates concurrent calls into a single fetch', async () => {
    let resolveFetcher: (v: Parfum[]) => void = () => {};
    const fetcher = jest.fn(() => new Promise<Parfum[]>((r) => { resolveFetcher = r; }));
    const p1 = getOrFetch('dedup', fetcher);
    const p2 = getOrFetch('dedup', fetcher);
    expect(fetcher).toHaveBeenCalledTimes(1);
    resolveFetcher([parfum('d')]);
    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1[0].id).toBe('d');
    expect(r2[0].id).toBe('d');
  });

  it('returns [] and skips caching when the fetcher rejects', async () => {
    const fetcher = jest.fn(async () => { throw new Error('boom'); });
    const data = await getOrFetch('fetch-err', fetcher);
    expect(data).toEqual([]);
    expect(await getCached('fetch-err')).toBeNull();
  });

  it('does not cache an empty result', async () => {
    const fetcher = jest.fn(async () => [] as Parfum[]);
    await getOrFetch('fetch-empty', fetcher);
    expect(await getCached('fetch-empty')).toBeNull();
  });
});

describe('home-cache clearHomeCache', () => {
  it('removes only home-cache keys', async () => {
    await setCached('popular', [parfum('p')]);
    await AsyncStorage.setItem('@sillage/other', 'keep');
    await clearHomeCache();
    expect(await getCached('popular')).toBeNull();
    expect(await AsyncStorage.getItem('@sillage/other')).toBe('keep');
  });
});
