import { renderHook, act, waitFor } from '@testing-library/react-native';

jest.mock('../../src/services/community', () => ({
  getCommunityHighlights: jest.fn(),
  getSotdCommunityToday: jest.fn(),
  clearCommunityCache: jest.fn(),
}));

import {
  getCommunityHighlights, getSotdCommunityToday, clearCommunityCache,
} from '../../src/services/community';
import { useCommunityHighlights } from '../../src/hooks/useCommunityHighlights';

const mockHighlights = getCommunityHighlights as jest.Mock;
const mockSotd = getSotdCommunityToday as jest.Mock;
const mockClear = clearCommunityCache as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useCommunityHighlights', () => {
  it('loads highlights and sotd on mount', async () => {
    const hl = { top_loved: [{ parfum_id: 'p1' }], trending: [], public_profiles: [] };
    mockHighlights.mockResolvedValue(hl);
    mockSotd.mockResolvedValue([{ pseudo: 'jo', parfum_id: 'p2' }]);
    const { result } = renderHook(() => useCommunityHighlights());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.top_loved).toHaveLength(1);
    expect(result.current.sotd_today).toHaveLength(1);
    expect(result.current.error).toBeNull();
  });

  it('sets error when highlights fail but sotd still loads', async () => {
    mockHighlights.mockRejectedValue(new Error('down'));
    mockSotd.mockResolvedValue([{ pseudo: 'a' }]);
    const { result } = renderHook(() => useCommunityHighlights());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('Impossible de charger la communauté.');
    expect(result.current.sotd_today).toHaveLength(1);
    expect(result.current.top_loved).toEqual([]);
  });

  it('sotd failure is non-blocking (no error set)', async () => {
    mockHighlights.mockResolvedValue({ top_loved: [], trending: [], public_profiles: [] });
    mockSotd.mockRejectedValue(new Error('sotd down'));
    const { result } = renderHook(() => useCommunityHighlights());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBeNull();
    expect(result.current.sotd_today).toEqual([]);
  });

  it('refresh clears cache and refetches', async () => {
    mockHighlights.mockResolvedValue({ top_loved: [], trending: [], public_profiles: [] });
    mockSotd.mockResolvedValue([]);
    const { result } = renderHook(() => useCommunityHighlights());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { result.current.refresh(); });
    expect(mockClear).toHaveBeenCalled();
    await waitFor(() => expect(mockHighlights).toHaveBeenCalledTimes(2));
  });

  it('starts with loading=true', () => {
    mockHighlights.mockReturnValue(new Promise(() => {}));
    mockSotd.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useCommunityHighlights());
    expect(result.current.loading).toBe(true);
  });
});
