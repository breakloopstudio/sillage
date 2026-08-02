import { supabase } from '../../src/services/supabase';
import { getParfumPerf, castVote } from '../../src/services/perf-votes';

const mockRpc = supabase.rpc as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('getParfumPerf', () => {
  it('maps snake_case RPC response to ParfumPerf', async () => {
    mockRpc.mockResolvedValue({
      data: {
        longevity: { level: 3, value_label: 'Long lasting', score: 2.8, frag_equiv: 80, user_votes: 5, my_vote: 3 },
        sillage: { level: 2, value_label: 'Moderate', score: 2.1, frag_equiv: 60, user_votes: 3, my_vote: null },
        season: { spring: 10, summer: 5 },
        day_night: { day: 8, night: 4 },
        season_user_votes: 12,
        my_season: 'spring',
        my_moment: 'day',
      },
      error: null,
    });
    const perf = await getParfumPerf('p1', 'u1');
    expect(perf).not.toBeNull();
    expect(perf!.longevity.level).toBe(3);
    expect(perf!.longevity.valueLabel).toBe('Long lasting');
    expect(perf!.longevity.fragEquiv).toBe(80);
    expect(perf!.longevity.userVotes).toBe(5);
    expect(perf!.longevity.myVote).toBe(3);
    expect(perf!.sillage.myVote).toBeNull();
    expect(perf!.season).toEqual({ spring: 10, summer: 5 });
    expect(perf!.dayNight).toEqual({ day: 8, night: 4 });
    expect(perf!.seasonUserVotes).toBe(12);
    expect(perf!.mySeason).toBe('spring');
    expect(perf!.myMoment).toBe('day');
  });

  it('handles camelCase fallback keys', async () => {
    mockRpc.mockResolvedValue({
      data: {
        longevity: { level: '2', valueLabel: 'Moderate', score: '1.9', fragEquiv: '50', userVotes: '2', myVote: null },
        sillage: {},
        season: {},
        dayNight: { day: 1 },
        seasonUserVotes: '0',
        mySeason: null,
        myMoment: null,
      },
      error: null,
    });
    const perf = await getParfumPerf('p1', null);
    expect(perf!.longevity.level).toBe(2);
    expect(perf!.longevity.valueLabel).toBe('Moderate');
    expect(perf!.longevity.fragEquiv).toBe(50);
    expect(perf!.dayNight).toEqual({ day: 1 });
  });

  it('returns null when data is null', async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });
    expect(await getParfumPerf('p1', 'u1')).toBeNull();
  });

  it('returns null on RPC error', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'boom' } });
    expect(await getParfumPerf('p1', 'u1')).toBeNull();
  });

  it('passes parfum_id and user_id to RPC', async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });
    await getParfumPerf('p42', 'u7');
    expect(mockRpc).toHaveBeenCalledWith('parfum_perf', { p_parfum_id: 'p42', p_user_id: 'u7' });
  });
});

describe('castVote', () => {
  it('returns true on success', async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });
    expect(await castVote('p1', 'longevity', '3')).toBe(true);
    expect(mockRpc).toHaveBeenCalledWith('cast_vote', { p_parfum_id: 'p1', p_dimension: 'longevity', p_value: '3' });
  });

  it('sends null value for vote removal', async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });
    await castVote('p1', 'season', null);
    expect(mockRpc).toHaveBeenCalledWith('cast_vote', { p_parfum_id: 'p1', p_dimension: 'season', p_value: null });
  });

  it('returns false on error', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'auth required' } });
    expect(await castVote('p1', 'sillage', '2')).toBe(false);
  });
});
