import { useState, useEffect } from 'react';
import { getPublicProfile, getPublicCollection } from '../services/profile';
import type { PublicProfile, PublicCollectionItem } from '../models/profile.interface';

export function usePublicProfile(pseudo: string | null) {
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [collection, setCollection] = useState<PublicCollectionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!pseudo) { setProfile(null); setCollection([]); setLoading(false); setError(false); return; }
    let cancelled = false;
    setLoading(true);
    setError(false);
    void (async () => {
      const [p, c] = await Promise.all([getPublicProfile(pseudo), getPublicCollection(pseudo)]);
      if (cancelled) return;
      if (p === null && c.length === 0) setError(true);
      setProfile(p);
      setCollection(c);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [pseudo]);

  return { profile, collection, loading, error };
}
