import { useState, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { supabase } from '../services/supabase';
import type { UserParfum, UserParfumStatus } from '../models/user-parfum.interface';
import { toDate } from '../services/impl/sql-utils';

interface ProfileStats {
  favorisCount: number | null;
  wardrobeItems: UserParfum[];
  scansCount: number | null;
  loading: boolean;
}

function rowToUserParfum(row: Record<string, unknown>): UserParfum {
  const addedAt = toDate(row.added_at) ?? new Date();
  return {
    parfumId: row.parfum_id as string,
    nom: (row.nom as string) ?? null,
    marque: (row.marque as string) ?? null,
    imageUrl: (row.image_url as string) ?? null,
    familleOlactive: (row.famille_olfactive as string) ?? null,
    status: (row.status as UserParfumStatus) ?? 'have',
    verdict: (row.verdict as UserParfum['verdict']) ?? null,
    triedAt: row.tried_at ? new Date(row.tried_at as string) : null,
    rating: typeof row.rating === 'number' ? row.rating : null,
    notes: (row.notes as string) ?? null,
    shelfIds: Array.isArray(row.shelf_ids) ? row.shelf_ids as string[] : [],
    sotdCount: typeof row.sotd_count === 'number' ? row.sotd_count : 0,
    isSignature: row.is_signature === true,
    longevity: (row.longevity as string) ?? null,
    sillage: (row.sillage as string) ?? null,
    seasonScores: (row.season_scores as UserParfum['seasonScores']) ?? null,
    allNotes: Array.isArray(row.all_notes) ? row.all_notes as string[] : null,
    addedAt,
    updatedAt: toDate(row.updated_at) ?? addedAt,
  };
}

export function useProfileStats(uid: string | null): {
  favorisCount: number | null;
  wardrobeItems: UserParfum[];
  scansCount: number | null;
  loading: boolean;
  refresh: () => Promise<void>;
} {
  const [stats, setStats] = useState<ProfileStats>({
    favorisCount: null,
    wardrobeItems: [],
    scansCount: null,
    loading: true,
  });

  const fetchStats = useCallback(async () => {
    if (!uid) {
      setStats({ favorisCount: null, wardrobeItems: [], scansCount: null, loading: false });
      return;
    }
    setStats(prev => ({ ...prev, loading: true }));
    try {
      const [favRes, wardRes, scanRes] = await Promise.all([
        supabase.from('favoris').select('*', { count: 'exact', head: true }).eq('user_id', uid),
        supabase.from('user_parfum').select('*').eq('user_id', uid),
        supabase.from('scans').select('*', { count: 'exact', head: true }).eq('user_id', uid),
      ]);
      setStats({
        favorisCount: favRes.count ?? 0,
        wardrobeItems: ((wardRes.data ?? []) as Record<string, unknown>[]).map(rowToUserParfum),
        scansCount: scanRes.count ?? 0,
        loading: false,
      });
    } catch (e: unknown) {
      console.warn('[useProfileStats] fetch failed:', (e as Error)?.message ?? String(e));
      setStats({ favorisCount: null, wardrobeItems: [], scansCount: null, loading: false });
    }
  }, [uid]);

  useFocusEffect(
    useCallback(() => {
      void fetchStats();
    }, [fetchStats]),
  );

  return {
    favorisCount: stats.favorisCount,
    wardrobeItems: stats.wardrobeItems,
    scansCount: stats.scansCount,
    loading: stats.loading,
    refresh: fetchStats,
  };
}
