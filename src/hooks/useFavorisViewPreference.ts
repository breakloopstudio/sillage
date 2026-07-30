import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type FavorisView = 'favoris' | 'alerts';

const KEY = '@parfumscan/favoris-view';

export function useFavorisViewPreference() {
  const [view, setViewState] = useState<FavorisView | null>(null);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(KEY).then((v) => {
      if (!cancelled && (v === 'favoris' || v === 'alerts')) setViewState(v);
    }).catch((e) => console.warn('[favoris-view] read failed:', e));
    return () => { cancelled = true; };
  }, []);

  const setView = useCallback((v: FavorisView) => {
    setViewState(v);
    AsyncStorage.setItem(KEY, v).catch((e) => console.warn('[favoris-view] write failed:', e));
  }, []);

  return { view, setView } as const;
}
