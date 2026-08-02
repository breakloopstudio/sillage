import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  SKINS, getSkinForScore, getSkinsForScore,
  getUnlockedSkins, unlockSkin, unlockSkins,
  getHighScore, setHighScore,
  getSelectedSkinKey, setSelectedSkinKey,
  getMuted, setMuted,
} from '../../src/features/runner/runner-storage';

const mockGetItem = AsyncStorage.getItem as jest.Mock;
const mockSetItem = AsyncStorage.setItem as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('SKINS', () => {
  it('starts with default skin at threshold 0', () => {
    expect(SKINS[0].key).toBe('default');
    expect(SKINS[0].threshold).toBe(0);
  });

  it('has 4 skins', () => {
    expect(SKINS).toHaveLength(4);
  });
});

describe('getSkinForScore', () => {
  it('returns default below 500', () => {
    expect(getSkinForScore(0).key).toBe('default');
    expect(getSkinForScore(499).key).toBe('default');
  });

  it('returns amber at 500', () => {
    expect(getSkinForScore(500).key).toBe('amber');
  });

  it('returns frost at 1500', () => {
    expect(getSkinForScore(1500).key).toBe('frost');
  });

  it('returns noir at 3000', () => {
    expect(getSkinForScore(3000).key).toBe('noir');
    expect(getSkinForScore(99999).key).toBe('noir');
  });
});

describe('getSkinsForScore', () => {
  it('returns only default at 0', () => {
    expect(getSkinsForScore(0).map(s => s.key)).toEqual(['default']);
  });

  it('returns all unlocked at 3000', () => {
    const keys = getSkinsForScore(3000).map(s => s.key);
    expect(keys).toEqual(['default', 'amber', 'frost', 'noir']);
  });

  it('returns intermediate set at 1500', () => {
    const keys = getSkinsForScore(1500).map(s => s.key);
    expect(keys).toEqual(['default', 'amber', 'frost']);
  });
});

describe('getUnlockedSkins', () => {
  it('returns stored skins', async () => {
    mockGetItem.mockResolvedValue(JSON.stringify(['default', 'amber']));
    expect(await getUnlockedSkins()).toEqual(['default', 'amber']);
  });

  it('returns default when nothing stored', async () => {
    mockGetItem.mockResolvedValue(null);
    expect(await getUnlockedSkins()).toEqual(['default']);
  });

  it('returns default on corrupted JSON', async () => {
    mockGetItem.mockResolvedValue('{bad');
    expect(await getUnlockedSkins()).toEqual(['default']);
  });

  it('returns default on storage error', async () => {
    mockGetItem.mockRejectedValue(new Error('fail'));
    expect(await getUnlockedSkins()).toEqual(['default']);
  });
});

describe('unlockSkin', () => {
  it('adds a new skin', async () => {
    mockGetItem.mockResolvedValue(JSON.stringify(['default']));
    await unlockSkin('amber');
    expect(mockSetItem).toHaveBeenCalledWith(
      '@sillage/runner-skins',
      JSON.stringify(['default', 'amber']),
    );
  });

  it('does not duplicate existing skin', async () => {
    mockGetItem.mockResolvedValue(JSON.stringify(['default', 'amber']));
    await unlockSkin('amber');
    expect(mockSetItem).not.toHaveBeenCalled();
  });
});

describe('unlockSkins', () => {
  it('merges multiple skins atomically', async () => {
    mockGetItem.mockResolvedValue(JSON.stringify(['default']));
    await unlockSkins(['amber', 'frost', 'noir']);
    expect(mockSetItem).toHaveBeenCalledWith(
      '@sillage/runner-skins',
      JSON.stringify(['default', 'amber', 'frost', 'noir']),
    );
  });

  it('deduplicates against existing', async () => {
    mockGetItem.mockResolvedValue(JSON.stringify(['default', 'amber']));
    await unlockSkins(['amber', 'frost']);
    expect(mockSetItem).toHaveBeenCalledWith(
      '@sillage/runner-skins',
      JSON.stringify(['default', 'amber', 'frost']),
    );
  });

  it('skips write when nothing new', async () => {
    mockGetItem.mockResolvedValue(JSON.stringify(['default', 'amber']));
    await unlockSkins(['default', 'amber']);
    expect(mockSetItem).not.toHaveBeenCalled();
  });

  it('skips empty array', async () => {
    await unlockSkins([]);
    expect(mockGetItem).not.toHaveBeenCalled();
  });
});

describe('getHighScore / setHighScore', () => {
  it('returns 0 when nothing stored', async () => {
    mockGetItem.mockResolvedValue(null);
    expect(await getHighScore()).toBe(0);
  });

  it('returns stored score', async () => {
    mockGetItem.mockResolvedValue('1234');
    expect(await getHighScore()).toBe(1234);
  });

  it('returns 0 for corrupted value', async () => {
    mockGetItem.mockResolvedValue('abc');
    expect(await getHighScore()).toBe(0);
  });

  it('returns 0 on storage error', async () => {
    mockGetItem.mockRejectedValue(new Error('fail'));
    expect(await getHighScore()).toBe(0);
  });

  it('floors and stores score', async () => {
    await setHighScore(1234.9);
    expect(mockSetItem).toHaveBeenCalledWith('@sillage/runner-highscore', '1234');
  });
});

describe('getSelectedSkinKey / setSelectedSkinKey', () => {
  it('returns null when nothing stored', async () => {
    mockGetItem.mockResolvedValue(null);
    expect(await getSelectedSkinKey()).toBeNull();
  });

  it('returns stored key', async () => {
    mockGetItem.mockResolvedValue('frost');
    expect(await getSelectedSkinKey()).toBe('frost');
  });

  it('stores key', async () => {
    await setSelectedSkinKey('noir');
    expect(mockSetItem).toHaveBeenCalledWith('@sillage/runner-selected-skin', 'noir');
  });
});

describe('getMuted / setMuted', () => {
  it('returns false when nothing stored', async () => {
    mockGetItem.mockResolvedValue(null);
    expect(await getMuted()).toBe(false);
  });

  it('returns true when stored as 1', async () => {
    mockGetItem.mockResolvedValue('1');
    expect(await getMuted()).toBe(true);
  });

  it('returns false when stored as 0', async () => {
    mockGetItem.mockResolvedValue('0');
    expect(await getMuted()).toBe(false);
  });

  it('stores 1 for muted', async () => {
    await setMuted(true);
    expect(mockSetItem).toHaveBeenCalledWith('@sillage/runner-muted', '1');
  });

  it('stores 0 for unmuted', async () => {
    await setMuted(false);
    expect(mockSetItem).toHaveBeenCalledWith('@sillage/runner-muted', '0');
  });
});
