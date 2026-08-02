import { useEffect, useRef, useState } from 'react';
import type { Parfum } from '../models';
import { getCached, getOrFetch } from '../services/impl/home-cache';

export function useStaleWhileRevalidate(
  key: string,
  fetcher: () => Promise<Parfum[]>,
): { data: Parfum[]; loading: boolean } {
  const [data, setData] = useState<Parfum[]>([]);
  const [resolved, setResolved] = useState(false);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  useEffect(() => {
    let cancelled = false;
    setData([]);
    setResolved(false);
    (async () => {
      const cached = await getCached(key);
      if (cancelled) return;
      if (cached) {
        setData(cached.data);
        setResolved(true);
      }
      if (cached && cached.fresh) return;
      const fresh = await getOrFetch(key, fetcherRef.current);
      if (cancelled) return;
      if (fresh.length > 0) setData(fresh);
      setResolved(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [key]);

  return { data, loading: !resolved };
}
