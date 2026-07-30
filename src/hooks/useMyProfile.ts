import { useState, useEffect, useCallback, useRef } from 'react';
import { getMyProfile, upsertMyProfile, type ProfileInput } from '../services/profile';
import type { MyProfile } from '../models/profile.interface';

export function useMyProfile(uid: string | null) {
  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  const refresh = useCallback(async () => {
    if (!uid) { setProfile(null); setLoading(false); return; }
    try {
      const p = await getMyProfile(uid);
      if (!mountedRef.current) return;
      setProfile(p);
    } catch (e: unknown) {
      console.warn('[useMyProfile] refresh failed:', (e as Error)?.message ?? String(e));
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [uid]);

  useEffect(() => { void refresh(); }, [refresh]);

  /** Throw si échec (ex. pseudo pris) — l'UI traduit l'erreur. */
  const save = useCallback(async (input: ProfileInput) => {
    if (!uid) return;
    await upsertMyProfile(uid, input);
    await refresh();
  }, [uid, refresh]);

  return { profile, loading, save, refresh };
}
