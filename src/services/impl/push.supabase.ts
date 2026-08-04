// src/services/impl/push.supabase.ts — Expo Push Notifications (remplace FCM)
// Appelée par le dispatcher push.ts quand USE_SUPABASE=true.
// NOTE : nécessite le plugin expo-notifications configuré dans app.json
// (ajouté au moment du cutover USE_SUPABASE=true).

import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import i18next from 'i18next';
import { supabase } from '../supabase';

// projectId Expo (injecté par `eas init` dans app.json → extra.eas.projectId).
// Requis pour générer un token push fiable sur un build natif / dev client.
function getProjectId(): string | undefined {
  const extra = Constants.expoConfig?.extra as Record<string, unknown> | undefined;
  const eas = extra?.eas as Record<string, unknown> | undefined;
  return typeof eas?.projectId === 'string' ? eas.projectId : undefined;
}

export async function requestFcmPermission(): Promise<boolean> {
  try {
    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
  } catch (e) {
    console.warn('[push] requestPermission failed:', e);
    return false;
  }
}

export type PushPermissionStatus = 'granted' | 'denied' | 'undetermined' | 'unknown';

// Lecture silencieuse du statut OS (jamais de prompt) — permet à l'UI de
// refléter le vrai état (ex. toggle Settings resté ON après un refus OS).
export async function getPushPermissionStatus(): Promise<PushPermissionStatus> {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status === 'granted') return 'granted';
    if (status === 'denied') return 'denied';
    return 'undetermined';
  } catch (e) {
    console.warn('[push] getPermissions failed:', e);
    return 'unknown';
  }
}

export async function getFcmToken(): Promise<string | null> {
  try {
    const projectId = getProjectId();
    const { data } = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    return data;
  } catch (e) {
    console.warn('[push] getFcmToken failed:', e);
    return null;
  }
}

export function onFcmTokenRefresh(cb: (token: string) => void): () => void {
  const sub = Notifications.addPushTokenListener(({ data }) => { cb(data); });
  return sub.remove;
}

export async function deleteFcmToken(): Promise<void> {
  // Expo Push n'expose pas de suppression de token côté client.
  // Les tokens obsolètes sont nettoyés côté Edge Function (receipts).
}

export async function createNotificationChannels(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    await Notifications.setNotificationChannelAsync('weather_suggestions', {
      name: i18next.t('push.channelWeather'),
      importance: Notifications.AndroidImportance.HIGH,
    });
    await Notifications.setNotificationChannelAsync('price_alerts', {
      name: i18next.t('push.channelPrice'),
      importance: Notifications.AndroidImportance.HIGH,
    });
  } catch (e: unknown) {
    console.warn('[push] createNotificationChannels failed:', (e as Error)?.message ?? String(e));
  }
}

// ─── DB (table push_tokens) ──────────────────────────────────────────────────

async function saveTokenToDB(uid: string, token: string): Promise<void> {
  try {
    const { error } = await supabase.from('push_tokens').upsert({
      user_id: uid,
      token,
      platform: Platform.OS,
      created_at: new Date().toISOString(),
    }, { onConflict: 'user_id,token' });
    if (error) console.warn('[push] saveTokenToDB error:', error.message);
  } catch (e: unknown) {
    console.warn('[push] saveTokenToDB failed:', (e as Error)?.message ?? String(e));
  }
}

async function removeOldTokens(uid: string, currentToken: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('push_tokens')
      .delete()
      .eq('user_id', uid)
      .neq('token', currentToken);
    if (error) console.warn('[push] removeOldTokens error:', error.message);
  } catch (e: unknown) {
    console.warn('[push] removeOldTokens failed:', (e as Error)?.message ?? String(e));
  }
}

// Enregistrement one-shot du token (après octroi explicite via primer ou
// toggle Settings) — ne demande JAMAIS la permission elle-même.
export async function registerPushToken(uid: string): Promise<void> {
  try {
    const token = await getFcmToken();
    if (!token) return;
    await saveTokenToDB(uid, token);
    await removeOldTokens(uid, token);
  } catch (e: unknown) {
    console.warn('[push] registerPushToken failed:', (e as Error)?.message ?? String(e));
  }
}

// Ré-enregistrement au lancement : uniquement si la permission OS est DÉJÀ
// accordée (jamais de prompt à froid). La demande part des moments de valeur
// (1ère alerte prix, toggle Settings) via requestFcmPermission + registerPushToken.
export function startFcmRegistration(uid: string): () => void {
  let cancelled = false;

  async function register(initial: boolean) {
    if (cancelled) return;
    const status = await getPushPermissionStatus();
    if (status !== 'granted' || cancelled) return;
    const token = await getFcmToken();
    if (!token || cancelled) return;
    await saveTokenToDB(uid, token);
    if (!initial) return;
    await removeOldTokens(uid, token);
  }

  void register(true);

  const unsubRefresh = onFcmTokenRefresh((newToken) => {
    if (cancelled) return;
    void saveTokenToDB(uid, newToken);
  });

  return () => {
    cancelled = true;
    unsubRefresh();
  };
}
