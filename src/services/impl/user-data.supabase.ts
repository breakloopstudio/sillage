// src/services/impl/user-data.supabase.ts — Implémentation Supabase
// (Favoris + scans + collection + settings + alertes prix).
// Appelée par le dispatcher user-data.ts quand USE_SUPABASE=true.

import type { Parfum, UserFavori, UserScan, UserPriceAlert } from '../../models';
import { supabase, subscribeUserTable, isSupabaseReady } from '../supabase';
import type { Database } from '../../types/database.types';
import { buildFavoriFilterFields } from '../../utils/favori-filters';
import { toDate, toNum } from './sql-utils';

// ─── Mappers snake_case → modèles ────────────────────────────────────────────

function rowToFavori(row: Record<string, unknown>): UserFavori {
  return {
    id: row.parfum_id as string, // parité : doc id Firestore = parfumId
    parfumId: row.parfum_id as string,
    nom: (row.nom as string) ?? undefined,
    marque: (row.marque as string) ?? undefined,
    imageUrl: (row.image_url as string) ?? undefined,
    familleOlactive: (row.famille_olfactive as string) ?? undefined,
    bestPrice: toNum(row.best_price) ?? undefined,
    referencePrice: toNum(row.reference_price) ?? undefined,
    annee: toNum(row.annee) ?? undefined,
    longevity: (row.longevity as string | null) ?? undefined,
    sillage: (row.sillage as string | null) ?? undefined,
    seasonScores: (row.season_scores as UserFavori['seasonScores']) ?? undefined,
    notes: (row.notes as string[] | null) ?? undefined,
    addedAt: toDate(row.added_at) ?? new Date(),
  };
}

function rowToScan(row: Record<string, unknown>): UserScan {
  return {
    id: row.id as string,
    rawText: (row.raw_text as string) ?? '',
    marque: (row.marque as string) ?? undefined,
    nom: (row.nom as string) ?? undefined,
    volumeMl: toNum(row.volume_ml) ?? undefined,
    typeParfum: (row.type_parfum as string) ?? undefined,
    scannedAt: toDate(row.scanned_at) ?? new Date(),
    parfumId: (row.parfum_id as string) ?? undefined,
    imageUrl: (row.image_url as string) ?? undefined,
    familleOlactive: (row.famille_olfactive as string) ?? undefined,
    annee: toNum(row.annee) ?? undefined,
    bestPrice: toNum(row.best_price) ?? undefined,
    status: (row.status as UserScan['status']) ?? undefined,
  };
}

const byAddedAtDesc = (a: { addedAt: Date }, b: { addedAt: Date }): number =>
  b.addedAt.getTime() - a.addedAt.getTime();

// ─── Favoris ─────────────────────────────────────────────────────────────────

export function onFavoris(uid: string, cb: (favoris: UserFavori[]) => void): () => void {
  return subscribeUserTable<UserFavori>({
    table: 'favoris',
    userId: uid,
    order: { column: 'added_at', ascending: false },
    mapRow: rowToFavori,
    keyOf: (row) => row.parfum_id as string,
    sort: byAddedAtDesc,
    cb,
    onError: (msg) => console.warn('[user-data] onFavoris error:', msg),
  });
}

export async function addFavori(uid: string, parfum: Parfum): Promise<string> {
  try {
    const f = buildFavoriFilterFields(parfum);
    const { error } = await supabase.from('favoris').upsert({
      user_id: uid,
      parfum_id: parfum.id,
      nom: parfum.nom ?? null,
      marque: parfum.marque ?? null,
      image_url: parfum.imageUrl ?? null,
      famille_olfactive: parfum.familleOlactive ?? null,
      best_price: parfum.bestPrice ?? null,
      reference_price: parfum.referencePrice ?? null,
      annee: parfum.annee ?? null,
      longevity: f.longevity,
      sillage: f.sillage,
      season_scores: f.seasonScores,
      notes: f.notes,
      added_at: new Date().toISOString(),
    });
    if (error) throw error;
    return parfum.id;
  } catch (e: unknown) {
    console.warn('[user-data] addFavori failed:', (e as Error)?.message ?? String(e));
    throw e;
  }
}

export async function removeFavori(uid: string, favoriId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('favoris')
      .delete()
      .eq('user_id', uid)
      .eq('parfum_id', favoriId);
    if (error) throw error;
  } catch (e: unknown) {
    console.warn('[user-data] removeFavori failed:', (e as Error)?.message ?? String(e));
    throw e;
  }
}

// ─── Scans ───────────────────────────────────────────────────────────────────

export function onScans(uid: string, cb: (scans: UserScan[]) => void): () => void {
  return subscribeUserTable<UserScan>({
    table: 'scans',
    userId: uid,
    order: { column: 'scanned_at', ascending: false },
    mapRow: rowToScan,
    keyOf: (row) => row.id as string,
    sort: (a, b) => (b.scannedAt as Date).getTime() - (a.scannedAt as Date).getTime(),
    cb,
    onError: (msg) => console.warn('[user-data] onScans error:', msg),
  });
}

export async function saveScan(uid: string, scanData: Omit<UserScan, 'id' | 'scannedAt'>): Promise<void> {
  try {
    const raw: Database['public']['Tables']['scans']['Insert'] = {
      user_id: uid,
      parfum_id: scanData.parfumId ?? null,
      raw_text: scanData.rawText ?? null,
      marque: scanData.marque ?? null,
      nom: scanData.nom ?? null,
      volume_ml: scanData.volumeMl ?? null,
      type_parfum: scanData.typeParfum ?? null,
      image_url: scanData.imageUrl ?? null,
      famille_olfactive: scanData.familleOlactive ?? null,
      annee: scanData.annee ?? null,
      best_price: scanData.bestPrice ?? null,
      status: scanData.status ?? null,
      scanned_at: new Date().toISOString(),
    };
    const clean = Object.fromEntries(Object.entries(raw).filter(([, v]) => v !== undefined));
    const { error } = await supabase.from('scans').insert(clean as Database['public']['Tables']['scans']['Insert']);
    if (error) throw error;
  } catch (e: unknown) {
    console.warn('[user-data] saveScan failed:', (e as Error)?.message ?? String(e));
    throw e;
  }
}

export async function removeScan(uid: string, scanId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('scans')
      .delete()
      .eq('user_id', uid)
      .eq('id', scanId);
    if (error) throw error;
  } catch (e: unknown) {
    console.warn('[user-data] removeScan failed:', (e as Error)?.message ?? String(e));
    throw e;
  }
}

// ─── Settings ────────────────────────────────────────────────────────────────

export interface UserSettings {
  priceAlerts: boolean;
  pushNotifs: boolean;
  weatherNotifs: boolean;
  weatherLat: number | null;
  weatherLon: number | null;
}

const SETTING_KEY_MAP: Record<string, string> = {
  priceAlerts: 'price_alerts',
  pushNotifs: 'push_notifs',
  weatherNotifs: 'weather_notifs',
};

export async function getUserSettings(uid: string): Promise<UserSettings> {
  try {
    const { data, error } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', uid)
      .maybeSingle();
    if (error) throw error;
    if (data) {
      const d = data as Record<string, unknown>;
      return {
        priceAlerts: d.price_alerts === true,
        pushNotifs: d.push_notifs !== false,
        weatherNotifs: d.weather_notifs === true,
        weatherLat: typeof d.weather_lat === 'number' ? d.weather_lat : null,
        weatherLon: typeof d.weather_lon === 'number' ? d.weather_lon : null,
      };
    }
  } catch (e: unknown) {
    console.warn('[user-data] getUserSettings failed:', (e as Error)?.message ?? String(e));
  }
  return { priceAlerts: false, pushNotifs: true, weatherNotifs: false, weatherLat: null, weatherLon: null };
}

export async function updateUserSetting(uid: string, key: 'priceAlerts' | 'pushNotifs' | 'weatherNotifs', value: boolean): Promise<void> {
  try {
    const { error } = await supabase
      .from('user_settings')
      .upsert({ user_id: uid, [SETTING_KEY_MAP[key]]: value } as never);
    if (error) throw error;
  } catch (e: unknown) {
    console.warn('[user-data] updateUserSetting failed:', (e as Error)?.message ?? String(e));
    throw e;
  }
}

export async function saveWeatherCoords(uid: string, lat: number, lon: number): Promise<void> {
  try {
    const { error } = await supabase.from('user_settings').upsert({
      user_id: uid,
      weather_lat: Math.round(lat * 100) / 100,
      weather_lon: Math.round(lon * 100) / 100,
    });
    if (error) throw error;
  } catch (e: unknown) {
    console.warn('[user-data] saveWeatherCoords failed:', (e as Error)?.message ?? String(e));
    throw e;
  }
}

// ─── Alertes prix ────────────────────────────────────────────────────────────

function rowToPriceAlert(row: Record<string, unknown>): UserPriceAlert {
  return {
    parfumId: row.parfum_id as string,
    targetPrice: toNum(row.target_price),
    initialPrice: toNum(row.initial_price),
    lastPrice: toNum(row.last_price),
    lastChecked: toDate(row.last_checked) ?? null,
    addedAt: toDate(row.added_at) ?? new Date(),
  };
}

export function onPriceAlerts(uid: string, cb: (alerts: UserPriceAlert[]) => void): () => void {
  return subscribeUserTable<UserPriceAlert>({
    table: 'price_alerts',
    userId: uid,
    order: { column: 'added_at', ascending: false },
    mapRow: rowToPriceAlert,
    keyOf: (row) => row.parfum_id as string,
    cb,
    onError: (msg) => console.warn('[user-data] onPriceAlerts error:', msg),
  });
}

export interface PriceAlertOptions {
  /** Prix courant au moment de l'activation — ancre « −X% depuis l'alerte ». */
  currentPrice?: number;
  /** Seuil custom. null/absent = logique baisse ≥ 10% / ≥ 5€. */
  targetPrice?: number | null;
}

export async function setPriceAlert(uid: string, parfumId: string, active: boolean, opts?: PriceAlertOptions): Promise<void> {
  if (active) {
    try {
      const now = new Date().toISOString();
      const target = opts?.targetPrice ?? null;
      // Édition vs création : l'ancre (initial_price/last_price) n'est posée qu'à la
      // 1ʳᵉ activation. Une édition (cible/mode) met à jour target_price sans ré-ancrer
      // ni écraser le last_price frais du cron.
      const { data: existing } = await supabase
        .from('price_alerts')
        .select('parfum_id')
        .eq('user_id', uid)
        .eq('parfum_id', parfumId)
        .maybeSingle();
      if (existing) {
        const { error } = await supabase
          .from('price_alerts')
          .update({ target_price: target, last_checked: now })
          .eq('user_id', uid)
          .eq('parfum_id', parfumId);
        if (error) throw error;
      } else {
        const current = opts?.currentPrice ?? null;
        const { error } = await supabase.from('price_alerts').upsert({
          user_id: uid,
          parfum_id: parfumId,
          added_at: now,
          last_price: current,
          last_checked: now,
          initial_price: current,
          target_price: target,
        });
        if (error) throw error;
      }
    } catch (e: unknown) {
      console.warn('[user-data] setPriceAlert failed:', (e as Error)?.message ?? String(e));
      throw e;
    }
  } else {
    try {
      const { error } = await supabase
        .from('price_alerts')
        .delete()
        .eq('user_id', uid)
        .eq('parfum_id', parfumId);
      if (error) throw error;
    } catch (e: unknown) {
      console.warn('[user-data] setPriceAlert delete failed:', (e as Error)?.message ?? String(e));
      throw e;
    }
  }
}

/** Plus bas prix constaté (price_history) — ancre de suggestion du prix cible. */
export async function getLowestObservedPrice(parfumId: string): Promise<number | null> {
  try {
    const { data, error } = await supabase
      .from('price_history')
      .select('best_price')
      .eq('parfum_id', parfumId)
      .order('best_price', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return toNum(data?.best_price);
  } catch {
    return null;
  }
}

/** Plus bas prix constatés (price_history) par parfum — version lotie de getLowestObservedPrice. */
export async function getLowestObservedPrices(parfumIds: string[]): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  if (!isSupabaseReady() || parfumIds.length === 0) return result;
  try {
    const chunks: string[][] = [];
    for (let i = 0; i < parfumIds.length; i += 100) chunks.push(parfumIds.slice(i, i + 100));
    const responses = await Promise.all(chunks.map(ids =>
      supabase
        .from('price_history')
        .select('parfum_id, best_price')
        .in('parfum_id', ids)
    ));
    for (const { data, error } of responses) {
      if (error) throw error;
      for (const row of data ?? []) {
        const price = toNum(row.best_price);
        if (price == null) continue;
        const prev = result.get(row.parfum_id);
        if (prev == null || price < prev) result.set(row.parfum_id, price);
      }
    }
  } catch (e: unknown) {
    console.warn('[user-data] getLowestObservedPrices failed:', (e as Error)?.message ?? String(e));
  }
  return result;
}
