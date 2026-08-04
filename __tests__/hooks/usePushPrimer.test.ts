import { renderHook, act } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { usePushPrimer } from '../../src/hooks/usePushPrimer';
import { getPushPermissionStatus, requestFcmPermission, registerPushToken } from '../../src/services/push';
import { updateUserSetting } from '../../src/services/user-data';

jest.mock('../../src/services/push', () => ({
  getPushPermissionStatus: jest.fn(),
  requestFcmPermission: jest.fn(),
  registerPushToken: jest.fn(),
}));

jest.mock('../../src/services/user-data', () => ({
  updateUserSetting: jest.fn(() => Promise.resolve()),
  getUserSettings: jest.fn(),
}));

import { getUserSettings } from '../../src/services/user-data';

const UID = 'user-123';

describe('usePushPrimer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (AsyncStorage.getItem as jest.Mock).mockClear();
    (AsyncStorage.setItem as jest.Mock).mockClear();
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (getPushPermissionStatus as jest.Mock).mockResolvedValue('undetermined');
    (requestFcmPermission as jest.Mock).mockResolvedValue(true);
    (registerPushToken as jest.Mock).mockResolvedValue(undefined);
    (getUserSettings as jest.Mock).mockResolvedValue({ priceAlerts: false, pushNotifs: true, weatherNotifs: false });
  });

  it('ne fait rien sans uid', async () => {
    const { result } = renderHook(() => usePushPrimer(null));
    await act(async () => { await result.current.propose(); });
    expect(result.current.visible).toBe(false);
  });

  it('n\'ouvre pas le primer s\'il a déjà été vu', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue('1');
    const { result } = renderHook(() => usePushPrimer(UID));
    await act(async () => { await result.current.propose(); });
    expect(result.current.visible).toBe(false);
  });

  it('n\'ouvre pas le primer si la permission est déjà accordée (pose le flag)', async () => {
    (getPushPermissionStatus as jest.Mock).mockResolvedValue('granted');
    const { result } = renderHook(() => usePushPrimer(UID));
    await act(async () => { await result.current.propose(); });
    expect(result.current.visible).toBe(false);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('@sillage/primer-push', '1');
  });

  it('ouvre le primer si permission non décidée et primer jamais vu', async () => {
    const { result } = renderHook(() => usePushPrimer(UID));
    await act(async () => { await result.current.propose(); });
    expect(result.current.visible).toBe(true);
  });

  it('n\'ouvre pas le primer si l\'utilisateur a désactivé les push (retrait explicite)', async () => {
    (getUserSettings as jest.Mock).mockResolvedValue({ priceAlerts: false, pushNotifs: false, weatherNotifs: false });
    const { result } = renderHook(() => usePushPrimer(UID));
    await act(async () => { await result.current.propose(); });
    expect(result.current.visible).toBe(false);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('@sillage/primer-push', '1');
  });

  it('accept : prompt système + enregistrement token + réglage pushNotifs', async () => {
    const { result } = renderHook(() => usePushPrimer(UID));
    await act(async () => { await result.current.propose(); });

    await act(async () => { result.current.accept(); await Promise.resolve(); await Promise.resolve(); });

    expect(result.current.visible).toBe(false);
    expect(requestFcmPermission).toHaveBeenCalled();
    expect(registerPushToken).toHaveBeenCalledWith(UID);
    expect(updateUserSetting).toHaveBeenCalledWith(UID, 'pushNotifs', true);
  });

  it('accept : pas d\'enregistrement si le prompt système est refusé', async () => {
    (requestFcmPermission as jest.Mock).mockResolvedValue(false);
    const { result } = renderHook(() => usePushPrimer(UID));
    await act(async () => { await result.current.propose(); });

    await act(async () => { result.current.accept(); await Promise.resolve(); await Promise.resolve(); });

    expect(registerPushToken).not.toHaveBeenCalled();
    expect(updateUserSetting).not.toHaveBeenCalled();
  });

  it('decline ferme et pose le flag', async () => {
    const { result } = renderHook(() => usePushPrimer(UID));
    await act(async () => { await result.current.propose(); });

    act(() => result.current.decline());

    expect(result.current.visible).toBe(false);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('@sillage/primer-push', '1');
  });
});
