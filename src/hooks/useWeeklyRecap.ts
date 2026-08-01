import { useState, useEffect, useRef, useCallback } from 'react';
import { getWeeklyRecap, type WeeklyRecap } from '../services/recap';

export function useWeeklyRecap(uid: string | null) {
  const [recap, setRecap] = useState<WeeklyRecap | null>(null);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const refresh = useCallback(async () => {
    if (!uid) { setRecap(null); setLoading(false); return; }
    setLoading(true);
    const r = await getWeeklyRecap(uid);
    if (!mountedRef.current) return;
    setRecap(r);
    setLoading(false);
  }, [uid]);

  useEffect(() => { void refresh(); }, [refresh]);

  return { recap, loading, refresh };
}
