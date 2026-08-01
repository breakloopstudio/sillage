import { useState, useEffect, useCallback, useRef } from 'react';
import { getTodaySotd, setSotd } from '../services/user-parfum';
import { getSotdStreak } from '../services/recap';
import type { SotdEntry, UserParfum } from '../models/user-parfum.interface';

export function useSotd(uid: string | null) {
  const [sotd, setSotdState] = useState<SotdEntry | null>(null);
  const [streak, setStreak] = useState(0);
  const mountedRef = useRef(true);

  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  const refreshStreak = useCallback(async () => {
    if (!uid) { setStreak(0); return; }
    const n = await getSotdStreak(uid);
    if (mountedRef.current) setStreak(n);
  }, [uid]);

  const refresh = useCallback(async () => {
    if (!uid) { setSotdState(null); setStreak(0); return; }
    const [entry, n] = await Promise.all([getTodaySotd(uid), getSotdStreak(uid)]);
    if (!mountedRef.current) return;
    setSotdState(entry);
    setStreak(n);
  }, [uid]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const setTodaySotd = useCallback(async (item: UserParfum) => {
    if (!uid) return;
    const prev = sotd;
    setSotdState({
      parfumId: item.parfumId,
      nom: item.nom ?? item.parfumId,
      marque: item.marque ?? '',
      imageUrl: item.imageUrl,
    });
    try {
      await setSotd(uid, item.parfumId, item.nom ?? item.parfumId, item.marque ?? '', item.imageUrl);
      void refreshStreak();
    } catch (e) {
      console.warn('[sotd] setTodaySotd failed:', (e as Error)?.message ?? String(e));
      if (mountedRef.current) setSotdState(prev);
    }
  }, [uid, sotd, refreshStreak]);

  return { sotd, streak, setTodaySotd, refresh };
}
