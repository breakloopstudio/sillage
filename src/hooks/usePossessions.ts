import { useState, useEffect, useCallback, useRef } from 'react';
import { getPossessions, addPossession, updatePossession, removePossession } from '../services/possessions';
import type { Possession, PossessionType } from '../models/user-parfum.interface';

export function usePossessions(uid: string | null, parfumId: string | null) {
  const [items, setItems] = useState<Possession[]>([]);
  const [loading, setLoading] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  const refresh = useCallback(async () => {
    if (!uid || !parfumId) { setItems([]); return; }
    setLoading(true);
    const data = await getPossessions(uid, parfumId);
    if (!mountedRef.current) return;
    setItems(data);
    setLoading(false);
  }, [uid, parfumId]);

  useEffect(() => { refresh(); }, [refresh]);

  const add = useCallback(async (type: PossessionType, sizeMl?: number | null, quantity?: number, forSale?: boolean, notes?: string | null) => {
    if (!uid || !parfumId) return '';
    const id = await addPossession(uid, parfumId, type, sizeMl, quantity, forSale, notes);
    await refresh();
    return id;
  }, [uid, parfumId, refresh]);

  const update = useCallback(async (possessionId: string, data: Parameters<typeof updatePossession>[2]) => {
    if (!uid) return;
    await updatePossession(uid, possessionId, data);
    await refresh();
  }, [uid, refresh]);

  const remove = useCallback(async (possessionId: string) => {
    if (!uid) return;
    await removePossession(uid, possessionId);
    await refresh();
  }, [uid, refresh]);

  return { items, loading, add, update, remove, refresh };
}
