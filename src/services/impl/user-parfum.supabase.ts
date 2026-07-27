import type { UserParfum, UserParfumStatus, ScentVerdict, Shelf, SotdEntry } from '../../models/user-parfum.interface';
import type { Parfum } from '../../models';
import { supabase, subscribeUserTable } from '../supabase';
import type { Database } from '../../types/database.types';
import { getParfumById } from '../catalog';
import { buildFavoriFilterFields } from '../../utils/favori-filters';
import { toDate, today, toNum } from './sql-utils';

export function rowToUserParfum(row: Record<string, unknown>): UserParfum {
  const addedAt = toDate(row.added_at) ?? new Date();
  return {
    parfumId: row.parfum_id as string,
    status: (row.status as UserParfumStatus) ?? 'to_try',
    verdict: (row.verdict as ScentVerdict) ?? null,
    rating: toNum(row.rating),
    notes: (row.notes as string) ?? null,
    triedAt: toDate(row.tried_at) ?? null,
    shelfIds: Array.isArray(row.shelf_ids) ? row.shelf_ids as string[] : [],
    sotdCount: toNum(row.sotd_count) ?? 0,
    isSignature: row.is_signature === true,
    nom: (row.nom as string) ?? null,
    marque: (row.marque as string) ?? null,
    imageUrl: (row.image_url as string) ?? null,
    familleOlactive: (row.famille_olfactive as string) ?? null,
    bestPrice: toNum(row.best_price) ?? undefined,
    referencePrice: toNum(row.reference_price) ?? undefined,
    longevity: (row.longevity as string) ?? null,
    sillage: (row.sillage as string) ?? null,
    seasonScores: (row.season_scores as UserParfum['seasonScores']) ?? null,
    allNotes: Array.isArray(row.all_notes) ? row.all_notes as string[] : null,
    addedAt,
    updatedAt: toDate(row.updated_at) ?? addedAt,
  };
}

function rowToShelf(row: Record<string, unknown>): Shelf {
  return {
    id: row.id as string,
    name: (row.name as string) ?? '',
    icon: (row.icon as string) ?? null,
    color: (row.color as string) ?? null,
    order: typeof row.order === 'number' ? row.order : 0,
    createdAt: toDate(row.created_at) ?? new Date(),
  };
}

// ─── Subscription ────────────────────────────────────────────────────────────

export function onUserParfums(uid: string, cb: (items: UserParfum[]) => void): () => void {
  return subscribeUserTable<UserParfum>({
    table: 'user_parfum',
    userId: uid,
    order: { column: 'added_at', ascending: false },
    mapRow: rowToUserParfum,
    keyOf: (row) => row.parfum_id as string,
    cb,
    onError: (msg) => console.warn('[user-parfum] onUserParfums error:', msg),
  });
}

// ─── CRUD ────────────────────────────────────────────────────────────────────

export async function addUserParfum(
  uid: string,
  parfumId: string,
  status: UserParfumStatus,
  parfum?: Parfum,
): Promise<void> {
  try {
    let filterFields = {};
    let displayFields = {};
    const p = parfum ?? await getParfumById(parfumId).catch(() => undefined);
    if (p) {
      const f = buildFavoriFilterFields(p);
      filterFields = { longevity: f.longevity, sillage: f.sillage, season_scores: f.seasonScores, all_notes: f.notes };
      displayFields = {
        nom: p.nom,
        marque: p.marque,
        image_url: p.imageUrl ?? null,
        famille_olfactive: p.familleOlactive ?? null,
        best_price: p.bestPrice ?? null,
        reference_price: p.referencePrice ?? null,
      };
    }
    const now = new Date().toISOString();
    const { error } = await supabase.from('user_parfum').upsert({
      user_id: uid,
      parfum_id: parfumId,
      status,
      ...displayFields,
      ...filterFields,
      added_at: now,
      updated_at: now,
    } as Database['public']['Tables']['user_parfum']['Insert'], { onConflict: 'user_id,parfum_id' });
    if (error) throw error;
  } catch (e: unknown) {
    console.warn('[user-parfum] addUserParfum failed:', (e as Error)?.message ?? String(e));
    throw e;
  }
}

export async function updateUserParfum(
  uid: string,
  parfumId: string,
  data: Partial<Pick<UserParfum, 'status' | 'verdict' | 'rating' | 'notes' | 'triedAt' | 'shelfIds' | 'isSignature'>>,
): Promise<void> {
  try {
    const row: Database['public']['Tables']['user_parfum']['Update'] = { updated_at: new Date().toISOString() };
    if (data.status !== undefined) row.status = data.status;
    if (data.verdict !== undefined) row.verdict = data.verdict;
    if (data.rating !== undefined) row.rating = data.rating;
    if (data.notes !== undefined) row.notes = data.notes;
    if (data.triedAt !== undefined) row.tried_at = data.triedAt ? data.triedAt.toISOString() : null;
    if (data.shelfIds !== undefined) row.shelf_ids = data.shelfIds;
    if (data.isSignature !== undefined) row.is_signature = data.isSignature;
    const { error } = await supabase
      .from('user_parfum')
      .update(row)
      .eq('user_id', uid)
      .eq('parfum_id', parfumId);
    if (error) throw error;
  } catch (e: unknown) {
    console.warn('[user-parfum] updateUserParfum failed:', (e as Error)?.message ?? String(e));
    throw e;
  }
}

export async function markTried(
  uid: string,
  parfumId: string,
  data: { verdict: ScentVerdict | null; rating: number | null; notes: string | null },
): Promise<void> {
  try {
    const { error } = await supabase
      .from('user_parfum')
      .update({
        status: 'tried',
        verdict: data.verdict,
        rating: data.rating,
        notes: data.notes,
        tried_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', uid)
      .eq('parfum_id', parfumId);
    if (error) throw error;
  } catch (e: unknown) {
    console.warn('[user-parfum] markTried failed:', (e as Error)?.message ?? String(e));
    throw e;
  }
}

export async function removeUserParfum(uid: string, parfumId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('user_parfum')
      .delete()
      .eq('user_id', uid)
      .eq('parfum_id', parfumId);
    if (error) throw error;
  } catch (e: unknown) {
    console.warn('[user-parfum] removeUserParfum failed:', (e as Error)?.message ?? String(e));
    throw e;
  }
}

export async function getUserParfum(uid: string, parfumId: string): Promise<UserParfum | null> {
  try {
    const { data, error } = await supabase
      .from('user_parfum')
      .select('*')
      .eq('user_id', uid)
      .eq('parfum_id', parfumId)
      .maybeSingle();
    if (error) throw error;
    if (data) return rowToUserParfum(data as Record<string, unknown>);
    return null;
  } catch {
    return null;
  }
}

// ─── Shelves ─────────────────────────────────────────────────────────────────

export function onShelves(uid: string, cb: (shelves: Shelf[]) => void): () => void {
  return subscribeUserTable<Shelf>({
    table: 'shelves',
    userId: uid,
    order: { column: 'order', ascending: true },
    mapRow: rowToShelf,
    keyOf: (row) => row.id as string,
    sort: (a, b) => a.order - b.order,
    cb,
    onError: (msg) => console.warn('[user-parfum] onShelves error:', msg),
  });
}

export async function createShelf(uid: string, name: string, icon?: string, color?: string): Promise<string> {
  try {
    const { data: top } = await supabase
      .from('shelves')
      .select('order')
      .eq('user_id', uid)
      .order('order', { ascending: false })
      .limit(1);
    const nextOrder = (top && top.length > 0 ? ((top[0] as { order: number }).order ?? 0) : -1) + 1;
    const { data, error } = await supabase
      .from('shelves')
      .insert({
        user_id: uid,
        name,
        icon: icon ?? null,
        color: color ?? null,
        order: nextOrder,
        created_at: new Date().toISOString(),
      })
      .select('id')
      .single();
    if (error) throw error;
    return (data as { id: string }).id;
  } catch (e: unknown) {
    console.warn('[user-parfum] createShelf failed:', (e as Error)?.message ?? String(e));
    return '';
  }
}

export async function updateShelf(uid: string, shelfId: string, data: Partial<Pick<Shelf, 'name' | 'icon' | 'color' | 'order'>>): Promise<void> {
  try {
    const { error } = await supabase
      .from('shelves')
      .update(data)
      .eq('user_id', uid)
      .eq('id', shelfId);
    if (error) throw error;
  } catch (e: unknown) {
    console.warn('[user-parfum] updateShelf failed:', (e as Error)?.message ?? String(e));
  }
}

export async function deleteShelf(uid: string, shelfId: string): Promise<void> {
  try {
    const { error } = await supabase.rpc('delete_shelf', { p_shelf_id: shelfId });
    if (error) throw error;
  } catch (e: unknown) {
    console.warn('[user-parfum] deleteShelf failed:', (e as Error)?.message ?? String(e));
  }
}

// ─── SOTD ────────────────────────────────────────────────────────────────────

export async function getTodaySotd(uid: string): Promise<SotdEntry | null> {
  try {
    const { data, error } = await supabase
      .from('sotd')
      .select('*')
      .eq('user_id', uid)
      .eq('day', today())
      .maybeSingle();
    if (error) throw error;
    if (data) {
      const d = data as Record<string, unknown>;
      return {
        parfumId: d.parfum_id as string,
        nom: d.nom as string,
        marque: d.marque as string,
        imageUrl: (d.image_url as string) ?? null,
      };
    }
    return null;
  } catch {
    return null;
  }
}

export async function setSotd(uid: string, parfumId: string, nom: string, marque: string, imageUrl?: string | null): Promise<void> {
  try {
    const { error } = await supabase.rpc('set_sotd', {
      p_parfum_id: parfumId,
      p_nom: nom,
      p_marque: marque,
      p_image_url: imageUrl ?? undefined,
    });
    if (error) throw error;
  } catch (e: unknown) {
    console.warn('[user-parfum] setSotd failed:', (e as Error)?.message ?? String(e));
    throw e;
  }
}
