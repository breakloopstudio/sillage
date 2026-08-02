import { renderHook, act, waitFor } from '@testing-library/react-native';

jest.mock('../../src/services/perf-votes', () => ({
  getParfumPerf: jest.fn(),
  castVote: jest.fn(),
}));

jest.mock('../../src/contexts/AuthContext', () => ({
  useAuthContext: () => ({ user: { uid: 'u1' }, isAuthenticated: true }),
}));

jest.mock('expo-router', () => ({
  useFocusEffect: (cb: () => void) => { cb(); },
}));

import { getParfumPerf, castVote } from '../../src/services/perf-votes';
import { usePerfVotes } from '../../src/hooks/usePerfVotes';
import type { ParfumPerf } from '../../src/services/perf-votes';

const mockGetPerf = getParfumPerf as jest.Mock;
const mockCastVote = castVote as jest.Mock;

function makePerf(overrides: Partial<ParfumPerf> = {}): ParfumPerf {
  return {
    longevity: { level: 3, valueLabel: 'Long', score: 2.8, fragEquiv: 80, userVotes: 5, myVote: null },
    sillage: { level: 2, valueLabel: 'Mod', score: 2.1, fragEquiv: 60, userVotes: 3, myVote: null },
    season: { spring: 10 },
    dayNight: { day: 8 },
    seasonUserVotes: 12,
    mySeason: null,
    myMoment: null,
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('usePerfVotes', () => {
  it('fetches perf on mount and sets available', async () => {
    const perf = makePerf();
    mockGetPerf.mockResolvedValue(perf);
    const { result } = renderHook(() => usePerfVotes('p1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.perf).toEqual(perf);
    expect(result.current.available).toBe(true);
    expect(mockGetPerf).toHaveBeenCalledWith('p1', 'u1');
  });

  it('sets available=false when RPC returns null', async () => {
    mockGetPerf.mockResolvedValue(null);
    const { result } = renderHook(() => usePerfVotes('p1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.perf).toBeNull();
    expect(result.current.available).toBe(false);
  });

  it('does not fetch when parfumId is null', () => {
    renderHook(() => usePerfVotes(null));
    expect(mockGetPerf).not.toHaveBeenCalled();
  });

  it('vote returns false when parfumId is null', async () => {
    const { result } = renderHook(() => usePerfVotes(null));
    let ok: boolean = true;
    await act(async () => { ok = await result.current.vote('longevity', '3'); });
    expect(ok).toBe(false);
    expect(mockCastVote).not.toHaveBeenCalled();
  });

  it('vote calls castVote then refreshes', async () => {
    const perf = makePerf();
    mockGetPerf.mockResolvedValue(perf);
    mockCastVote.mockResolvedValue(true);
    const { result } = renderHook(() => usePerfVotes('p1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    mockGetPerf.mockResolvedValue(makePerf({ longevity: { ...perf.longevity, myVote: 3 } }));
    let ok = false;
    await act(async () => { ok = await result.current.vote('longevity', '3'); });
    expect(ok).toBe(true);
    expect(mockCastVote).toHaveBeenCalledWith('p1', 'longevity', '3');
    expect(mockGetPerf).toHaveBeenCalledTimes(2);
  });

  it('removeVote delegates to vote with null', async () => {
    mockGetPerf.mockResolvedValue(makePerf());
    mockCastVote.mockResolvedValue(true);
    const { result } = renderHook(() => usePerfVotes('p1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.removeVote('sillage'); });
    expect(mockCastVote).toHaveBeenCalledWith('p1', 'sillage', null);
  });

  it('optimistic update sets myVote immediately', async () => {
    const perf = makePerf();
    mockGetPerf.mockResolvedValue(perf);
    mockCastVote.mockImplementation(() => new Promise(() => {}));
    const { result } = renderHook(() => usePerfVotes('p1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => { void result.current.vote('longevity', '4'); });
    expect(result.current.perf!.longevity.myVote).toBe(4);
    expect(result.current.perf!.longevity.userVotes).toBe(6);
  });
});
