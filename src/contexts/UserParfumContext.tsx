import { createContext, useContext, useEffect, useMemo, useState, useCallback, type ReactNode } from 'react';
import { onUserParfums, addUserParfum, updateUserParfum, markTried as markTriedService, removeUserParfum, getUserParfum } from '../services/user-parfum';
import { useAuthContext } from './AuthContext';
import type { UserParfum, UserParfumStatus, ScentVerdict } from '../models/user-parfum.interface';
import type { Parfum } from '../models/parfum.interface';

interface UserParfumContextValue {
  items: UserParfum[];
  loading: boolean;
  statusByParfumId: Map<string, UserParfumStatus>;
  add: (parfumId: string, status: UserParfumStatus, parfum?: Parfum) => Promise<void>;
  update: (parfumId: string, data: Parameters<typeof updateUserParfum>[2]) => Promise<void>;
  markTried: (parfumId: string, data: { verdict: ScentVerdict | null; rating: number | null; notes: string | null }) => Promise<void>;
  remove: (parfumId: string) => Promise<void>;
  get: (parfumId: string) => Promise<UserParfum | null>;
}

const UserParfumContext = createContext<UserParfumContextValue | null>(null);

export function UserParfumProvider({ children }: { children: ReactNode }) {
  const { user } = useAuthContext();
  const uid = user?.uid ?? null;
  const [items, setItems] = useState<UserParfum[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) { setItems([]); setLoading(false); return; }
    setLoading(true);
    const unsub = onUserParfums(uid, (data) => { setItems(data); setLoading(false); });
    return unsub;
  }, [uid]);

  const statusByParfumId = useMemo(() => new Map(items.map(i => [i.parfumId, i.status])), [items]);

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

  const value = useMemo<UserParfumContextValue>(() => ({
    items, loading, statusByParfumId, add, update, markTried, remove, get,
  }), [items, loading, statusByParfumId, add, update, markTried, remove, get]);

  return <UserParfumContext.Provider value={value}>{children}</UserParfumContext.Provider>;
}

export function useUserParfumContext(): UserParfumContextValue {
  const ctx = useContext(UserParfumContext);
  if (!ctx) throw new Error('useUserParfumContext must be used within UserParfumProvider');
  return ctx;
}
