import { renderHook, act, waitFor } from '@testing-library/react-native';

jest.mock('../../src/services/user-parfum', () => ({
  addUserParfum: jest.fn(),
  updateUserParfum: jest.fn(),
  markTried: jest.fn(),
  removeUserParfum: jest.fn(),
  getUserParfum: jest.fn(),
}));

jest.mock('../../src/services/possessions', () => ({
  addPossession: jest.fn(),
}));

jest.mock('../../src/services/haptics', () => ({
  hapticsLight: jest.fn(),
}));

jest.mock('../../src/contexts/AuthContext', () => ({
  useAuthContext: () => ({ user: { uid: 'u1' }, isAuthenticated: true }),
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

import {
  addUserParfum, updateUserParfum, markTried, removeUserParfum, getUserParfum,
} from '../../src/services/user-parfum';
import { addPossession } from '../../src/services/possessions';
import { useSaveController, statusLabel } from '../../src/features/catalog/useSaveController';
import type { Parfum } from '../../src/models';
import type { UserParfum } from '../../src/models/user-parfum.interface';

const mockGetUserParfum = getUserParfum as jest.Mock;
const mockAdd = addUserParfum as jest.Mock;
const mockUpdate = updateUserParfum as jest.Mock;
const mockMarkTried = markTried as jest.Mock;
const mockRemove = removeUserParfum as jest.Mock;
const mockAddPoss = addPossession as jest.Mock;

const parfum = {
  id: 'p1', nom: 'Sauvage', marque: 'Dior', imageUrl: 'img.jpg',
  familleOlactive: 'woody', notesTete: [], notesCoeur: [], notesFond: [],
  createdAt: new Date(), updatedAt: new Date(),
} as Parfum;

function makeItem(overrides: Partial<UserParfum> = {}): UserParfum {
  return {
    parfumId: 'p1', status: 'have', verdict: null, rating: null, notes: null,
    triedAt: null, shelfIds: [], sotdCount: 0, isSignature: false,
    nom: 'Sauvage', marque: 'Dior', imageUrl: 'img.jpg', familleOlactive: 'woody',
    addedAt: new Date(), updatedAt: new Date(),
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('statusLabel', () => {
  it('maps statuses to French labels', () => {
    expect(statusLabel('to_try')).toBe('À sentir');
    expect(statusLabel('have')).toBe('Je l\u2019ai');
    expect(statusLabel('had')).toBe('Je l\u2019ai eu');
    expect(statusLabel('tried')).toBe('Senti');
  });
});

describe('useSaveController', () => {
  it('fetches existing user_parfum on mount', async () => {
    const item = makeItem();
    mockGetUserParfum.mockResolvedValue(item);
    const { result } = renderHook(() => useSaveController(parfum));
    await waitFor(() => expect(result.current.item).not.toBeNull());
    expect(result.current.item!.status).toBe('have');
    expect(mockGetUserParfum).toHaveBeenCalledWith('u1', 'p1');
  });

  it('item is null when parfum is null', () => {
    const { result } = renderHook(() => useSaveController(null));
    expect(result.current.item).toBeNull();
    expect(mockGetUserParfum).not.toHaveBeenCalled();
  });

  it('setStatus creates new item optimistically when none exists', async () => {
    mockGetUserParfum.mockResolvedValue(null);
    mockAdd.mockResolvedValue(undefined);
    const { result } = renderHook(() => useSaveController(parfum));
    await waitFor(() => expect(mockGetUserParfum).toHaveBeenCalled());
    await act(async () => { await result.current.setStatus('want'); });
    expect(result.current.item!.status).toBe('want');
    expect(result.current.item!.parfumId).toBe('p1');
    expect(mockAdd).toHaveBeenCalledWith('u1', 'p1', 'want', parfum);
  });

  it('setStatus updates existing item', async () => {
    mockGetUserParfum.mockResolvedValue(makeItem({ status: 'have' }));
    mockUpdate.mockResolvedValue(undefined);
    const { result } = renderHook(() => useSaveController(parfum));
    await waitFor(() => expect(result.current.item).not.toBeNull());
    await act(async () => { await result.current.setStatus('had'); });
    expect(result.current.item!.status).toBe('had');
    expect(mockUpdate).toHaveBeenCalledWith('u1', 'p1', { status: 'had' });
  });

  it('remove clears item and calls service', async () => {
    mockGetUserParfum.mockResolvedValue(makeItem());
    mockRemove.mockResolvedValue(undefined);
    const { result } = renderHook(() => useSaveController(parfum));
    await waitFor(() => expect(result.current.item).not.toBeNull());
    await act(async () => { result.current.remove(); });
    expect(result.current.item).toBeNull();
    expect(mockRemove).toHaveBeenCalledWith('u1', 'p1');
  });

  it('saveLabel shows verdict for tried items', async () => {
    mockGetUserParfum.mockResolvedValue(makeItem({ status: 'tried', verdict: 'love' }));
    const { result } = renderHook(() => useSaveController(parfum));
    await waitFor(() => expect(result.current.item).not.toBeNull());
    expect(result.current.saveLabel).toBe('Coup de cœur');
  });

  it('saveLabel is null when no item', () => {
    mockGetUserParfum.mockResolvedValue(null);
    const { result } = renderHook(() => useSaveController(parfum));
    expect(result.current.saveLabel).toBeNull();
  });

  it('toggleShelf adds and removes shelf id', async () => {
    mockGetUserParfum.mockResolvedValue(makeItem({ shelfIds: ['s1'] }));
    mockUpdate.mockResolvedValue(undefined);
    const { result } = renderHook(() => useSaveController(parfum));
    await waitFor(() => expect(result.current.item).not.toBeNull());
    await act(async () => { result.current.toggleShelf('s2'); });
    expect(result.current.item!.shelfIds).toEqual(['s1', 's2']);
    await act(async () => { result.current.toggleShelf('s1'); });
    expect(result.current.item!.shelfIds).toEqual(['s2']);
  });

  it('toggleSignature flips isSignature', async () => {
    mockGetUserParfum.mockResolvedValue(makeItem({ isSignature: false }));
    mockUpdate.mockResolvedValue(undefined);
    const { result } = renderHook(() => useSaveController(parfum));
    await waitFor(() => expect(result.current.item).not.toBeNull());
    await act(async () => { result.current.toggleSignature(); });
    expect(result.current.item!.isSignature).toBe(true);
    expect(mockUpdate).toHaveBeenCalledWith('u1', 'p1', { isSignature: true });
  });

  it('addPoss sets status to have when currently to_try', async () => {
    mockGetUserParfum.mockResolvedValue(makeItem({ status: 'to_try' }));
    mockAddPoss.mockResolvedValue('poss-1');
    mockUpdate.mockResolvedValue(undefined);
    const { result } = renderHook(() => useSaveController(parfum));
    await waitFor(() => expect(result.current.item).not.toBeNull());
    await act(async () => { await result.current.addPoss('bottle', 100); });
    expect(mockAddPoss).toHaveBeenCalledWith('u1', 'p1', 'bottle', 100);
    expect(result.current.item!.status).toBe('have');
  });
});
