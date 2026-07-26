import { useState, useEffect, useCallback, useMemo } from 'react';
import { onUserParfums, addUserParfum, updateUserParfum, markTried as markTriedService, removeUserParfum, getUserParfum } from '../services/user-parfum';
import type { UserParfum, UserParfumStatus, ScentVerdict } from '../models/user-parfum.interface';
import type { Parfum } from '../models/parfum.interface';

export function useUserParfum(uid: string | null) {
  const [items, setItems] = useState<UserParfum[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) { setItems([]); setLoading(false); return; }
    setLoading(true);
    const unsub = onUserParfums(uid, (data) => { setItems(data); setLoading(false); });
    return unsub;
  }, [uid]);

  const toTry = useMemo(() => items.filter(i => i.status === 'to_try'), [items]);
  const tried = useMemo(() => items.filter(i => i.status === 'tried'), [items]);
  const want = useMemo(() => items.filter(i => i.status === 'want'), [items]);
  const have = useMemo(() => items.filter(i => i.status === 'have'), [items]);
  const had = useMemo(() => items.filter(i => i.status === 'had'), [items]);

  const add = useCallback(async (parfumId: string, status: UserParfumStatus, parfum?: Parfum) => {
    if (!uid) return;
    await addUserParfum(uid, parfumId, status, parfum);
  }, [uid]);

  const update = useCallback(async (parfumId: string, data: Parameters<typeof updateUserParfum>[2]) => {
    if (!uid) return;
    await updateUserParfum(uid, parfumId, data);
  }, [uid]);

  const markTried = useCallback(async (parfumId: string, data: { verdict: ScentVerdict | null; rating: number | null; notes: string | null }) => {
    if (!uid) return;
    await markTriedService(uid, parfumId, data);
  }, [uid]);

  const remove = useCallback(async (parfumId: string) => {
    if (!uid) return;
    await removeUserParfum(uid, parfumId);
  }, [uid]);

  const get = useCallback(async (parfumId: string) => {
    if (!uid) return null;
    return getUserParfum(uid, parfumId);
  }, [uid]);

  return { items, toTry, tried, want, have, had, loading, add, update, markTried, remove, get };
}
