// src/services/impl/profile.supabase.ts — Profils publics (Supabase)

import type { MyProfile, PublicProfile, PublicCollectionItem, PublicShelf, PublicShelfItem } from '../../models/profile.interface';
import type { UserParfumStatus, ScentVerdict } from '../../models/user-parfum.interface';
import { supabase } from '../supabase';
import { toDate, toNum } from './sql-utils';

function rowToMyProfile(row: Record<string, unknown>): MyProfile {
  return {
    pseudo: (row.pseudo as string) ?? '',
    avatarUrl: (row.avatar_url as string) ?? null,
    bio: (row.bio as string) ?? null,
    isPublic: row.is_public === true,
    createdAt: toDate(row.created_at) ?? new Date(),
  };
}

export async function getMyProfile(uid: string): Promise<MyProfile | null> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', uid)
      .maybeSingle();
    if (error) throw error;
    return data ? rowToMyProfile(data as Record<string, unknown>) : null;
  } catch (e: unknown) {
    console.warn('[profile] getMyProfile failed:', (e as Error)?.message ?? String(e));
    return null;
  }
}

export interface ProfileInput {
  pseudo: string;
  bio?: string | null;
  isPublic?: boolean;
  avatarUrl?: string | null;
}

/**
 * Crée/met à jour mon profil. Throw l'erreur Supabase brute — l'UI traduit via
 * `translateSupabaseError` (ex. code 23505 → pseudo déjà pris).
 */
export async function upsertMyProfile(uid: string, input: ProfileInput): Promise<void> {
  const { error } = await supabase.from('profiles').upsert({
    user_id: uid,
    pseudo: input.pseudo,
    bio: input.bio ?? null,
    is_public: input.isPublic ?? false,
    avatar_url: input.avatarUrl ?? null,
  });
  if (error) throw error;
}

export async function getPublicProfile(pseudo: string): Promise<PublicProfile | null> {
  try {
    const { data, error } = await supabase.rpc('public_profile', { p_pseudo: pseudo });
    if (error) throw error;
    const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | null;
    if (!row) return null;
    return {
      pseudo: (row.pseudo as string) ?? pseudo,
      avatarUrl: (row.avatar_url as string) ?? null,
      bio: (row.bio as string) ?? null,
      createdAt: toDate(row.created_at) ?? new Date(),
      collectionCount: toNum(row.collection_count) ?? 0,
      followerCount: toNum(row.follower_count) ?? 0,
      followingCount: toNum(row.following_count) ?? 0,
    };
  } catch (e: unknown) {
    console.warn('[profile] getPublicProfile failed:', (e as Error)?.message ?? String(e));
    return null;
  }
}

export async function getPublicCollection(pseudo: string): Promise<PublicCollectionItem[]> {
  try {
    const { data, error } = await supabase.rpc('public_collection', { p_pseudo: pseudo });
    if (error) throw error;
    return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
      parfumId: row.parfum_id as string,
      nom: (row.nom as string) ?? null,
      marque: (row.marque as string) ?? null,
      imageUrl: (row.image_url as string) ?? null,
      familleOlactive: (row.famille_olfactive as string) ?? null,
      status: (row.status as UserParfumStatus) ?? 'to_try',
      verdict: (row.verdict as ScentVerdict) ?? null,
      rating: toNum(row.rating),
      bestPrice: toNum(row.best_price) ?? undefined,
      addedAt: toDate(row.added_at) ?? new Date(),
    }));
  } catch (e: unknown) {
    console.warn('[profile] getPublicCollection failed:', (e as Error)?.message ?? String(e));
    return [];
  }
}

export async function getPublicShelf(pseudo: string, shelfId: string): Promise<PublicShelf | null> {
  try {
    const { data, error } = await supabase.rpc('public_shelf', { p_pseudo: pseudo, p_shelf_id: shelfId });
    if (error) throw error;
    const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | null;
    if (!row) return null;
    return {
      shelfId: (row.shelf_id as string) ?? shelfId,
      name: (row.name as string) ?? '',
      description: (row.description as string) ?? null,
      color: (row.color as string) ?? null,
      icon: (row.icon as string) ?? null,
      itemCount: toNum(row.item_count) ?? 0,
      pseudo: (row.pseudo as string) ?? pseudo,
      avatarUrl: (row.avatar_url as string) ?? null,
      bio: (row.bio as string) ?? null,
    };
  } catch (e: unknown) {
    console.warn('[profile] getPublicShelf failed:', (e as Error)?.message ?? String(e));
    return null;
  }
}

export async function getPublicShelfItems(pseudo: string, shelfId: string): Promise<PublicShelfItem[]> {
  try {
    const { data, error } = await supabase.rpc('public_shelf_items', { p_pseudo: pseudo, p_shelf_id: shelfId });
    if (error) throw error;
    return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
      parfumId: row.parfum_id as string,
      nom: (row.nom as string) ?? null,
      marque: (row.marque as string) ?? null,
      imageUrl: (row.image_url as string) ?? null,
      familleOlactive: (row.famille_olfactive as string) ?? null,
      bestPrice: toNum(row.best_price) ?? undefined,
    }));
  } catch (e: unknown) {
    console.warn('[profile] getPublicShelfItems failed:', (e as Error)?.message ?? String(e));
    return [];
  }
}
