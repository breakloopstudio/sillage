import { useState, useEffect } from 'react';
import { getPublicProfile, getPublicCollection } from '../services/profile';
import type { PublicProfile, PublicCollectionItem } from '../models/profile.interface';

export function usePublicProfile(pseudo: string | null) {
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [collection, setCollection] = useState<PublicCollectionItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!pseudo) { setProfile(null); setCollection([]); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    void (async () => {
      const [p, c] = await Promise.all([getPublicProfile(pseudo), getPublicCollection(pseudo)]);
      if (cancelled) return;
      setProfile(p);
      setCollection(c);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [pseudo]);

  return { profile, collection, loading };
}
