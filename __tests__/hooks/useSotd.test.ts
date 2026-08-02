import { renderHook, act, waitFor } from '@testing-library/react-native';

jest.mock('../../src/services/user-parfum', () => ({
  getTodaySotd: jest.fn(),
  setSotd: jest.fn(),
}));

jest.mock('../../src/services/recap', () => ({
  getSotdStreak: jest.fn(),
}));

import { getTodaySotd, setSotd } from '../../src/services/user-parfum';
import { getSotdStreak } from '../../src/services/recap';
import { useSotd } from '../../src/hooks/useSotd';
import type { UserParfum } from '../../src/models/user-parfum.interface';

const mockGetToday = getTodaySotd as jest.Mock;
const mockSetSotd = setSotd as jest.Mock;
const mockStreak = getSotdStreak as jest.Mock;

function makeItem(overrides: Partial<UserParfum> = {}): UserParfum {
  return {
    parfumId: 'p1', status: 'have', verdict: null, rating: null, notes: null,
    triedAt: null, shelfIds: [], sotdCount: 0, isSignature: false,
    nom: 'Sauvage', marque: 'Dior', imageUrl: 'img.jpg', familleOlactive: null,
    addedAt: new Date(), updatedAt: new Date(),
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useSotd', () => {
  it('fetches sotd and streak on mount', async () => {
    mockGetToday.mockResolvedValue({ parfumId: 'p1', nom: 'Sauvage', marque: 'Dior', imageUrl: null });
    mockStreak.mockResolvedValue(5);
    const { result } = renderHook(() => useSotd('u1'));
    await waitFor(() => expect(result.current.streak).toBe(5));
    expect(result.current.sotd?.parfumId).toBe('p1');
    expect(mockGetToday).toHaveBeenCalledWith('u1');
    expect(mockStreak).toHaveBeenCalledWith('u1');
  });

  it('returns null sotd and 0 streak when uid is null', async () => {
    const { result } = renderHook(() => useSotd(null));
    await waitFor(() => expect(result.current.streak).toBe(0));
    expect(result.current.sotd).toBeNull();
    expect(mockGetToday).not.toHaveBeenCalled();
  });

  it('setTodaySotd updates optimistically', async () => {
    mockGetToday.mockResolvedValue(null);
    mockStreak.mockResolvedValue(0);
    mockSetSotd.mockResolvedValue(undefined);
    const { result } = renderHook(() => useSotd('u1'));
    await waitFor(() => expect(result.current.sotd).toBeNull());
    await act(async () => { await result.current.setTodaySotd(makeItem()); });
    expect(result.current.sotd?.parfumId).toBe('p1');
    expect(result.current.sotd?.nom).toBe('Sauvage');
    expect(mockSetSotd).toHaveBeenCalledWith('u1', 'p1', 'Sauvage', 'Dior', 'img.jpg');
  });

  it('setTodaySotd rolls back on error', async () => {
    mockGetToday.mockResolvedValue({ parfumId: 'old', nom: 'Old', marque: 'M', imageUrl: null });
    mockStreak.mockResolvedValue(3);
    mockSetSotd.mockRejectedValue(new Error('fail'));
    const { result } = renderHook(() => useSotd('u1'));
    await waitFor(() => expect(result.current.sotd?.parfumId).toBe('old'));
    await act(async () => { await result.current.setTodaySotd(makeItem()); });
    expect(result.current.sotd?.parfumId).toBe('old');
  });

  it('setTodaySotd is a no-op when uid is null', async () => {
    const { result } = renderHook(() => useSotd(null));
    await act(async () => { await result.current.setTodaySotd(makeItem()); });
    expect(mockSetSotd).not.toHaveBeenCalled();
  });

  it('refresh reloads both sotd and streak', async () => {
    mockGetToday.mockResolvedValue(null);
    mockStreak.mockResolvedValue(1);
    const { result } = renderHook(() => useSotd('u1'));
    await waitFor(() => expect(result.current.streak).toBe(1));
    mockGetToday.mockResolvedValue({ parfumId: 'p2', nom: 'N', marque: 'M', imageUrl: null });
    mockStreak.mockResolvedValue(7);
    await act(async () => { await result.current.refresh(); });
    expect(result.current.sotd?.parfumId).toBe('p2');
    expect(result.current.streak).toBe(7);
  });
});
