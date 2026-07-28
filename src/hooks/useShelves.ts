// src/hooks/useShelves.ts

import { useState, useEffect, useCallback } from 'react';
import { onShelves, createShelf, updateShelf, deleteShelf, reorderShelves } from '../services/user-parfum';
import type { Shelf } from '../models/user-parfum.interface';

export function useShelves(uid: string | null) {
  const [shelves, setShelves] = useState<Shelf[]>([]);

  useEffect(() => {
    if (!uid) { setShelves([]); return; }
    const unsub = onShelves(uid, (data) => { setShelves(data); });
    return () => unsub();
  }, [uid]);

  const create = useCallback(async (name: string, icon?: string, color?: string, description?: string) => {
    if (!uid) return;
    await createShelf(uid, name, icon, color, description);
  }, [uid]);

  const update = useCallback(async (shelfId: string, data: Parameters<typeof updateShelf>[2]) => {
    if (!uid) return;
    await updateShelf(uid, shelfId, data);
  }, [uid]);

  const remove = useCallback(async (shelfId: string) => {
    if (!uid) return;
    await deleteShelf(uid, shelfId);
  }, [uid]);

  const reorder = useCallback(async (items: { id: string; order: number }[]) => {
    if (!uid) return;
    await reorderShelves(uid, items);
  }, [uid]);

  return { shelves, create, update, remove, reorder };
}
