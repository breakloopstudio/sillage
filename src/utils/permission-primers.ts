// src/utils/permission-primers.ts — Primers de permission (just-in-time)
// Chaque permission système est précédée d'un popup explicatif, affiché une
// seule fois au moment de l'intention utilisateur. Le flag AsyncStorage
// mémorise que le primer a été vu (le prompt système part ensuite direct).
// Copy résolue via i18next à l'affichage (§23).

import AsyncStorage from '@react-native-async-storage/async-storage';
import i18next from 'i18next';

export type PermissionPrimerKey = 'camera' | 'mic' | 'location' | 'push';

const KEY_PREFIX = '@sillage/primer-';

export interface PermissionPrimerCopy {
  icon: string;
  title: string;
  message: string;
  acceptLabel: string;
}

export const PERMISSION_PRIMERS: Record<PermissionPrimerKey, PermissionPrimerCopy> = {
  camera: {
    icon: 'camera-outline',
    get title() { return i18next.t('primers.camera.title'); },
    get message() { return i18next.t('primers.camera.message'); },
    get acceptLabel() { return i18next.t('primers.camera.acceptLabel'); },
  },
  mic: {
    icon: 'mic-outline',
    get title() { return i18next.t('primers.mic.title'); },
    get message() { return i18next.t('primers.mic.message'); },
    get acceptLabel() { return i18next.t('primers.mic.acceptLabel'); },
  },
  location: {
    icon: 'location-outline',
    get title() { return i18next.t('primers.location.title'); },
    get message() { return i18next.t('primers.location.message'); },
    get acceptLabel() { return i18next.t('primers.location.acceptLabel'); },
  },
  push: {
    icon: 'notifications-outline',
    get title() { return i18next.t('primers.push.title'); },
    get message() { return i18next.t('primers.push.message'); },
    get acceptLabel() { return i18next.t('primers.push.acceptLabel'); },
  },
};

export function getPrimerReassurance(): string {
  return i18next.t('primers.reassurance');
}

export async function hasSeenPrimer(key: PermissionPrimerKey): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(KEY_PREFIX + key)) === '1';
  } catch {
    return true;
  }
}

export async function markPrimerSeen(key: PermissionPrimerKey): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY_PREFIX + key, '1');
  } catch { /* best-effort */ }
}
