// supabase/functions/_shared/expo-push.ts — Envoi push via Expo Push API
// Remplace FCM — les tokens sont de la forme ExponentPushToken[...]

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const BATCH_SIZE = 100;

interface PushReceipt {
  status: 'ok' | 'error';
  details?: { error?: 'DeviceNotRegistered' | string };
}

/**
 * Envoie une notification push à une liste de tokens Expo.
 * Retourne le nombre de succès et les indices des tokens morts (DeviceNotRegistered).
 */
export async function sendPush(
  tokens: string[],
  title: string,
  body: string,
  data?: Record<string, string>,
): Promise<{ successCount: number; deadTokens: string[] }> {
  if (tokens.length === 0) return { successCount: 0, deadTokens: [] };

  const accessToken = Deno.env.get('EXPO_ACCESS_TOKEN');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

  let successCount = 0;
  const deadTokens: string[] = [];

  for (let i = 0; i < tokens.length; i += BATCH_SIZE) {
    const batch = tokens.slice(i, i + BATCH_SIZE);
    const messages = batch.map((to) => ({ to, title, body, data: data ?? {}, sound: 'default' as const }));

    try {
      const res = await fetch(EXPO_PUSH_URL, { method: 'POST', headers, body: JSON.stringify(messages), signal: AbortSignal.timeout(10_000) });
      if (!res.ok) {
        console.warn(`[expo-push] HTTP ${res.status}: ${await res.text()}`);
        continue;
      }
      const receipts = await res.json() as { data?: PushReceipt[] };
      const arr = receipts.data ?? [];
      for (let j = 0; j < arr.length; j++) {
        if (arr[j].status === 'ok') {
          successCount++;
        } else if (arr[j].details?.error === 'DeviceNotRegistered') {
          deadTokens.push(batch[j]);
        }
      }
    } catch (e: unknown) {
      console.warn(`[expo-push] fetch failed:`, (e as Error)?.message ?? String(e));
    }
  }

  return { successCount, deadTokens };
}

/**
 * Supprime les tokens morts de la table push_tokens.
 */
export async function purgeDeadTokens(supabase: SupabaseClient, deadTokens: string[]): Promise<number> {
  if (deadTokens.length === 0) return 0;
  const { error, count } = await supabase
    .from('push_tokens')
    .delete({ count: 'exact' })
    .in('token', deadTokens);
  if (error) {
    console.warn('[expo-push] purgeDeadTokens failed:', error.message);
    return 0;
  }
  return count ?? 0;
}
