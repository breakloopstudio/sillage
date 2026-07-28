import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ParfumerieView = 'collection' | 'shelves';

const KEY = '@parfumscan/parfumerie-view';

export function useParfumerieViewPreference() {
  const [view, setViewState] = useState<ParfumerieView | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(KEY).then((v) => {
      if (v === 'collection' || v === 'shelves') setViewState(v);
    }).catch((e) => console.warn('[parfumerie-view] read failed:', e));
  }, []);

  const setView = useCallback((v: ParfumerieView) => {
    setViewState(v);
    AsyncStorage.setItem(KEY, v).catch((e) => console.warn('[parfumerie-view] write failed:', e));
  }, []);

  return { view, setView } as const;
}
