import AsyncStorage from '@react-native-async-storage/async-storage';
import { totalNotes, todayKey, recordRun, getRunnerStats, type RunnerStats } from '../../src/features/runner/runner-stats';

const mockGetItem = AsyncStorage.getItem as jest.Mock;
const mockSetItem = AsyncStorage.setItem as jest.Mock;

const base: RunnerStats = {
  totalRuns: 0, totalDistance: 0, bestScore: 0, bestCombo: 0, bestNearMiss: 0,
  totalNearMiss: 0, totalShieldBreaks: 0, notesByType: {}, playDays: 0, lastPlayDay: '',
};

beforeEach(() => {
  mockGetItem.mockReset();
  mockSetItem.mockReset();
  mockGetItem.mockResolvedValue(null);
  mockSetItem.mockResolvedValue(undefined);
});

describe('totalNotes', () => {
  it('sums notes across types', () => {
    expect(totalNotes({ ...base, notesByType: { bergamote: 2, ambre: 3 } })).toBe(5);
  });

  it('returns 0 for an empty notebook', () => {
    expect(totalNotes(base)).toBe(0);
  });
});

describe('todayKey', () => {
  it('formats YYYY-MM-DD with zero padding', () => {
    expect(todayKey(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(todayKey(new Date(2026, 11, 25))).toBe('2026-12-25');
  });
});

describe('recordRun', () => {
  it('initializes from empty storage and counts the run', async () => {
    const stats = await recordRun({ score: 600, distance: 100, maxCombo: 3, nearMiss: 2, shieldBreaks: 1, notesByType: { ambre: 2 } });
    expect(stats.totalRuns).toBe(1);
    expect(stats.totalDistance).toBe(100);
    expect(stats.bestScore).toBe(600);
    expect(stats.bestCombo).toBe(3);
    expect(stats.notesByType.ambre).toBe(2);
    expect(stats.playDays).toBe(1);
    expect(mockSetItem).toHaveBeenCalledTimes(1);
  });

  it('merges with existing stats (cumul notes, best conservé)', async () => {
    const existing: RunnerStats = { ...base, totalRuns: 4, bestScore: 1000, notesByType: { ambre: 3 }, playDays: 2, lastPlayDay: todayKey() };
    mockGetItem.mockResolvedValue(JSON.stringify(existing));
    const stats = await recordRun({ score: 500, distance: 50, maxCombo: 2, nearMiss: 0, shieldBreaks: 0, notesByType: { ambre: 1, musc: 1 } });
    expect(stats.totalRuns).toBe(5);
    expect(stats.bestScore).toBe(1000);
    expect(stats.notesByType.ambre).toBe(4);
    expect(stats.notesByType.musc).toBe(1);
    expect(stats.playDays).toBe(2);
  });

  it('increments playDays on a new day', async () => {
    const existing: RunnerStats = { ...base, playDays: 2, lastPlayDay: '2020-01-01' };
    mockGetItem.mockResolvedValue(JSON.stringify(existing));
    const stats = await recordRun({ score: 0, distance: 0, maxCombo: 0, nearMiss: 0, shieldBreaks: 0, notesByType: {} });
    expect(stats.playDays).toBe(3);
    expect(stats.lastPlayDay).toBe(todayKey());
  });
});

describe('getRunnerStats (robustesse)', () => {
  it('returns empty stats on corrupted JSON', async () => {
    mockGetItem.mockResolvedValue('{not valid json');
    const stats = await getRunnerStats();
    expect(stats.totalRuns).toBe(0);
    expect(stats.notesByType).toEqual({});
  });
});
