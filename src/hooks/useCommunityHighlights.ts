import { useState, useEffect, useRef } from 'react';
import { getCommunityHighlights, type CommunityHighlights } from '../services/community';

const EMPTY: CommunityHighlights = { top_loved: [], trending: [], public_profiles: [], sotd_today: [] };

export function useCommunityHighlights() {
  const [data, setData] = useState<CommunityHighlights>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    setLoading(true);
    getCommunityHighlights()
      .then((d) => { if (mountedRef.current) { setData(d); setLoading(false); } })
      .catch((e: unknown) => {
        console.warn('[useCommunityHighlights]', (e as Error)?.message ?? String(e));
        if (mountedRef.current) { setError('Impossible de charger la communauté.'); setLoading(false); }
      });
    return () => { mountedRef.current = false; };
  }, []);

  return { ...data, loading, error };
}
