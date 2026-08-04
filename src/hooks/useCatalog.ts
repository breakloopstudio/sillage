// src/hooks/useCatalog.ts — Recherche catalogue (RPC Supabase + cache LRU)

import { useState, useCallback, useRef, useEffect } from 'react';
import type { Parfum } from '../models';
import i18next from 'i18next';
import { searchParfumsCached } from '../services/catalog';

export function useCatalog() {
  const [parfums, setParfums] = useState<Parfum[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  const search = useCallback((query: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    const q = query.trim();
    if (q.length < 2) { setParfums([]); setSearching(false); setError(null); return; }
    setSearching(true);
    setError(null);
    const id = ++requestIdRef.current;
    timerRef.current = setTimeout(async () => {
      try {
        const results = await searchParfumsCached(q);
        if (mountedRef.current && requestIdRef.current === id) {
          setParfums(results);
          setSearching(false);
          setError(null);
        }
      } catch (err) {
        console.warn('[useCatalog] search failed:', (err as Error)?.message ?? String(err));
        if (mountedRef.current && requestIdRef.current === id) {
          setSearching(false);
          setError((err as Error)?.message ?? i18next.t('search.searchFailedMsg'));
        }
      }
    }, 150);
  }, []);

  const clear = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    requestIdRef.current++;
    setParfums([]);
    setSearching(false);
    setError(null);
  }, []);

  /** Injecte des résultats déjà calculés (pipeline voix) sans re-requête. */
  const inject = useCallback((results: Parfum[]) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    requestIdRef.current++;
    setParfums(results);
    setSearching(false);
    setError(null);
  }, []);

  return { parfums, searching, error, search, clear, inject };
}
