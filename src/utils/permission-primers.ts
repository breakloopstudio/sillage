// src/utils/permission-primers.ts — Primers de permission (just-in-time)
// Chaque permission système est précédée d'un popup explicatif, affiché une
// seule fois au moment de l'intention utilisateur. Le flag AsyncStorage
// mémorise que le primer a été vu (le prompt système part ensuite direct).

import AsyncStorage from '@react-native-async-storage/async-storage';

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
    title: 'Scanner un flacon',
    message:
      'Sillage utilise la caméra pour lire le flacon et l\'identifier dans le catalogue. La photo sert uniquement à la reconnaissance.',
    acceptLabel: 'Continuer',
  },
  mic: {
    icon: 'mic-outline',
    title: 'Recherche vocale',
    message:
      'Sillage écoute ta voix pour trouver un parfum sans taper. L\'audio sert uniquement à la recherche.',
    acceptLabel: 'Continuer',
  },
  location: {
    icon: 'location-outline',
    title: 'Météo locale',
    message:
      'Sillage utilise ta position pour afficher la météo locale et suggérer des parfums adaptés à la saison.',
    acceptLabel: 'Activer la météo',
  },
  push: {
    icon: 'notifications-outline',
    title: 'Alertes prix',
    message:
      'Reçois une notification quand le prix d\'un parfum que tu suis baisse. Tu peux désactiver les notifications à tout moment.',
    acceptLabel: 'Activer les notifications',
  },
};

export const PRIMER_REASSURANCE =
  'Tu peux changer d\'avis à tout moment dans Paramètres → Confidentialité & données.';

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
