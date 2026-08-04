import {
  getPushPermissionStatus,
  requestFcmPermission,
  registerPushToken,
  startFcmRegistration,
} from '../../src/services/impl/push.supabase';
import * as Notifications from 'expo-notifications';
import { supabase } from '../../src/services/supabase';

jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  getExpoPushTokenAsync: jest.fn(),
  addPushTokenListener: jest.fn(() => ({ remove: jest.fn() })),
  setNotificationChannelAsync: jest.fn(),
  AndroidImportance: { HIGH: 5 },
}));

jest.mock('expo-constants', () => ({
  expoConfig: { extra: { eas: { projectId: 'proj-1' } } },
}));

describe('getPushPermissionStatus', () => {
  beforeEach(() => jest.clearAllMocks());

  it('mappe granted', async () => {
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });
    expect(await getPushPermissionStatus()).toBe('granted');
  });

  it('mappe denied', async () => {
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'denied' });
    expect(await getPushPermissionStatus()).toBe('denied');
  });

  it('mappe tout le reste en undetermined', async () => {
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'undetermined' });
    expect(await getPushPermissionStatus()).toBe('undetermined');
  });

  it('retourne unknown en cas d\'erreur', async () => {
    (Notifications.getPermissionsAsync as jest.Mock).mockRejectedValue(new Error('boom'));
    expect(await getPushPermissionStatus()).toBe('unknown');
  });
});

describe('requestFcmPermission', () => {
  beforeEach(() => jest.clearAllMocks());

  it('retourne true si accordé', async () => {
    (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });
    expect(await requestFcmPermission()).toBe(true);
  });

  it('retourne false si refusé', async () => {
    (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'denied' });
    expect(await requestFcmPermission()).toBe(false);
  });
});

describe('startFcmRegistration — jamais de prompt à froid', () => {
  beforeEach(() => jest.clearAllMocks());

  it('ne demande JAMAIS la permission (pas de requestPermissionsAsync)', async () => {
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'undetermined' });
    const cleanup = startFcmRegistration('u1');
    await Promise.resolve();
    await Promise.resolve();
    expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
    cleanup();
  });

  it('n\'enregistre pas de token si la permission n\'est pas accordée', async () => {
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'denied' });
    const cleanup = startFcmRegistration('u1');
    await Promise.resolve();
    await Promise.resolve();
    expect(Notifications.getExpoPushTokenAsync).not.toHaveBeenCalled();
    cleanup();
  });

  it('enregistre le token si la permission est déjà accordée', async () => {
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });
    (Notifications.getExpoPushTokenAsync as jest.Mock).mockResolvedValue({ data: 'tok-abc' });
    const cleanup = startFcmRegistration('u1');
    await new Promise(r => setTimeout(r, 10));
    expect(Notifications.getExpoPushTokenAsync).toHaveBeenCalled();
    cleanup();
  });
});

describe('registerPushToken', () => {
  beforeEach(() => jest.clearAllMocks());

  it('upsert le token dans push_tokens', async () => {
    (Notifications.getExpoPushTokenAsync as jest.Mock).mockResolvedValue({ data: 'tok-xyz' });
    await registerPushToken('u2');
    expect(Notifications.getExpoPushTokenAsync).toHaveBeenCalled();
  });

  it('ne fait rien si le token est indisponible', async () => {
    (Notifications.getExpoPushTokenAsync as jest.Mock).mockResolvedValue({ data: null });
    await expect(registerPushToken('u2')).resolves.toBeUndefined();
  });
});
