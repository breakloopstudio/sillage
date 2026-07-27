// src/services/impl/account.supabase.ts — Implémentation Supabase du service
// RGPD (delete via Edge Function, export via RPC, réauth, purges).
// Appelée par le dispatcher account.ts quand USE_SUPABASE=true.
// NOTE : deleteAccount nécessite l'Edge Function `delete-user-account` (Phase 3).

import { GoogleSignin } from '@react-native-google-signin/google-signin';
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';
import { supabase } from '../supabase';
import { translateSupabaseError } from '../../utils/error-translator';

export interface AccountDataSummary {
  favoris: number; wardrobe: number; scans: number;
  shelves: number; priceAlerts: number; sotdEntries: number;
}

// ─── Suppression de compte ───────────────────────────────────────────────────

export async function deleteAccount(): Promise<void> {
  try {
    const { error } = await supabase.functions.invoke('delete-user-account', { method: 'POST' });
    if (error) {
      // REAUTH_REQUIRED est signalé par la fonction via son message/statut
      if (error.message?.includes('REAUTH_REQUIRED')) throw new Error('REAUTH_REQUIRED');
      throw error;
    }
  } catch (e: unknown) {
    const err = e as Error;
    if (err.message === 'REAUTH_REQUIRED') throw err;
    throw new Error(translateSupabaseError(e) || err.message || 'Échec de la suppression.');
  }
}

export async function reauthenticate(password?: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Connexion requise.');

  const providers = (user.app_metadata?.providers as string[] | undefined) ?? [];
  const hasPassword = providers.includes('email') || password !== undefined;

  try {
    if (hasPassword) {
      if (!password || !user.email) throw new Error('Mot de passe requis.');
      // signInWithPassword = session fraîche (auth_time réinitialisé)
      const { error } = await supabase.auth.signInWithPassword({ email: user.email, password });
      if (error) throw error;
      return;
    }

    // Google : nouveau sign-in → session fraîche
    const signInResult = await GoogleSignin.signIn();
    if (signInResult.type === 'cancelled') {
      throw new Error('AUTH_CANCELLED');
    }
    const idToken = signInResult.data?.idToken;
    if (!idToken) throw new Error('Connexion Google annulée.');
    const { error } = await supabase.auth.signInWithIdToken({ provider: 'google', token: idToken });
    if (error) throw error;
  } catch (e: unknown) {
    const err = e as Error;
    if (err.message === 'AUTH_CANCELLED' || err.message === 'REAUTH_REQUIRED') throw err;
    throw new Error(translateSupabaseError(e) || err.message || 'Réauthentification échouée.');
  }
}

// ─── Export de données ───────────────────────────────────────────────────────

function formatDate(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}

export async function exportAccountData(): Promise<string> {
  const { data, error } = await supabase.rpc('export_user_data');
  if (error) throw new Error(translateSupabaseError(error));
  const json = JSON.stringify(data, null, 2);
  const filename = `parfumscan-export-${formatDate()}.json`;
  const file = new File(Paths.cache, filename);
  file.write(json);
  return file.uri;
}

export async function shareAccountData(): Promise<void> {
  const uri = await exportAccountData();
  const available = await Sharing.isAvailableAsync();
  if (!available) throw new Error('Partage non disponible sur cet appareil.');
  await Sharing.shareAsync(uri, {
    mimeType: 'application/json',
    dialogTitle: 'Exporter mes données',
    UTI: 'public.json',
  });
}

// ─── Résumé des données ──────────────────────────────────────────────────────

export async function getAccountDataSummary(uid: string): Promise<AccountDataSummary> {
  const count = async (table: string): Promise<number> => {
    try {
      const { count: n, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true })
        .eq('user_id', uid);
      if (error) return 0;
      return n ?? 0;
    } catch {
      return 0;
    }
  };
  const [favoris, wardrobe, scans, shelves, priceAlerts, sotdEntries] = await Promise.all([
    count('favoris'),
    count('user_parfum'),
    count('scans'),
    count('shelves'),
    count('price_alerts'),
    count('sotd'),
  ]);
  return { favoris, wardrobe, scans, shelves, priceAlerts, sotdEntries };
}

// ─── Suppressions ciblées ────────────────────────────────────────────────────

async function deleteAllFrom(table: string, uid: string): Promise<number> {
  try {
    const { count } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true })
      .eq('user_id', uid);
    const { error } = await supabase.from(table).delete().eq('user_id', uid);
    if (error) throw error;
    return count ?? 0;
  } catch (e: unknown) {
    console.warn(`[account] deleteAllFrom ${table} failed:`, (e as Error)?.message ?? String(e));
    return 0;
  }
}

export async function deleteAllScans(uid: string): Promise<number> {
  return deleteAllFrom('scans', uid);
}

export async function deleteAllFcmTokens(uid: string): Promise<void> {
  // La table Supabase s'appelle push_tokens (Expo Push) — nom de fonction
  // conservé pour la parité du dispatcher.
  await deleteAllFrom('push_tokens', uid);
}

export async function deleteAllPriceAlerts(uid: string): Promise<number> {
  return deleteAllFrom('price_alerts', uid);
}

export async function clearWeatherCoords(uid: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('user_settings')
      .update({ weather_lat: null, weather_lon: null } as never)
      .eq('user_id', uid);
    if (error) throw error;
  } catch (e: unknown) {
    console.warn('[account] clearWeatherCoords failed:', (e as Error)?.message ?? String(e));
  }
}
