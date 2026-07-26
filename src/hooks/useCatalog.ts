// src/hooks/useCatalog.ts — Recherche catalogue Firestore (100% cache local)
// Rate limit : 30 recherches/min max (protection anti-abus)

import { useState, useCallback, useRef, useEffect } from 'react';
import type { Parfum } from '../models';
import { searchParfumsCached, peekSearchCache } from '../services/firestore';

const MAX_SEARCHES_PER_MINUTE = 30;
const RATE_WINDOW_MS = 60_000;

export function useCatalog() {
  const [parfums, setParfums] = useState<Parfum[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rateLimited, setRateLimited] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);
  const mountedRef = useRef(true);
  const searchTimestampsRef = useRef<number[]>([]);
  const prevParfumsRef = useRef<Parfum[]>([]);

  useEffect(() => {
    return () => { mountedRef.current = false; if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  const search = useCallback((query: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    const q = query.trim();
    if (q.length < 3) { setParfums([]); setSearching(false); setError(null); setRateLimited(false); return; }
    setSearching(true);
    setError(null);
    setRateLimited(false);
    const id = ++requestIdRef.current;
    timerRef.current = setTimeout(async () => {
      try {
        // Cache hit — skip rate budget (no Firestore read)
        const cached = peekSearchCache(q);

        // Rate limit : sliding window, max N appels Firestore par minute
        if (!cached) {
          const now = Date.now();
          const windowStart = now - RATE_WINDOW_MS;
          const timestamps = searchTimestampsRef.current;
          while (timestamps.length > 0 && timestamps[0] < windowStart) {
            timestamps.shift();
          }
          if (timestamps.length >= MAX_SEARCHES_PER_MINUTE) {
            if (mountedRef.current && requestIdRef.current === id) {
              setSearching(false);
              setRateLimited(true);
              if (prevParfumsRef.current.length > 0) {
                setParfums(prevParfumsRef.current);
              }
            }
            return;
          }
          timestamps.push(now);
        }

        const results = await searchParfumsCached(q);
        if (mountedRef.current && requestIdRef.current === id) {
          setParfums(results);
          setSearching(false);
          setError(null);
          setRateLimited(false);
          if (results.length > 0) prevParfumsRef.current = results;
        }
      } catch (err) {
        console.warn('[useCatalog] search failed:', (err as Error)?.message ?? String(err));
        if (mountedRef.current && requestIdRef.current === id) {
          setSearching(false);
          setError((err as Error)?.message ?? 'La recherche a échoué.');
          setRateLimited(false);
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
    setRateLimited(false);
    prevParfumsRef.current = [];
  }, []);

  return { parfums, searching, error, rateLimited, search, clear };
}
