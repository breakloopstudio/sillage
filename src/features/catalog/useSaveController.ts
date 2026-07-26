import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'expo-router';
import { useAuthContext } from '../../contexts/AuthContext';
import { addUserParfum, updateUserParfum, markTried as markTriedService, removeUserParfum, getUserParfum } from '../../services/user-parfum';
import { addPossession } from '../../services/possessions';
import { hapticsLight } from '../../services/haptics';
import { verdictLabel } from '../../utils/verdicts';
import type { TrySheetSaveData } from '../scentlist/TrySheet';
import type { Parfum } from '../../models';
import type { UserParfum, UserParfumStatus, ScentVerdict, PossessionType } from '../../models/user-parfum.interface';

const STATUS_LABELS: Record<UserParfumStatus, string> = {
  to_try: 'À sentir',
  tried: 'Senti',
  want: 'À sentir',
  have: 'Je l\u2019ai',
  had: 'Je l\u2019ai eu',
};

export function statusLabel(s: UserParfumStatus): string {
  return STATUS_LABELS[s];
}

export function useSaveController(parfum: Parfum | null) {
  const { user, isAuthenticated } = useAuthContext();
  const uid = user?.uid ?? null;
  const router = useRouter();
  const id = parfum?.id;

  const [item, setItem] = useState<UserParfum | null>(null);
  const [showSaveSheet, setShowSaveSheet] = useState(false);
  const [showTrySheet, setShowTrySheet] = useState(false);
  const [trySheetSaving, setTrySheetSaving] = useState(false);

  useEffect(() => {
    if (!uid || !id) { setItem(null); return; }
    setItem(null);
    let cancelled = false;
    getUserParfum(uid, id).then((r) => {
      if (!cancelled) setItem(r);
    });
    return () => { cancelled = true; };
  }, [uid, id]);

  const saveLabel = useMemo<string | null>(() => {
    if (!item) return null;
    if (item.status === 'tried' && item.verdict) {
      return verdictLabel(item.verdict) ?? STATUS_LABELS.tried;
    }
    return STATUS_LABELS[item.status];
  }, [item]);

  const openSaveSheet = useCallback(() => {
    if (!isAuthenticated) { router.push('/auth/login'); return; }
    hapticsLight();
    setShowSaveSheet(true);
  }, [isAuthenticated, router]);

  const closeSaveSheet = useCallback(() => setShowSaveSheet(false), []);
  const closeTrySheet = useCallback(() => setShowTrySheet(false), []);

  const setStatus = useCallback(async (status: UserParfumStatus) => {
    if (!uid || !id || !parfum) return;
    const prev = item;
    setItem(p => p
      ? { ...p, status, updatedAt: new Date() }
      : {
          parfumId: id, status, verdict: null, rating: null, notes: null, triedAt: null,
          shelfIds: [], sotdCount: 0, isSignature: false,
          nom: parfum.nom, marque: parfum.marque, imageUrl: parfum.imageUrl ?? null,
          familleOlactive: parfum.familleOlactive ?? null,
          addedAt: new Date(), updatedAt: new Date(),
        });
    if (prev) {
      await updateUserParfum(uid, id, { status }).catch(() => setItem(prev));
    } else {
      await addUserParfum(uid, id, status, parfum).catch(() => setItem(prev));
    }
  }, [uid, id, parfum, item]);

  const setVerdict = useCallback((verdict: ScentVerdict) => {
    if (!uid || !id) return;
    const prev = item;
    if (!item) return;
    const wasTried = item.status === 'tried' || item.status === 'want' || item.status === 'have' || item.status === 'had';
    setItem(p => (p ? { ...p, verdict, triedAt: p.triedAt ?? new Date(), status: p.status === 'to_try' ? 'tried' : p.status } : p));
    if (item.status === 'to_try') {
      markTriedService(uid, id, { verdict, rating: item.rating, notes: item.notes }).catch(() => setItem(prev));
    } else {
      updateUserParfum(uid, id, { verdict }).catch(() => setItem(prev));
    }
  }, [uid, id, item]);

  const remove = useCallback(() => {
    if (!uid || !id) return;
    const prev = item;
    setItem(null);
    setShowTrySheet(false);
    removeUserParfum(uid, id).catch(() => setItem(prev));
  }, [uid, id, item]);

  const addToTry = useCallback(() => {
    if (!uid || !id || !parfum) return;
    void setStatus('to_try');
  }, [uid, id, parfum, setStatus]);

  const addPoss = useCallback(async (type: PossessionType, sizeMl?: number | null) => {
    if (!uid || !id) return;
    await addPossession(uid, id, type, sizeMl);
    if (!item || item.status === 'to_try' || item.status === 'tried' || item.status === 'want') {
      await setStatus('have');
    }
  }, [uid, id, item, setStatus]);

  const setRating = useCallback((rating: number | null) => {
    if (!uid || !id || !item) return;
    const prev = item;
    setItem(p => (p ? { ...p, rating, updatedAt: new Date() } : p));
    updateUserParfum(uid, id, { rating }).catch(() => setItem(prev));
  }, [uid, id, item]);

  const setNotes = useCallback((notes: string | null) => {
    if (!uid || !id || !item) return;
    const prev = item;
    setItem(p => (p ? { ...p, notes, updatedAt: new Date() } : p));
    updateUserParfum(uid, id, { notes }).catch(() => setItem(prev));
  }, [uid, id, item]);

  const toggleShelf = useCallback((shelfId: string) => {
    if (!uid || !id || !item) return;
    const prev = item;
    const next = item.shelfIds.includes(shelfId)
      ? item.shelfIds.filter(s => s !== shelfId)
      : [...item.shelfIds, shelfId];
    setItem(p => (p ? { ...p, shelfIds: next, updatedAt: new Date() } : p));
    updateUserParfum(uid, id, { shelfIds: next }).catch(() => setItem(prev));
  }, [uid, id, item]);

  const toggleSignature = useCallback(() => {
    if (!uid || !id || !item) return;
    const prev = item;
    const next = !item.isSignature;
    setItem(p => (p ? { ...p, isSignature: next, updatedAt: new Date() } : p));
    updateUserParfum(uid, id, { isSignature: next }).catch(() => setItem(prev));
  }, [uid, id, item]);

  const openFullNotes = useCallback(() => {
    setShowSaveSheet(false);
    setShowTrySheet(true);
  }, []);

  const handleTrySheetSave = useCallback(async (data: TrySheetSaveData) => {
    if (!uid || !id) return;
    setTrySheetSaving(true);
    try {
      if (item && (item.status === 'tried' || item.status === 'want' || item.status === 'have' || item.status === 'had')) {
        await updateUserParfum(uid, id, { verdict: data.verdict, rating: data.rating, notes: data.notes });
        setItem(prev => (prev ? { ...prev, verdict: data.verdict, rating: data.rating, notes: data.notes } : null));
      } else {
        await markTriedService(uid, id, data);
        setItem(prev => (prev ? { ...prev, status: 'tried', verdict: data.verdict, rating: data.rating, notes: data.notes, triedAt: new Date() } : null));
      }
      if (data.addToWardrobe) {
        await addPossession(uid, id, 'sample');
        await updateUserParfum(uid, id, { status: 'have' });
        setItem(prev => (prev ? { ...prev, status: 'have' } : null));
      }
    } catch (e: unknown) {
      console.warn('[save] trySheet save failed:', (e as Error)?.message ?? String(e));
    } finally {
      setTrySheetSaving(false);
      setShowTrySheet(false);
    }
  }, [uid, id, item]);

  return {
    item, saveLabel,
    showSaveSheet, showTrySheet, trySheetSaving,
    openSaveSheet, closeSaveSheet, closeTrySheet,
    setStatus, setVerdict, remove, addToTry, addPoss,
    setRating, setNotes, toggleShelf, toggleSignature,
    openFullNotes, handleTrySheetSave,
  };
}
