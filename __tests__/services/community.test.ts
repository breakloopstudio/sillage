import { supabase } from '../../src/services/supabase';
import {
  getCommunityHighlights, getSotdCommunityToday, clearCommunityCache,
  getParfumVerdicts, followByPseudo, unfollowByPseudo, isFollowing,
  getPublicFollowers, getPublicFollowing, getFollowedHighlights, searchProfiles,
} from '../../src/services/community';

const mockRpc = supabase.rpc as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  clearCommunityCache();
});

describe('getCommunityHighlights', () => {
  it('maps RPC data with toNum coercion', async () => {
    mockRpc.mockResolvedValue({
      data: {
        top_loved: [{ parfum_id: 'p1', nom: 'N', marque: 'M', image_url: null, famille_olfactive: null, best_price: '89.99', love_count: '12' }],
        trending: [],
        public_profiles: [{ pseudo: 'jo', avatar_url: null, bio: null, collection_count: '5', top_images: [] }],
      },
      error: null,
    });
    const result = await getCommunityHighlights();
    expect(result.top_loved[0].best_price).toBe(89.99);
    expect(result.top_loved[0].love_count).toBe(12);
    expect(result.public_profiles[0].collection_count).toBe(5);
  });

  it('returns cached data on second call without re-fetching', async () => {
    mockRpc.mockResolvedValue({ data: { top_loved: [], trending: [], public_profiles: [] }, error: null });
    await getCommunityHighlights();
    await getCommunityHighlights();
    expect(mockRpc).toHaveBeenCalledTimes(1);
  });

  it('deduplicates concurrent calls', async () => {
    mockRpc.mockResolvedValue({ data: { top_loved: [], trending: [], public_profiles: [] }, error: null });
    const [r1, r2] = await Promise.all([getCommunityHighlights(), getCommunityHighlights()]);
    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(r1).toBe(r2);
  });

  it('throws on RPC error', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'boom' } });
    await expect(getCommunityHighlights()).rejects.toBeTruthy();
  });

  it('handles null data gracefully', async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });
    const result = await getCommunityHighlights();
    expect(result.top_loved).toEqual([]);
    expect(result.trending).toEqual([]);
    expect(result.public_profiles).toEqual([]);
  });
});

describe('getSotdCommunityToday', () => {
  it('returns rows from RPC', async () => {
    const rows = [{ pseudo: 'jo', avatar_url: null, parfum_id: 'p1', nom: 'N', marque: 'M', image_url: null }];
    mockRpc.mockResolvedValue({ data: rows, error: null });
    const result = await getSotdCommunityToday();
    expect(result).toEqual(rows);
  });

  it('caches result', async () => {
    mockRpc.mockResolvedValue({ data: [], error: null });
    await getSotdCommunityToday();
    await getSotdCommunityToday();
    expect(mockRpc).toHaveBeenCalledTimes(1);
  });
});

describe('clearCommunityCache', () => {
  it('forces refetch after clear', async () => {
    mockRpc.mockResolvedValue({ data: { top_loved: [], trending: [], public_profiles: [] }, error: null });
    await getCommunityHighlights();
    clearCommunityCache();
    await getCommunityHighlights();
    expect(mockRpc).toHaveBeenCalledTimes(2);
  });
});

describe('getParfumVerdicts', () => {
  it('filters out null verdicts and maps rows', async () => {
    mockRpc.mockResolvedValue({
      data: [
        { pseudo: 'a', avatar_url: null, verdict: 'love' },
        { pseudo: 'b', avatar_url: null, verdict: null },
      ],
      error: null,
    });
    const result = await getParfumVerdicts('p1');
    expect(result).toHaveLength(1);
    expect(result[0].pseudo).toBe('a');
    expect(mockRpc).toHaveBeenCalledWith('parfum_verdicts', { p_parfum_id: 'p1' });
  });

  it('returns empty array on error', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'fail' } });
    expect(await getParfumVerdicts('p1')).toEqual([]);
  });
});

describe('follow / unfollow', () => {
  it('followByPseudo calls RPC with pseudo', async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });
    await followByPseudo('jo');
    expect(mockRpc).toHaveBeenCalledWith('follow_by_pseudo', { p_pseudo: 'jo' });
  });

  it('followByPseudo throws on error', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'taken' } });
    await expect(followByPseudo('jo')).rejects.toBeTruthy();
  });

  it('unfollowByPseudo calls RPC', async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });
    await unfollowByPseudo('jo');
    expect(mockRpc).toHaveBeenCalledWith('unfollow_by_pseudo', { p_pseudo: 'jo' });
  });
});

describe('isFollowing', () => {
  it('returns true when data is true', async () => {
    mockRpc.mockResolvedValue({ data: true, error: null });
    expect(await isFollowing('jo')).toBe(true);
  });

  it('returns false when data is false', async () => {
    mockRpc.mockResolvedValue({ data: false, error: null });
    expect(await isFollowing('jo')).toBe(false);
  });

  it('returns false on error', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'fail' } });
    expect(await isFollowing('jo')).toBe(false);
  });
});

describe('getPublicFollowers / getPublicFollowing', () => {
  it('maps follower rows', async () => {
    mockRpc.mockResolvedValue({ data: [{ pseudo: 'a', avatar_url: 'x.jpg' }], error: null });
    const result = await getPublicFollowers('jo', 10);
    expect(result).toEqual([{ pseudo: 'a', avatar_url: 'x.jpg' }]);
    expect(mockRpc).toHaveBeenCalledWith('public_followers', { p_pseudo: 'jo', lim: 10 });
  });

  it('returns empty on error', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'fail' } });
    expect(await getPublicFollowers('jo')).toEqual([]);
    expect(await getPublicFollowing('jo')).toEqual([]);
  });
});

describe('getFollowedHighlights', () => {
  it('maps composite data', async () => {
    mockRpc.mockResolvedValue({
      data: { sotd_today: [{ pseudo: 'a' }], recent_verdicts: [], new_have: [] },
      error: null,
    });
    const result = await getFollowedHighlights();
    expect(result).not.toBeNull();
    expect(result!.sotd_today).toHaveLength(1);
  });

  it('returns null on error', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'fail' } });
    expect(await getFollowedHighlights()).toBeNull();
  });
});

describe('searchProfiles', () => {
  it('maps with toNum on collection_count', async () => {
    mockRpc.mockResolvedValue({ data: [{ pseudo: 'jo', avatar_url: null, collection_count: '7' }], error: null });
    const result = await searchProfiles('jo', 5);
    expect(result[0].collection_count).toBe(7);
    expect(mockRpc).toHaveBeenCalledWith('search_profiles', { p_prefix: 'jo', lim: 5 });
  });

  it('returns empty on error', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'fail' } });
    expect(await searchProfiles('x')).toEqual([]);
  });
});
