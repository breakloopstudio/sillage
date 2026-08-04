import AsyncStorage from '@react-native-async-storage/async-storage';
import { getThemeMode, setThemeMode } from '../../src/services/theme-storage';

const mockGetItem = AsyncStorage.getItem as jest.Mock;
const mockSetItem = AsyncStorage.setItem as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('getThemeMode', () => {
  it('returns stored mode when valid', async () => {
    mockGetItem.mockResolvedValueOnce('dark');
    await expect(getThemeMode()).resolves.toBe('dark');
    expect(mockGetItem).toHaveBeenCalledWith('@sillage/theme');
  });

  it.each(['light', 'system'] as const)('returns "%s" when stored', async (mode) => {
    mockGetItem.mockResolvedValueOnce(mode);
    await expect(getThemeMode()).resolves.toBe(mode);
  });

  it('falls back to system when absent', async () => {
    mockGetItem.mockResolvedValueOnce(null);
    await expect(getThemeMode()).resolves.toBe('system');
  });

  it('falls back to system on invalid value', async () => {
    mockGetItem.mockResolvedValueOnce('neon');
    await expect(getThemeMode()).resolves.toBe('system');
  });

  it('falls back to system on storage error', async () => {
    mockGetItem.mockRejectedValueOnce(new Error('boom'));
    await expect(getThemeMode()).resolves.toBe('system');
  });
});

describe('setThemeMode', () => {
  it('persists the mode under the theme key', async () => {
    await setThemeMode('dark');
    expect(mockSetItem).toHaveBeenCalledWith('@sillage/theme', 'dark');
  });
});
