import { useState, useEffect, useRef, useCallback } from 'react';
import {
  getCommunityHighlights,
  getSotdCommunityToday,
  clearCommunityCache,
  type CommunityHighlights,
  type CommunitySotd,
} from '../services/community';

const EMPTY: CommunityHighlights = { top_loved: [], trending: [], public_profiles: [] };

export function useCommunityHighlights() {
  const [data, setData] = useState<CommunityHighlights>(EMPTY);
  const [sotdToday, setSotdToday] = useState<CommunitySotd[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const fetch = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.allSettled([getCommunityHighlights(), getSotdCommunityToday()])
      .then(([highlights, sotd]) => {
        if (!mountedRef.current) return;
        if (highlights.status === 'fulfilled') {
          setData(highlights.value);
        } else {
          console.warn('[useCommunityHighlights]', (highlights.reason as Error)?.message ?? String(highlights.reason));
          setError('Impossible de charger la communauté.');
        }
        if (sotd.status === 'fulfilled') setSotdToday(sotd.value);
        setLoading(false);
      });
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const refresh = useCallback(() => { clearCommunityCache(); fetch(); }, [fetch]);

  return { ...data, sotd_today: sotdToday, loading, error, refresh };
}
