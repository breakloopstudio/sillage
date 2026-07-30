// src/contexts/ShelvesContext.tsx
// Source de vérité unique pour les étagères (1 subscription temps réel partagée).
// Évite la double subscription onShelves quand la fiche détail (RelationSection)
// est ouverte par-dessus l'onglet Ma Parfumerie (collection).

import { createContext, useContext, useEffect, useMemo, useState, useCallback, type ReactNode } from 'react';
import { onShelves, createShelf, updateShelf, deleteShelf, reorderShelves } from '../services/user-parfum';
import { useAuthContext } from './AuthContext';
import type { Shelf } from '../models/user-parfum.interface';

interface ShelvesContextValue {
  shelves: Shelf[];
  create: (name: string, icon?: string, color?: string, description?: string) => Promise<void>;
  update: (shelfId: string, data: Parameters<typeof updateShelf>[2]) => Promise<void>;
  remove: (shelfId: string) => Promise<void>;
  reorder: (items: { id: string; order: number }[]) => Promise<void>;
}

const ShelvesContext = createContext<ShelvesContextValue | null>(null);

export function ShelvesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuthContext();
  const uid = user?.uid ?? null;
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

  const value = useMemo<ShelvesContextValue>(() => ({
    shelves, create, update, remove, reorder,
  }), [shelves, create, update, remove, reorder]);

  return <ShelvesContext.Provider value={value}>{children}</ShelvesContext.Provider>;
}

export function useShelvesContext(): ShelvesContextValue {
  const ctx = useContext(ShelvesContext);
  if (!ctx) throw new Error('useShelvesContext must be used within ShelvesProvider');
  return ctx;
}
