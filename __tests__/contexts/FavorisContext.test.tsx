import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react-native';

const mockUseAuth = jest.fn().mockReturnValue({ user: { uid: 'u1' }, isAuthenticated: true });
jest.mock('../../src/contexts/AuthContext', () => ({
  useAuthContext: (...args: unknown[]) => mockUseAuth(...args),
}));

jest.mock('../../src/services/user-data', () => ({
  onFavoris: jest.fn(),
  addFavori: jest.fn(),
  removeFavori: jest.fn(),
}));

import { onFavoris, addFavori, removeFavori } from '../../src/services/user-data';
import { FavorisProvider, useFavorisContext } from '../../src/contexts/FavorisContext';
import type { UserFavori, Parfum } from '../../src/models';

const mockOnFavoris = onFavoris as jest.Mock;
const mockAdd = addFavori as jest.Mock;
const mockRemove = removeFavori as jest.Mock;

const parfum = {
  id: 'p1', nom: 'Sauvage', marque: 'Dior', imageUrl: 'img.jpg',
  familleOlactive: 'woody', bestPrice: 89, referencePrice: 120, annee: 2015,
  notesTete: [], notesCoeur: [], notesFond: [],
  createdAt: new Date(), updatedAt: new Date(),
} as Parfum;

function makeFav(parfumId: string): UserFavori {
  return {
    id: parfumId, parfumId, nom: 'Test', marque: 'Brand',
    imageUrl: null, familleOlactive: null, bestPrice: undefined,
    referencePrice: undefined, annee: undefined, addedAt: new Date(),
  };
}

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <FavorisProvider>{children}</FavorisProvider>
);

beforeEach(() => {
  jest.clearAllMocks();
  mockUseAuth.mockReturnValue({ user: { uid: 'u1' }, isAuthenticated: true });
});

describe('FavorisContext', () => {
  it('provides empty favoris and no subscription when uid is null', () => {
    mockUseAuth.mockReturnValue({ user: null, isAuthenticated: false });
    const { result } = renderHook(() => useFavorisContext(), { wrapper });
    expect(result.current.favoris).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(mockOnFavoris).not.toHaveBeenCalled();
  });

  it('subscribes and provides favoris when uid is set', async () => {
    mockOnFavoris.mockImplementation((_uid: string, cb: (f: UserFavori[]) => void) => {
      cb([makeFav('p1'), makeFav('p2')]);
      return () => {};
    });
    const { result } = renderHook(() => useFavorisContext(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.favoris).toHaveLength(2);
    expect(mockOnFavoris).toHaveBeenCalledWith('u1', expect.any(Function));
  });

  it('isFav returns correct membership', async () => {
    mockOnFavoris.mockImplementation((_uid: string, cb: (f: UserFavori[]) => void) => {
      cb([makeFav('p1')]);
      return () => {};
    });
    const { result } = renderHook(() => useFavorisContext(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.isFav('p1')).toBe(true);
    expect(result.current.isFav('p99')).toBe(false);
  });

  it('toggleFav adds optimistically', async () => {
    mockOnFavoris.mockImplementation((_uid: string, cb: (f: UserFavori[]) => void) => {
      cb([]);
      return () => {};
    });
    mockAdd.mockResolvedValue('p1');
    const { result } = renderHook(() => useFavorisContext(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => { result.current.toggleFav(parfum); });
    expect(result.current.favoris).toHaveLength(1);
    expect(result.current.favoris[0].parfumId).toBe('p1');
    expect(result.current.isFav('p1')).toBe(true);
  });

  it('toggleFav removes optimistically', async () => {
    mockOnFavoris.mockImplementation((_uid: string, cb: (f: UserFavori[]) => void) => {
      cb([makeFav('p1')]);
      return () => {};
    });
    mockRemove.mockResolvedValue(undefined);
    const { result } = renderHook(() => useFavorisContext(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => { result.current.toggleFav(parfum); });
    expect(result.current.favoris).toHaveLength(0);
    expect(mockRemove).toHaveBeenCalledWith('u1', 'p1');
  });

  it('toggleFav rolls back on add error', async () => {
    mockOnFavoris.mockImplementation((_uid: string, cb: (f: UserFavori[]) => void) => {
      cb([]);
      return () => {};
    });
    mockAdd.mockRejectedValue(new Error('fail'));
    const { result } = renderHook(() => useFavorisContext(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => { result.current.toggleFav(parfum); });
    expect(result.current.favoris).toHaveLength(1);
    await waitFor(() => expect(result.current.favoris).toHaveLength(0));
  });

  it('toggleFav rolls back on remove error', async () => {
    mockOnFavoris.mockImplementation((_uid: string, cb: (f: UserFavori[]) => void) => {
      cb([makeFav('p1')]);
      return () => {};
    });
    mockRemove.mockRejectedValue(new Error('fail'));
    const { result } = renderHook(() => useFavorisContext(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => { result.current.toggleFav(parfum); });
    expect(result.current.favoris).toHaveLength(0);
    await waitFor(() => expect(result.current.favoris).toHaveLength(1));
    expect(result.current.favoris[0].parfumId).toBe('p1');
  });

  it('removeFavori removes and rolls back on error', async () => {
    mockOnFavoris.mockImplementation((_uid: string, cb: (f: UserFavori[]) => void) => {
      cb([makeFav('p1')]);
      return () => {};
    });
    mockRemove.mockRejectedValue(new Error('fail'));
    const { result } = renderHook(() => useFavorisContext(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => { result.current.removeFavori('p1'); });
    expect(result.current.favoris).toHaveLength(0);
    await waitFor(() => expect(result.current.favoris).toHaveLength(1));
  });

  it('useFavorisContext throws outside provider', () => {
    expect(() => {
      renderHook(() => useFavorisContext());
    }).toThrow('useFavorisContext must be used within FavorisProvider');
  });

  it('unsubscribes on unmount', async () => {
    const unsub = jest.fn();
    mockOnFavoris.mockImplementation(() => unsub);
    const { unmount } = renderHook(() => useFavorisContext(), { wrapper });
    unmount();
    expect(unsub).toHaveBeenCalled();
  });
});
