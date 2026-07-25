// src/services/impl/wardrobe.supabase.ts — Implémentation Supabase de la
// Wardrobe (+ Shelves + SOTD). Appelée par le dispatcher wardrobe.ts quand
// USE_SUPABASE=true.

import type { WardrobeItem, Shelf, SotdEntry } from '../../models/wardrobe.interface';
import type { Parfum } from '../../models';
import { supabase, subscribeUserTable } from '../supabase';
import { getParfumById } from '../firestore';
import { buildFavoriFilterFields } from '../../utils/favori-filters';
import { toDate, today } from './sql-utils';

// ─── Mappers ─────────────────────────────────────────────────────────────────

function rowToWardrobeItem(row: Record<string, unknown>): WardrobeItem {
  const addedAt = toDate(row.added_at) ?? new Date();
  return {
    parfumId: row.parfum_id as string,
    nom: (row.nom as string) ?? null,
    marque: (row.marque as string) ?? null,
    imageUrl: (row.image_url as string) ?? null,
    familleOlactive: (row.famille_olfactive as string) ?? null,
    ownership: (row.ownership as WardrobeItem['ownership']) ?? 'have',
    rating: typeof row.rating === 'number' ? row.rating : null,
    notes: (row.notes as string) ?? null,
    shelfIds: Array.isArray(row.shelf_ids) ? row.shelf_ids as string[] : [],
    sizeMl: typeof row.size_ml === 'number' ? row.size_ml : null,
    sotdCount: typeof row.sotd_count === 'number' ? row.sotd_count : 0,
    isSignature: row.is_signature === true,
    longevity: (row.longevity as string) ?? null,
    sillage: (row.sillage as string) ?? null,
    seasonScores: (row.season_scores as WardrobeItem['seasonScores']) ?? null,
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

// ─── Wardrobe ────────────────────────────────────────────────────────────────

export function onWardrobe(uid: string, cb: (items: WardrobeItem[]) => void): () => void {
  return subscribeUserTable<WardrobeItem>({
    table: 'wardrobe',
    userId: uid,
    order: { column: 'added_at', ascending: true },
    mapRow: rowToWardrobeItem,
    keyOf: (row) => row.parfum_id as string,
    cb,
    onError: (msg) => console.warn('[wardrobe] onWardrobe error:', msg),
  });
}

export async function addToWardrobe(
  uid: string, parfumId: string, ownership: WardrobeItem['ownership'],
  nom?: string, marque?: string, imageUrl?: string, familleOlactive?: string,
  sizeMl?: number | null,
  parfum?: Parfum,
): Promise<void> {
  try {
    let filterFields = {};
    const p = parfum ?? await getParfumById(parfumId).catch(() => undefined);
    if (p) {
      const f = buildFavoriFilterFields(p);
      filterFields = { longevity: f.longevity, sillage: f.sillage, season_scores: f.seasonScores, all_notes: f.notes };
    }
    const now = new Date().toISOString();

    const existing = await isInWardrobe(uid, parfumId);
    if (existing) {
      const { error } = await supabase
        .from('wardrobe')
        .update({
          ownership,
          nom: nom ?? existing.nom,
          marque: marque ?? existing.marque,
          image_url: imageUrl ?? existing.imageUrl,
          famille_olfactive: familleOlactive ?? existing.familleOlactive,
          size_ml: sizeMl ?? existing.sizeMl,
          ...filterFields,
          updated_at: now,
        } as never)
        .eq('user_id', uid)
        .eq('parfum_id', parfumId);
      if (error) throw error;
    } else {
      const { error } = await supabase.from('wardrobe').insert({
        user_id: uid,
        parfum_id: parfumId,
        ownership,
        nom: nom ?? null,
        marque: marque ?? null,
        image_url: imageUrl ?? null,
        famille_olfactive: familleOlactive ?? null,
        rating: null,
        notes: null,
        shelf_ids: [],
        size_ml: sizeMl ?? null,
        sotd_count: 0,
        is_signature: false,
        ...filterFields,
        added_at: now,
        updated_at: now,
      } as never);
      if (error) throw error;
    }
  } catch (e: unknown) {
    console.warn('[wardrobe] addToWardrobe failed:', (e as Error)?.message ?? String(e));
  }
}

export async function updateWardrobeItem(
  uid: string, parfumId: string,
  data: Partial<Pick<WardrobeItem, 'ownership' | 'rating' | 'notes' | 'shelfIds' | 'sizeMl' | 'isSignature'>>,
): Promise<void> {
  try {
    const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (data.ownership !== undefined) row.ownership = data.ownership;
    if (data.rating !== undefined) row.rating = data.rating;
    if (data.notes !== undefined) row.notes = data.notes;
    if (data.shelfIds !== undefined) row.shelf_ids = data.shelfIds;
    if (data.sizeMl !== undefined) row.size_ml = data.sizeMl;
    if (data.isSignature !== undefined) row.is_signature = data.isSignature;
    const { error } = await supabase
      .from('wardrobe')
      .update(row as never)
      .eq('user_id', uid)
      .eq('parfum_id', parfumId);
    if (error) throw error;
  } catch (e: unknown) {
    console.warn('[wardrobe] updateWardrobeItem failed:', (e as Error)?.message ?? String(e));
  }
}

export async function removeFromWardrobe(uid: string, parfumId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('wardrobe')
      .delete()
      .eq('user_id', uid)
      .eq('parfum_id', parfumId);
    if (error) throw error;
  } catch (e: unknown) {
    console.warn('[wardrobe] removeFromWardrobe failed:', (e as Error)?.message ?? String(e));
  }
}

export async function isInWardrobe(uid: string, parfumId: string): Promise<WardrobeItem | null> {
  try {
    const { data, error } = await supabase
      .from('wardrobe')
      .select('*')
      .eq('user_id', uid)
      .eq('parfum_id', parfumId)
      .maybeSingle();
    if (error) throw error;
    if (data) return rowToWardrobeItem(data as Record<string, unknown>);
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
    onError: (msg) => console.warn('[wardrobe] onShelves error:', msg),
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
      } as never)
      .select('id')
      .single();
    if (error) throw error;
    return (data as { id: string }).id;
  } catch (e: unknown) {
    console.warn('[wardrobe] createShelf failed:', (e as Error)?.message ?? String(e));
    return '';
  }
}

export async function updateShelf(uid: string, shelfId: string, data: Partial<Pick<Shelf, 'name' | 'icon' | 'color' | 'order'>>): Promise<void> {
  try {
    const { error } = await supabase
      .from('shelves')
      .update(data as never)
      .eq('user_id', uid)
      .eq('id', shelfId);
    if (error) throw error;
  } catch (e: unknown) {
    console.warn('[wardrobe] updateShelf failed:', (e as Error)?.message ?? String(e));
  }
}

export async function deleteShelf(uid: string, shelfId: string): Promise<void> {
  try {
    // RPC transactionnelle : delete shelf + retrait de shelf_ids dans wardrobe
    const { error } = await supabase.rpc('delete_shelf', { p_shelf_id: shelfId });
    if (error) throw error;
  } catch (e: unknown) {
    console.warn('[wardrobe] deleteShelf failed:', (e as Error)?.message ?? String(e));
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
    // RPC transactionnelle : upsert sotd + increment wardrobe.sotd_count
    const { error } = await supabase.rpc('set_sotd', {
      p_parfum_id: parfumId,
      p_nom: nom,
      p_marque: marque,
      p_image_url: imageUrl ?? null,
    });
    if (error) throw error;
  } catch (e: unknown) {
    console.warn('[wardrobe] setSotd failed:', (e as Error)?.message ?? String(e));
  }
}
