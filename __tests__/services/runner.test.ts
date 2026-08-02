import { supabase } from '../../src/services/supabase';
import {
  submitRunnerScore, getRunnerLeaderboard, clearRunnerLeaderboardCache,
} from '../../src/services/runner';

const mockRpc = supabase.rpc as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  clearRunnerLeaderboardCache();
});

describe('submitRunnerScore', () => {
  it('floors values and sends RPC', async () => {
    mockRpc.mockResolvedValue({ data: 5, error: null });
    const rank = await submitRunnerScore({ score: 1234.9, distance: 567.8, maxCombo: 3.2, skin: 'frost' });
    expect(rank).toBe(5);
    expect(mockRpc).toHaveBeenCalledWith('submit_runner_score', {
      p_score: 1234, p_distance: 567, p_max_combo: 3, p_skin: 'frost',
    });
  });

  it('returns null when data is not a number', async () => {
    mockRpc.mockResolvedValue({ data: 'not-a-number', error: null });
    expect(await submitRunnerScore({ score: 100, distance: 50, maxCombo: 1, skin: 'default' })).toBeNull();
  });

  it('returns null on error', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'auth' } });
    expect(await submitRunnerScore({ score: 100, distance: 50, maxCombo: 1, skin: 'default' })).toBeNull();
  });
});

describe('getRunnerLeaderboard', () => {
  const row = {
    rank: 1, is_me: true, pseudo: 'jo', avatar_url: 'a.jpg',
    score: 999, distance: 450, max_combo: 4, skin: 'noir', created_at: '2026-07-01',
  };

  it('maps snake_case rows to LeaderboardEntry', async () => {
    mockRpc.mockResolvedValue({ data: [row], error: null });
    const entries = await getRunnerLeaderboard(10);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toEqual({
      rank: 1, isMe: true, pseudo: 'jo', avatarUrl: 'a.jpg',
      score: 999, distance: 450, maxCombo: 4, skin: 'noir', createdAt: '2026-07-01',
    });
    expect(mockRpc).toHaveBeenCalledWith('runner_leaderboard', { lim: 10 });
  });

  it('caches result', async () => {
    mockRpc.mockResolvedValue({ data: [row], error: null });
    await getRunnerLeaderboard();
    await getRunnerLeaderboard();
    expect(mockRpc).toHaveBeenCalledTimes(1);
  });

  it('force bypasses cache', async () => {
    mockRpc.mockResolvedValue({ data: [row], error: null });
    await getRunnerLeaderboard();
    await getRunnerLeaderboard(100, true);
    expect(mockRpc).toHaveBeenCalledTimes(2);
  });

  it('returns cached data on error', async () => {
    mockRpc.mockResolvedValue({ data: [row], error: null });
    const first = await getRunnerLeaderboard();
    mockRpc.mockResolvedValue({ data: null, error: { message: 'down' } });
    const second = await getRunnerLeaderboard(100, true);
    expect(second).toEqual(first);
  });

  it('returns empty array on error with no cache', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'down' } });
    expect(await getRunnerLeaderboard()).toEqual([]);
  });

  it('defaults skin to default when missing', async () => {
    mockRpc.mockResolvedValue({ data: [{ ...row, skin: null }], error: null });
    const entries = await getRunnerLeaderboard();
    expect(entries[0].skin).toBe('default');
  });
});

describe('clearRunnerLeaderboardCache', () => {
  it('forces refetch after clear', async () => {
    mockRpc.mockResolvedValue({ data: [], error: null });
    await getRunnerLeaderboard();
    clearRunnerLeaderboardCache();
    await getRunnerLeaderboard();
    expect(mockRpc).toHaveBeenCalledTimes(2);
  });
});
