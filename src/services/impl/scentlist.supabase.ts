// src/services/impl/scentlist.supabase.ts — Implémentation Supabase du carnet
// d'essais. Appelée par le dispatcher scentlist.ts quand USE_SUPABASE=true.

import type { UserScentItem, ScentVerdict, Parfum } from '../../models';
import type { WardrobeItem } from '../../models/wardrobe.interface';
import { supabase, subscribeUserTable } from '../supabase';
import { getParfumById } from '../catalog';
import { buildFavoriFilterFields } from '../../utils/favori-filters';
import { toDate } from './sql-utils';

function rowToScentItem(row: Record<string, unknown>): UserScentItem {
  return {
    id: row.parfum_id as string, // parité : doc id Firestore = parfumId
    parfumId: row.parfum_id as string,
    nom: (row.nom as string) ?? null,
    marque: (row.marque as string) ?? null,
    imageUrl: (row.image_url as string) ?? null,
    familleOlactive: (row.famille_olfactive as string) ?? null,
    status: (row.status as UserScentItem['status']) ?? 'to_try',
    verdict: (row.verdict as UserScentItem['verdict']) ?? null,
    rating: typeof row.rating === 'number' ? row.rating : null,
    notes: (row.notes as string) ?? null,
    triedAt: toDate(row.tried_at) ?? null,
    bestPrice: (row.best_price as number) ?? undefined,
    referencePrice: (row.reference_price as number) ?? undefined,
    addedAt: toDate(row.added_at) ?? new Date(),
    updatedAt: toDate(row.updated_at) ?? new Date(),
  };
}

// Tri parité impl Firebase : to_try (addedAt desc) puis tried (triedAt desc)
function sortScentItems(a: UserScentItem, b: UserScentItem): number {
  if (a.status !== b.status) return a.status === 'to_try' ? -1 : 1;
  if (a.status === 'to_try') return b.addedAt.getTime() - a.addedAt.getTime();
  return (b.triedAt?.getTime() ?? 0) - (a.triedAt?.getTime() ?? 0);
}

export function onScentList(uid: string, cb: (items: UserScentItem[]) => void): () => void {
  return subscribeUserTable<UserScentItem>({
    table: 'scentlist',
    userId: uid,
    mapRow: rowToScentItem,
    keyOf: (row) => row.parfum_id as string,
    sort: sortScentItems,
    cb,
    onError: (msg) => console.warn('[scentlist] onScentList error:', msg),
  });
}

export async function addToScentList(uid: string, parfum: Parfum): Promise<void> {
  try {
    const now = new Date().toISOString();
    const { error } = await supabase.from('scentlist').upsert({
      user_id: uid,
      parfum_id: parfum.id,
      nom: parfum.nom ?? null,
      marque: parfum.marque ?? null,
      image_url: parfum.imageUrl ?? null,
      famille_olfactive: parfum.familleOlactive ?? null,
      status: 'to_try',
      verdict: null,
      rating: null,
      notes: null,
      tried_at: null,
      best_price: parfum.bestPrice ?? null,
      reference_price: parfum.referencePrice ?? null,
      added_at: now,
      updated_at: now,
    } as never);
    if (error) throw error;
  } catch (e: unknown) {
    console.warn('[scentlist] addToScentList failed:', (e as Error)?.message ?? String(e));
  }
}

export async function updateScentItem(uid: string, parfumId: string,
  data: Partial<Pick<UserScentItem, 'verdict' | 'rating' | 'notes' | 'status' | 'triedAt'>>,
): Promise<void> {
  try {
    const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (data.verdict !== undefined) row.verdict = data.verdict;
    if (data.rating !== undefined) row.rating = data.rating;
    if (data.notes !== undefined) row.notes = data.notes;
    if (data.status !== undefined) row.status = data.status;
    if (data.triedAt !== undefined) row.tried_at = data.triedAt ? data.triedAt.toISOString() : null;
    const { error } = await supabase
      .from('scentlist')
      .update(row as never)
      .eq('user_id', uid)
      .eq('parfum_id', parfumId);
    if (error) throw error;
  } catch (e: unknown) {
    console.warn('[scentlist] updateScentItem failed:', (e as Error)?.message ?? String(e));
  }
}

export async function markScentTried(uid: string, parfumId: string,
  data: { verdict: ScentVerdict | null; rating: number | null; notes: string | null },
): Promise<void> {
  try {
    const { error } = await supabase
      .from('scentlist')
      .update({
        status: 'tried',
        tried_at: new Date().toISOString(),
        verdict: data.verdict,
        rating: data.rating,
        notes: data.notes,
        updated_at: new Date().toISOString(),
      } as never)
      .eq('user_id', uid)
      .eq('parfum_id', parfumId);
    if (error) throw error;
  } catch (e: unknown) {
    console.warn('[scentlist] markScentTried failed:', (e as Error)?.message ?? String(e));
  }
}

export async function removeFromScentList(uid: string, parfumId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('scentlist')
      .delete()
      .eq('user_id', uid)
      .eq('parfum_id', parfumId);
    if (error) throw error;
  } catch (e: unknown) {
    console.warn('[scentlist] removeFromScentList failed:', (e as Error)?.message ?? String(e));
  }
}

export async function isInScentList(uid: string, parfumId: string): Promise<UserScentItem | null> {
  try {
    const { data, error } = await supabase
      .from('scentlist')
      .select('*')
      .eq('user_id', uid)
      .eq('parfum_id', parfumId)
      .maybeSingle();
    if (error) throw error;
    if (data) return rowToScentItem(data as Record<string, unknown>);
    return null;
  } catch {
    return null;
  }
}

export async function moveScentToWardrobe(uid: string, item: UserScentItem,
  ownership: WardrobeItem['ownership'], sizeMl?: number | null,
): Promise<void> {
  try {
    // Champs filtres best-effort (parité addToWardrobe qui fetch le parfum)
    let ff: Record<string, unknown> = {};
    try {
      const p = await getParfumById(item.parfumId);
      if (p) {
        const f = buildFavoriFilterFields(p);
        ff = {
          p_longevity: f.longevity,
          p_sillage: f.sillage,
          p_season_scores: f.seasonScores,
          p_all_notes: f.notes,
        };
      }
    } catch (e: unknown) {
      console.warn('[scentlist] moveScentToWardrobe parfum fetch failed:', (e as Error)?.message ?? String(e));
    }

    const hasRating = item.rating !== null && !Number.isNaN(item.rating);
    const hasNotes = typeof item.notes === 'string' && item.notes.trim().length > 0;

    // RPC transactionnelle : upsert wardrobe (+rating/notes) + delete scentlist
    const { error } = await supabase.rpc('move_scent_to_wardrobe', {
      p_parfum_id: item.parfumId,
      p_ownership: ownership,
      p_size_ml: sizeMl ?? null,
      p_nom: item.nom,
      p_marque: item.marque,
      p_image_url: item.imageUrl,
      p_famille_olfactive: item.familleOlactive,
      p_rating: hasRating ? item.rating : null,
      p_notes: hasNotes ? item.notes : null,
      ...ff,
    });
    if (error) throw error;
  } catch (e: unknown) {
    console.warn('[scentlist] moveScentToWardrobe failed:', (e as Error)?.message ?? String(e));
  }
}
