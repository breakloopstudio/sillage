import { renderHook, act } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { usePermissionPrimer } from '../../src/hooks/usePermissionPrimer';

describe('usePermissionPrimer', () => {
  beforeEach(() => {
    (AsyncStorage.getItem as jest.Mock).mockClear();
    (AsyncStorage.setItem as jest.Mock).mockClear();
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
  });

  it('needsPrimer=true tant que le flag n\'est pas chargé comme vu', async () => {
    const { result } = renderHook(() => usePermissionPrimer('camera'));

    await act(async () => { await Promise.resolve(); });

    expect(result.current.needsPrimer).toBe(true);
    expect(result.current.visible).toBe(false);
  });

  it('needsPrimer=false si le primer a déjà été vu', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue('1');
    const { result } = renderHook(() => usePermissionPrimer('camera'));

    await act(async () => { await Promise.resolve(); });

    expect(result.current.needsPrimer).toBe(false);
  });

  it('open rend le primer visible', async () => {
    const { result } = renderHook(() => usePermissionPrimer('mic'));

    await act(async () => { await Promise.resolve(); });
    act(() => result.current.open());

    expect(result.current.visible).toBe(true);
  });

  it('accept ferme le primer et pose le flag', async () => {
    const { result } = renderHook(() => usePermissionPrimer('mic'));

    await act(async () => { await Promise.resolve(); });
    act(() => result.current.open());
    act(() => result.current.accept());

    expect(result.current.visible).toBe(false);
    expect(result.current.needsPrimer).toBe(false);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('@sillage/primer-mic', '1');
  });

  it('decline ferme le primer et pose le flag (pas de re-nag)', async () => {
    const { result } = renderHook(() => usePermissionPrimer('location'));

    await act(async () => { await Promise.resolve(); });
    act(() => result.current.open());
    act(() => result.current.decline());

    expect(result.current.visible).toBe(false);
    expect(result.current.needsPrimer).toBe(false);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('@sillage/primer-location', '1');
  });

  it('erreur AsyncStorage → considéré comme vu (jamais de blocage)', async () => {
    (AsyncStorage.getItem as jest.Mock).mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() => usePermissionPrimer('push'));

    await act(async () => { await Promise.resolve(); });

    expect(result.current.needsPrimer).toBe(false);
  });
});
