import { renderHook, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useStaleWhileRevalidate } from '../../src/hooks/useStaleWhileRevalidate';
import { getCached } from '../../src/services/impl/home-cache';
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

function parfum(id: string): Parfum {
  return {
    id,
    nom: `Nom ${id}`,
    marque: `Marque ${id}`,
    familleOlactive: 'floral',
    notesTete: [],
    notesCoeur: [],
    notesFond: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  } as Parfum;
}

async function seedStale(key: string, data: Parfum[]): Promise<void> {
  await AsyncStorage.setItem(PREFIX + key, JSON.stringify({ v: 1, t: Date.now() - 7 * 60 * 60 * 1000, data }));
}

beforeEach(() => {
  (AsyncStorage as unknown as { __reset: () => void }).__reset();
});

describe('useStaleWhileRevalidate', () => {
  it('starts loading then resolves with the fresh fetch on a miss', async () => {
    const fetcher = jest.fn(async () => [parfum('fresh')]);
    const { result } = renderHook(() => useStaleWhileRevalidate('miss-key', fetcher));

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data.map(p => p.id)).toEqual(['fresh']);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('serves stale cache immediately and revalidates in the background', async () => {
    await seedStale('swr-key', [parfum('stale')]);
    const fetcher = jest.fn(() => new Promise<Parfum[]>(() => {}));
    const { result } = renderHook(() => useStaleWhileRevalidate('swr-key', fetcher));

    await waitFor(() => expect(result.current.data[0]?.id).toBe('stale'));
    expect(result.current.loading).toBe(false);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('resets and reads the new cache when the key changes', async () => {
    await seedStale('key-a', [parfum('A')]);
    await seedStale('key-b', [parfum('B')]);
    const fetcher = jest.fn(() => new Promise<Parfum[]>(() => {}));
    const { result, rerender } = renderHook(({ key }: { key: string }) => useStaleWhileRevalidate(key, fetcher), {
      initialProps: { key: 'key-a' },
    });

    await waitFor(() => expect(result.current.data[0]?.id).toBe('A'));
    rerender({ key: 'key-b' });
    await waitFor(() => expect(result.current.data[0]?.id).toBe('B'));
  });

  it('writes the fresh result to cache for the next mount', async () => {
    const fetcher = jest.fn(async () => [parfum('persist')]);
    const { unmount } = renderHook(() => useStaleWhileRevalidate('persist-key', fetcher));
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
    unmount();
    const cached = await getCached('persist-key');
    expect(cached!.data[0].id).toBe('persist');
  });
});
