import { useState, useCallback, useRef, useEffect } from 'react';
import { useFocusEffect } from 'expo-router';
import { supabase } from '../services/supabase';
import type { UserParfum } from '../models/user-parfum.interface';
import { rowToUserParfum } from '../services/user-parfum';

interface ProfileStats {
  favorisCount: number | null;
  wardrobeItems: UserParfum[];
  scansCount: number | null;
  loading: boolean;
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
  const mountedRef = useRef(true);

  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  const fetchStats = useCallback(async () => {
    if (!uid) {
      setStats({ favorisCount: null, wardrobeItems: [], scansCount: null, loading: false });
      return;
    }
    setStats(prev => ({ ...prev, loading: true }));
    try {
      const [favRes, wardRes, scanRes] = await Promise.all([
        supabase.from('favoris').select('*', { count: 'exact', head: true }).eq('user_id', uid),
        supabase.from('user_parfum').select('*').eq('user_id', uid).in('status', ['have', 'had']),
        supabase.from('scans').select('*', { count: 'exact', head: true }).eq('user_id', uid),
      ]);
      const err = favRes.error ?? wardRes.error ?? scanRes.error;
      if (err) throw err;
      if (!mountedRef.current) return;
      setStats({
        favorisCount: favRes.count ?? 0,
        wardrobeItems: ((wardRes.data ?? []) as Record<string, unknown>[]).map(rowToUserParfum),
        scansCount: scanRes.count ?? 0,
        loading: false,
      });
    } catch (e: unknown) {
      console.warn('[useProfileStats] fetch failed:', (e as Error)?.message ?? String(e));
      if (mountedRef.current) setStats({ favorisCount: null, wardrobeItems: [], scansCount: null, loading: false });
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
