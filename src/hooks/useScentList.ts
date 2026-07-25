// src/hooks/useScentList.ts — Carnet d'essais temps réel

import { useState, useEffect, useCallback, useMemo } from 'react';
import { onScentList, addToScentList, updateScentItem, markScentTried, removeFromScentList, moveScentToWardrobe } from '../services/scentlist';
import type { UserScentItem, ScentVerdict, Parfum } from '../models';
import type { WardrobeItem } from '../models/wardrobe.interface';

export function useScentList(uid: string | null) {
  const [items, setItems] = useState<UserScentItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) { setItems([]); setLoading(false); return; }
    setLoading(true);
    const unsub = onScentList(uid, (data) => { setItems(data); setLoading(false); });
    return unsub;
  }, [uid]);

  const toTry = useMemo(() => items.filter(i => i.status === 'to_try'), [items]);
  const tried = useMemo(() => items.filter(i => i.status === 'tried'), [items]);

  const add = useCallback(async (parfum: Parfum) => {
    if (!uid) return;
    await addToScentList(uid, parfum);
  }, [uid]);

  const update = useCallback(async (parfumId: string,
    data: Partial<Pick<UserScentItem, 'verdict' | 'rating' | 'notes' | 'status' | 'triedAt'>>,
  ) => {
    if (!uid) return;
    await updateScentItem(uid, parfumId, data);
  }, [uid]);

  const markTried = useCallback(async (parfumId: string,
    data: { verdict: ScentVerdict | null; rating: number | null; notes: string | null },
  ) => {
    if (!uid) return;
    await markScentTried(uid, parfumId, data);
  }, [uid]);

  const remove = useCallback(async (parfumId: string) => {
    if (!uid) return;
    await removeFromScentList(uid, parfumId);
  }, [uid]);

  const moveToWardrobe = useCallback(async (item: UserScentItem,
    ownership: WardrobeItem['ownership'], sizeMl?: number | null,
  ) => {
    if (!uid) return;
    await moveScentToWardrobe(uid, item, ownership, sizeMl ?? null);
  }, [uid]);

  return { items, toTry, tried, loading, add, update, markTried, remove, moveToWardrobe };
}
