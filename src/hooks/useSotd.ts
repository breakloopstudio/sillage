// src/hooks/useSotd.ts

import { useState, useEffect, useCallback } from 'react';
import { getTodaySotd, setSotd } from '../services/wardrobe';
import type { SotdEntry, WardrobeItem } from '../models/wardrobe.interface';

export function useSotd(uid: string | null) {
  const [sotd, setSotdState] = useState<SotdEntry | null>(null);

  const refresh = useCallback(async () => {
    if (!uid) { setSotdState(null); return; }
    const entry = await getTodaySotd(uid);
    setSotdState(entry);
  }, [uid]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const setTodaySotd = useCallback(async (item: WardrobeItem) => {
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
      setSotdState(prev);
    }
  }, [uid, sotd]);

  return { sotd, setTodaySotd, refresh };
}
