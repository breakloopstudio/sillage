// src/contexts/FavorisContext.tsx
// Source de vérité unique pour les favoris (1 subscription temps réel partagée).
// Remplace les états locaux éclatés (useFavoris, isParfumFavori, état fiche détail).

import { createContext, useContext, useEffect, useMemo, useState, useCallback, useRef, type ReactNode } from 'react';
import { onFavoris, addFavori, removeFavori as removeFavoriService } from '../services/user-data';
import { useAuthContext } from './AuthContext';
import type { UserFavori, Parfum } from '../models';

interface FavorisContextValue {
  favoris: UserFavori[];
  favIds: Set<string>;
  loading: boolean;
  isFav: (parfumId: string) => boolean;
  toggleFav: (parfum: Parfum) => void;
  removeFavori: (parfumId: string) => void;
}

const FavorisContext = createContext<FavorisContextValue | null>(null);

export function FavorisProvider({ children }: { children: ReactNode }) {
  const { user } = useAuthContext();
  const uid = user?.uid ?? null;
  const [favoris, setFavoris] = useState<UserFavori[]>([]);
  const [loading, setLoading] = useState(true);
  const favorisRef = useRef<UserFavori[]>([]);

  useEffect(() => { favorisRef.current = favoris; }, [favoris]);

  useEffect(() => {
    if (!uid) { setFavoris([]); setLoading(false); return; }
    setLoading(true);
    const unsub = onFavoris(uid, (data) => { setFavoris(data); setLoading(false); });
    return unsub;
  }, [uid]);

  const favIds = useMemo(() => new Set(favoris.map(f => f.parfumId)), [favoris]);

  const isFav = useCallback((parfumId: string) => favIds.has(parfumId), [favIds]);

  const toggleFav = useCallback((parfum: Parfum) => {
    if (!uid) return;
    const existing = favorisRef.current.find(f => f.parfumId === parfum.id);
    if (existing) {
      setFavoris(prev => prev.filter(f => f.parfumId !== parfum.id));
      removeFavoriService(uid, parfum.id).catch(() => {
        setFavoris(prev => (prev.some(f => f.parfumId === parfum.id) ? prev : [existing, ...prev]));
      });
    } else {
      const optimistic: UserFavori = {
        id: parfum.id,
        parfumId: parfum.id,
        nom: parfum.nom,
        marque: parfum.marque,
        imageUrl: parfum.imageUrl,
        familleOlactive: parfum.familleOlactive,
        bestPrice: parfum.bestPrice,
        referencePrice: parfum.referencePrice,
        annee: parfum.annee,
        addedAt: new Date(),
      };
      setFavoris(prev => (prev.some(f => f.parfumId === parfum.id) ? prev : [optimistic, ...prev]));
      addFavori(uid, parfum).catch(() => {
        setFavoris(prev => prev.filter(f => f.parfumId !== parfum.id));
      });
    }
  }, [uid]);

  const removeFavori = useCallback((parfumId: string) => {
    if (!uid) return;
    const existing = favorisRef.current.find(f => f.parfumId === parfumId);
    setFavoris(prev => prev.filter(f => f.parfumId !== parfumId));
    removeFavoriService(uid, parfumId).catch(() => {
      setFavoris(prev => {
        if (prev.some(f => f.parfumId === parfumId)) return prev;
        return existing ? [existing, ...prev] : prev;
      });
    });
  }, [uid]);

  const value = useMemo<FavorisContextValue>(() => ({
    favoris, favIds, loading, isFav, toggleFav, removeFavori,
  }), [favoris, favIds, loading, isFav, toggleFav, removeFavori]);

  return <FavorisContext.Provider value={value}>{children}</FavorisContext.Provider>;
}

export function useFavorisContext(): FavorisContextValue {
  const ctx = useContext(FavorisContext);
  if (!ctx) throw new Error('useFavorisContext must be used within FavorisProvider');
  return ctx;
}
