import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Parfum } from '../../models';

const PREFIX = '@sillage/home/v1/';
const VERSION = 1;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const DATE_KEYS = ['createdAt', 'updatedAt', 'cachedAt', 'similarIdsCachedAt'] as const;

interface Envelope {
  v: number;
  t: number;
  data: unknown;
}

const inflight = new Map<string, Promise<Parfum[]>>();

function reviveDates(row: Record<string, unknown>): void {
  for (const k of DATE_KEYS) {
    const v = row[k];
    if (typeof v === 'string') {
      const d = new Date(v);
      row[k] = Number.isNaN(d.getTime()) ? undefined : d;
    }
  }
}

function deserializeParfums(raw: unknown): Parfum[] {
  if (!Array.isArray(raw)) return [];
  for (const item of raw) {
    if (item && typeof item === 'object') reviveDates(item as Record<string, unknown>);
  }
  return raw as Parfum[];
}

export async function getCached(key: string): Promise<{ data: Parfum[]; fresh: boolean } | null> {
  try {
    const raw = await AsyncStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const env = JSON.parse(raw) as Envelope;
    if (!env || env.v !== VERSION || !Array.isArray(env.data)) return null;
    const fresh = Date.now() - (typeof env.t === 'number' ? env.t : 0) < CACHE_TTL_MS;
    return { data: deserializeParfums(env.data), fresh };
  } catch {
    return null;
  }
}

export async function setCached(key: string, data: Parfum[]): Promise<void> {
  if (!Array.isArray(data) || data.length === 0) return;
  try {
    await AsyncStorage.setItem(PREFIX + key, JSON.stringify({ v: VERSION, t: Date.now(), data }));
  } catch (e: unknown) {
    console.warn('[home-cache] setCached failed:', (e as Error)?.message ?? String(e));
  }
}

export function getOrFetch(key: string, fetcher: () => Promise<Parfum[]>): Promise<Parfum[]> {
  const existing = inflight.get(key);
  if (existing) return existing;
  const promise = fetcher().then(
    (data) => {
      inflight.delete(key);
      if (Array.isArray(data) && data.length > 0) void setCached(key, data);
      return data;
    },
    (e: unknown) => {
      inflight.delete(key);
      console.warn('[home-cache] getOrFetch failed:', (e as Error)?.message ?? String(e));
      return [] as Parfum[];
    },
  );
  inflight.set(key, promise);
  return promise;
}

export async function clearHomeCache(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const home = keys.filter((k) => k.startsWith(PREFIX));
    await Promise.all(home.map((k) => AsyncStorage.removeItem(k)));
  } catch (e: unknown) {
    console.warn('[home-cache] clearHomeCache failed:', (e as Error)?.message ?? String(e));
  }
}
