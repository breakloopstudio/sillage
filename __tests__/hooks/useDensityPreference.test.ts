import { renderHook, act } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useDensityPreference, GRID_MODES } from '../../src/hooks/useDensityPreference';
import type { CardMode } from '../../src/components/ParfumCard';

describe('GRID_MODES', () => {
  it('has 3 modes', () => {
    expect(GRID_MODES).toHaveLength(3);
  });

  it('contains comfortable, compactPlus, list', () => {
    const keys = GRID_MODES.map(m => m.key);
    expect(keys).toContain('comfortable');
    expect(keys).toContain('compactPlus');
    expect(keys).toContain('list');
  });

  it('each mode has a label', () => {
    for (const m of GRID_MODES) {
      expect(typeof m.label).toBe('string');
      expect(m.label.length).toBeGreaterThan(0);
    }
  });
});

describe('useDensityPreference', () => {
  beforeEach(() => {
    (AsyncStorage.getItem as jest.Mock).mockClear();
    (AsyncStorage.setItem as jest.Mock).mockClear();
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
  });

  it('defaults to comfortable when no preference stored', async () => {
    const { result } = renderHook(() => useDensityPreference());
    expect(result.current.density).toBe('comfortable');
  });

  it('loads stored "compactPlus" preference', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue('compactPlus');
    const { result } = renderHook(() => useDensityPreference());

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.density).toBe('compactPlus');
  });

  it('loads stored "list" preference', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue('list');
    const { result } = renderHook(() => useDensityPreference());

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.density).toBe('list');
  });

  it('falls back to comfortable on invalid stored value', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue('invalid_mode');
    const { result } = renderHook(() => useDensityPreference());

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.density).toBe('comfortable');
  });

  it('falls back to comfortable on null', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    const { result } = renderHook(() => useDensityPreference());

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.density).toBe('comfortable');
  });

  it('setDensity updates state and persists to AsyncStorage', () => {
    const { result } = renderHook(() => useDensityPreference());

    act(() => result.current.setDensity('compactPlus'));
    expect(result.current.density).toBe('compactPlus');
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      '@sillage/catalog-density',
      'compactPlus',
    );
  });

  it('setDensity persists "list"', () => {
    const { result } = renderHook(() => useDensityPreference());

    act(() => result.current.setDensity('list'));
    expect(result.current.density).toBe('list');
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      '@sillage/catalog-density',
      'list',
    );
  });

  it('setDensity survives AsyncStorage failure gracefully', () => {
    (AsyncStorage.setItem as jest.Mock).mockRejectedValue(new Error('disk full'));
    const { result } = renderHook(() => useDensityPreference());

    // Should not throw
    act(() => result.current.setDensity('list'));
    expect(result.current.density).toBe('list');
  });

  it('loads "comfortable" from stored preference', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue('comfortable');
    const { result } = renderHook(() => useDensityPreference());

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.density).toBe('comfortable');
  });

  it('isValid only accepts known modes', () => {
    expect(GRID_MODES.some(m => m.key === 'comfortable')).toBe(true);
    expect(GRID_MODES.some(m => m.key === 'compactPlus')).toBe(true);
    expect(GRID_MODES.some(m => m.key === 'list')).toBe(true);
    expect(GRID_MODES.some(m => m.key === 'invalid' as CardMode)).toBe(false);
  });
});
