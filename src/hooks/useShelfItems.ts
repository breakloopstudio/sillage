import { useState, useEffect, useMemo } from 'react';
import { onShelfItems } from '../services/user-parfum';
import type { ShelfItem } from '../models/user-parfum.interface';

export interface ShelfItemsView {
  orderedParfumIds: string[];
  pinned: Set<string>;
}

export function useShelfItems(uid: string | null) {
  const [items, setItems] = useState<ShelfItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) { setItems([]); setLoading(false); return; }
    setLoading(true);
    const unsub = onShelfItems(uid, (data) => { setItems(data); setLoading(false); });
    return unsub;
  }, [uid]);

  const byShelf = useMemo(() => {
    const map = new Map<string, ShelfItemsView>();
    const buckets = new Map<string, ShelfItem[]>();
    for (const it of items) {
      const arr = buckets.get(it.shelfId) ?? [];
      arr.push(it);
      buckets.set(it.shelfId, arr);
    }
    for (const [shelfId, arr] of buckets) {
      const sorted = [...arr].sort((a, b) => (Number(b.pinned) - Number(a.pinned)) || (a.position - b.position));
      const pinned = new Set<string>();
      const orderedParfumIds: string[] = [];
      for (const s of sorted) {
        orderedParfumIds.push(s.parfumId);
        if (s.pinned) pinned.add(s.parfumId);
      }
      map.set(shelfId, { orderedParfumIds, pinned });
    }
    return map;
  }, [items]);

  return { byShelf, loading } as const;
}
