import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'expo-router';
import i18next from 'i18next';
import { useAuthContext } from '../../contexts/AuthContext';
import { addUserParfum, updateUserParfum, markTried as markTriedService, removeUserParfum, getUserParfum } from '../../services/user-parfum';
import { addPossession } from '../../services/possessions';
import { hapticsLight } from '../../services/haptics';
import { verdictLabel } from '../../utils/verdicts';
import type { TrySheetSaveData } from '../scentlist/TrySheet';
import type { Parfum } from '../../models';
import type { UserParfum, UserParfumStatus, ScentVerdict, PossessionType } from '../../models/user-parfum.interface';

// Labels résolus à l'appel via i18next (§23) — statusLabel est invoquée au render.
type SaveStatusKey = 'save.status.toTry' | 'save.status.tried' | 'save.status.have' | 'save.status.had';
const STATUS_LABEL_KEYS: Record<UserParfumStatus, SaveStatusKey> = {
  to_try: 'save.status.toTry',
  tried: 'save.status.tried',
  want: 'save.status.toTry',
  have: 'save.status.have',
  had: 'save.status.had',
};

export function statusLabel(s: UserParfumStatus): string {
  return i18next.t(STATUS_LABEL_KEYS[s]);
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
  const itemRef = useRef<UserParfum | null>(null);
  itemRef.current = item;

  useEffect(() => {
    if (!uid || !id) { setItem(null); return; }
    setItem(null);
    let cancelled = false;
    getUserParfum(uid, id)
      .then((r) => {
        if (!cancelled) setItem(r);
      })
      .catch((e: unknown) => {
        console.warn('[save] getUserParfum failed:', (e as Error)?.message ?? String(e));
      });
    return () => { cancelled = true; };
  }, [uid, id]);

  const saveLabel = useMemo<string | null>(() => {
    if (!item) return null;
    if (item.status === 'tried' && item.verdict) {
      return verdictLabel(item.verdict) ?? statusLabel('tried');
    }
    return statusLabel(item.status);
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
    const prev = itemRef.current;
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
  }, [uid, id, parfum]);

  const setVerdict = useCallback((verdict: ScentVerdict) => {
    if (!uid || !id) return;
    const prev = itemRef.current;
    if (!prev) return;
    setItem(p => (p ? { ...p, verdict, triedAt: p.triedAt ?? new Date(), status: p.status === 'to_try' ? 'tried' : p.status } : p));
    if (prev.status === 'to_try') {
      markTriedService(uid, id, { verdict, rating: prev.rating, notes: prev.notes }).catch(() => setItem(prev));
    } else {
      updateUserParfum(uid, id, { verdict }).catch(() => setItem(prev));
    }
  }, [uid, id]);

  const remove = useCallback(() => {
    if (!uid || !id) return;
    const prev = itemRef.current;
    setItem(null);
    setShowTrySheet(false);
    removeUserParfum(uid, id).catch(() => setItem(prev));
  }, [uid, id]);

  const addToTry = useCallback(() => {
    if (!uid || !id || !parfum) return;
    void setStatus('to_try');
  }, [uid, id, parfum, setStatus]);

  const addPoss = useCallback(async (type: PossessionType, sizeMl?: number | null) => {
    if (!uid || !id) return;
    try {
      await addPossession(uid, id, type, sizeMl);
      const cur = itemRef.current;
      if (!cur || cur.status === 'to_try' || cur.status === 'tried' || cur.status === 'want') {
        await setStatus('have');
      }
    } catch (e: unknown) {
      console.warn('[save] addPossession failed:', (e as Error)?.message ?? String(e));
    }
  }, [uid, id, setStatus]);

  const setRating = useCallback((rating: number | null) => {
    if (!uid || !id || !itemRef.current) return;
    const prev = itemRef.current;
    setItem(p => (p ? { ...p, rating, updatedAt: new Date() } : p));
    updateUserParfum(uid, id, { rating }).catch(() => setItem(prev));
  }, [uid, id]);

  const setNotes = useCallback((notes: string | null) => {
    if (!uid || !id || !itemRef.current) return;
    const prev = itemRef.current;
    setItem(p => (p ? { ...p, notes, updatedAt: new Date() } : p));
    updateUserParfum(uid, id, { notes }).catch(() => setItem(prev));
  }, [uid, id]);

  const toggleShelf = useCallback((shelfId: string) => {
    if (!uid || !id || !itemRef.current) return;
    const prev = itemRef.current;
    const next = prev.shelfIds.includes(shelfId)
      ? prev.shelfIds.filter(s => s !== shelfId)
      : [...prev.shelfIds, shelfId];
    setItem(p => (p ? { ...p, shelfIds: next, updatedAt: new Date() } : p));
    updateUserParfum(uid, id, { shelfIds: next }).catch(() => setItem(prev));
  }, [uid, id]);

  const toggleSignature = useCallback(() => {
    if (!uid || !id || !itemRef.current) return;
    const prev = itemRef.current;
    const next = !prev.isSignature;
    setItem(p => (p ? { ...p, isSignature: next, updatedAt: new Date() } : p));
    updateUserParfum(uid, id, { isSignature: next }).catch(() => setItem(prev));
  }, [uid, id]);

  const openFullNotes = useCallback(() => {
    setShowSaveSheet(false);
    setShowTrySheet(true);
  }, []);

  const handleTrySheetSave = useCallback(async (data: TrySheetSaveData) => {
    if (!uid || !id) return;
    setTrySheetSaving(true);
    const cur = itemRef.current;
    try {
      if (cur && (cur.status === 'tried' || cur.status === 'want' || cur.status === 'have' || cur.status === 'had')) {
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
  }, [uid, id]);

  return useMemo(() => ({
    item, saveLabel,
    showSaveSheet, showTrySheet, trySheetSaving,
    openSaveSheet, closeSaveSheet, closeTrySheet,
    setStatus, setVerdict, remove, addToTry, addPoss,
    setRating, setNotes, toggleShelf, toggleSignature,
    openFullNotes, handleTrySheetSave,
  }), [
    item, saveLabel, showSaveSheet, showTrySheet, trySheetSaving,
    openSaveSheet, closeSaveSheet, closeTrySheet,
    setStatus, setVerdict, remove, addToTry, addPoss,
    setRating, setNotes, toggleShelf, toggleSignature,
    openFullNotes, handleTrySheetSave,
  ]);
}
