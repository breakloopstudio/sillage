import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useCatalog } from '../../src/hooks/useCatalog';

const mockSearch = jest.fn();
jest.mock('../../src/services/catalog', () => ({
  searchParfumsCached: (...args: unknown[]) => mockSearch(...args),
}));

describe('useCatalog', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockSearch.mockClear();
    mockSearch.mockResolvedValue([]);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('initial state is empty and not searching', () => {
    const { result } = renderHook(() => useCatalog());
    expect(result.current.parfums).toEqual([]);
    expect(result.current.searching).toBe(false);
  });

  it('short query (< 2 chars) clears results immediately', () => {
    const { result } = renderHook(() => useCatalog());
    act(() => result.current.search('a'));
    expect(result.current.parfums).toEqual([]);
    expect(result.current.searching).toBe(false);
    expect(mockSearch).not.toHaveBeenCalled();
  });

  it('empty query after trim clears results', () => {
    const { result } = renderHook(() => useCatalog());
    act(() => result.current.search('   '));
    expect(result.current.parfums).toEqual([]);
    expect(result.current.searching).toBe(false);
  });

  it('valid query (>= 2 chars) sets searching=true immediately', () => {
    const { result } = renderHook(() => useCatalog());
    act(() => result.current.search('dior'));
    expect(result.current.searching).toBe(true);
  });

  it('calls searchParfumsCached after 150ms debounce', async () => {
    mockSearch.mockResolvedValue([{ id: '1', nom: 'Sauvage' }]);
    const { result } = renderHook(() => useCatalog());

    act(() => result.current.search('dior'));
    expect(mockSearch).not.toHaveBeenCalled();

    await act(async () => { jest.advanceTimersByTime(150); });
    expect(mockSearch).toHaveBeenCalledWith('dior');
    expect(mockSearch).toHaveBeenCalledTimes(1);
  });

  it('debounce cancels previous timer on rapid calls', async () => {
    const { result } = renderHook(() => useCatalog());

    act(() => result.current.search('di'));
    act(() => result.current.search('dior'));
    act(() => result.current.search('dior sauv'));

    await act(async () => { jest.advanceTimersByTime(150); });
    expect(mockSearch).toHaveBeenCalledTimes(1);
    expect(mockSearch).toHaveBeenCalledWith('dior sauv');
  });

  it('requestIdRef prevents stale results from fast typing', async () => {
    const { result } = renderHook(() => useCatalog());

    act(() => result.current.search('dior'));
    await act(async () => { jest.advanceTimersByTime(149); });

    act(() => result.current.search('sauvage'));

    await act(async () => { jest.advanceTimersByTime(150); });
    expect(mockSearch).toHaveBeenCalledTimes(1);
    expect(mockSearch).toHaveBeenCalledWith('sauvage');
  });

  it('updates parfums on successful search', async () => {
    const mockParfums = [
      { id: '1', nom: 'Sauvage', marque: 'Dior', familleOlactive: 'aromatic' },
    ];
    mockSearch.mockResolvedValue(mockParfums);
    const { result } = renderHook(() => useCatalog());

    act(() => result.current.search('dior'));
    await act(async () => { jest.advanceTimersByTime(150); });
    await act(async () => { jest.runAllTimers(); });

    expect(result.current.parfums).toBe(mockParfums);
    expect(result.current.searching).toBe(false);
  });

  it('sets searching=false when searchParfumsCached throws', async () => {
    mockSearch.mockRejectedValue(new Error('RPC error'));
    const { result } = renderHook(() => useCatalog());

    act(() => result.current.search('dior'));
    await act(async () => { jest.advanceTimersByTime(150); });
    await act(async () => { jest.runAllTimers(); });

    expect(result.current.searching).toBe(false);
    expect(result.current.parfums).toEqual([]);
  });

  describe('clear', () => {
    it('resets parfums and searching', async () => {
      mockSearch.mockResolvedValue([{ id: '1', nom: 'Sauvage' }]);
      const { result } = renderHook(() => useCatalog());

      act(() => result.current.search('dior'));
      await act(async () => { jest.advanceTimersByTime(150); });
      await act(async () => { jest.runAllTimers(); });

      act(() => result.current.clear());
      expect(result.current.parfums).toEqual([]);
      expect(result.current.searching).toBe(false);
    });

    it('cancels pending timer', async () => {
      const { result } = renderHook(() => useCatalog());

      act(() => result.current.search('dior'));
      jest.advanceTimersByTime(50);
      act(() => result.current.clear());
      await act(async () => { jest.advanceTimersByTime(200); });

      expect(mockSearch).not.toHaveBeenCalled();
    });
  });

  it('does not call search after unmount — timer is cleaned up', () => {
    const { result, unmount } = renderHook(() => useCatalog());

    act(() => result.current.search('dior'));
    unmount();
    act(() => { jest.advanceTimersByTime(150); });

    expect(mockSearch).not.toHaveBeenCalled();
  });
});
