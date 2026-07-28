// src/hooks/useSotd.ts

import { useState, useEffect, useCallback, useRef } from 'react';
import { getTodaySotd, setSotd } from '../services/user-parfum';
import type { SotdEntry, UserParfum } from '../models/user-parfum.interface';

export function useSotd(uid: string | null) {
  const [sotd, setSotdState] = useState<SotdEntry | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  const refresh = useCallback(async () => {
    if (!uid) { setSotdState(null); return; }
    const entry = await getTodaySotd(uid);
    if (!mountedRef.current) return;
    setSotdState(entry);
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
    } catch (e) {
      console.warn('[sotd] setTodaySotd failed:', (e as Error)?.message ?? String(e));
      if (mountedRef.current) setSotdState(prev);
    }
  }, [uid, sotd]);

  return { sotd, setTodaySotd, refresh };
}
