// src/services/supabase.ts — Noyau Supabase : client + adaptateur realtime
// Remplace firebase.ts et fournit l'équivalent d'`onSnapshot` (subscribeUserTable).
// Cf. MIGRATION_SUPABASE.md §4.

import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from '../config/env';
import type { Database } from '../types/database.types';

const useLocal = env.USE_SUPABASE_LOCAL;
const url = useLocal ? env.SUPABASE_LOCAL_URL : env.SUPABASE_URL;
const anonKey = useLocal ? env.SUPABASE_LOCAL_ANON_KEY : env.SUPABASE_ANON_KEY;
const hasConfig = url.length > 0 && anonKey.length > 0;

// Placeholder pour ne pas crasher si le .env est absent (Expo Go, tests) —
// le client n'est jamais utilisé tant que isSupabaseReady() est false.
export const supabase: SupabaseClient<Database> = createClient<Database>(
  hasConfig ? url : 'https://placeholder.supabase.co',
  hasConfig ? anonKey : 'placeholder-anon-key',
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false, // mobile : pas de parsing d'URL web
    },
    realtime: {
      heartbeatIntervalMs: 15000,
    },
  },
);

export function isSupabaseReady(): boolean {
  return env.USE_SUPABASE && hasConfig;
}

// La RLS filtre les flux realtime via le JWT — il faut le tenir à jour
// sur la websocket à chaque changement de session (login, refresh, logout).
supabase.auth.onAuthStateChange((_event, session) => {
  supabase.realtime.setAuth(session?.access_token ?? null);
});

// ─── Adaptateur realtime (remplacement d'onSnapshot) ────────────────────────
//
// onSnapshot(Firestore) émet un SNAPSHOT COMPLET à chaque changement ;
// postgres_changes(Supabase) n'émet que des ÉVÉNEMENTS de mutation.
// Cet adaptateur maintient un cache clé→item (fetch initial + deltas)
// et réémet une copie triée à chaque changement — signature identique.

/** Noms des tables possédant une colonne user_id (helpers génériques : subscribeUserTable, count/delete). */
export type UserTableName = {
  [K in keyof Database['public']['Tables']]: 'user_id' extends keyof Database['public']['Tables'][K]['Row'] ? K : never;
}[keyof Database['public']['Tables']];

export interface SubscribeUserTableOptions<T> {
  /** Table publique (ex: 'favoris', 'wardrobe') */
  table: UserTableName;
  /** UUID Supabase du user (auth.uid()) */
  userId: string;
  /** Tri du fetch initial (le tri final est reappliqué via `sort` si fourni) */
  order?: { column: string; ascending?: boolean };
  /** snake_case row → modèle TS */
  mapRow: (row: Record<string, unknown>) => T;
  /** Clé primaire extraite d'une ligne brute (pour appliquer les deltas) */
  keyOf: (row: Record<string, unknown>) => string;
  /** Tri final du tableau émis (optionnel) */
  sort?: (a: T, b: T) => number;
  /** Callback type onSnapshot : tableau complet à chaque changement */
  cb: (items: T[]) => void;
  /** Erreurs fetch initial ou canal (logguées aussi en console.warn) */
  onError?: (message: string) => void;
}

let channelSeq = 0;

export function subscribeUserTable<T>(opts: SubscribeUserTableOptions<T>): () => void {
  const { table, userId, order, mapRow, keyOf, sort, cb, onError } = opts;
  const items = new Map<string, T>();
  let cancelled = false;
  let initialDone = false;
  const pendingEvents: Array<{ eventType: string; row: Record<string, unknown> }> = [];

  const emit = (): void => {
    const arr = [...items.values()];
    if (sort) arr.sort(sort);
    cb(arr);
  };

  const applyEvent = (eventType: string, row: Record<string, unknown>): void => {
    if (eventType === 'DELETE') {
      items.delete(keyOf(row));
    } else {
      items.set(keyOf(row), mapRow(row));
    }
  };

  // 1. Fetch initial (parité avec le snapshot initial d'onSnapshot)
  void (async () => {
    let q = supabase.from(table).select('*').eq('user_id', userId);
    if (order) q = q.order(order.column, { ascending: order.ascending ?? true });
    const { data, error } = await q;
    if (cancelled) return;
    if (error) {
      console.warn(`[supabase] ${table} fetch error:`, error.message);
      onError?.(error.message);
      initialDone = true;
      pendingEvents.length = 0;
      cb([]);
      return;
    }
    for (const row of (data ?? []) as Record<string, unknown>[]) {
      items.set(keyOf(row), mapRow(row));
    }
    for (const evt of pendingEvents) {
      applyEvent(evt.eventType, evt.row);
    }
    pendingEvents.length = 0;
    initialDone = true;
    emit();
  })();

  // 2. Canal realtime — INSERT/UPDATE/DELETE bufferisés jusqu'au fetch initial
  const MAX_RETRIES = 5;
  let retryCount = 0;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let currentChannel: ReturnType<typeof supabase.channel> | null = null;

  const createChannel = () => {
    if (cancelled) return;
    const ch = supabase
      .channel(`user:${table}:${userId}:${channelSeq++}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table, filter: `user_id=eq.${userId}` },
        (payload) => {
          if (cancelled) return;
          const row = (payload.eventType === 'DELETE' ? payload.old : payload.new) as Record<string, unknown>;
          if (!initialDone) {
            pendingEvents.push({ eventType: payload.eventType, row });
            return;
          }
          applyEvent(payload.eventType, row);
          emit();
        },
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          if (cancelled) return;
          retryCount++;
          if (retryCount > MAX_RETRIES) {
            console.warn(`[supabase] ${table} channel error — max retries reached`);
            onError?.(`Canal temps réel ${table} en échec.`);
            return;
          }
          const delay = Math.min(1000 * 2 ** (retryCount - 1), 30000);
          console.warn(`[supabase] ${table} channel error — retry ${retryCount}/${MAX_RETRIES} in ${delay}ms`);
          void supabase.removeChannel(ch);
          retryTimer = setTimeout(createChannel, delay);
        } else if (status === 'SUBSCRIBED') {
          retryCount = 0;
        }
      });
    currentChannel = ch;
  };

  createChannel();

  // 3. Cleanup — même contrat que l'unsubscribe d'onSnapshot
  return () => {
    cancelled = true;
    if (retryTimer) clearTimeout(retryTimer);
    if (currentChannel) void supabase.removeChannel(currentChannel);
  };
}
