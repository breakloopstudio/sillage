// src/hooks/useDensityPreference.ts — Persistance AsyncStorage du mode d'affichage grille

import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { CardMode } from '../components/ParfumCard';

export const GRID_MODES: { key: CardMode; label: string }[] = [
  { key: 'comfortable', label: 'Confort' },
  { key: 'compactPlus', label: 'Compact' },
  { key: 'list', label: 'Liste' },
];

const KEY = '@sillage/catalog-density';
const VALID: readonly CardMode[] = ['comfortable', 'compactPlus', 'list'];

function isValid(v: string | null): v is CardMode {
  return VALID.includes(v as CardMode);
}

export function useDensityPreference() {
  const [density, setDensityState] = useState<CardMode>('comfortable');

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(KEY).then(v => {
      if (!cancelled && isValid(v)) setDensityState(v);
    }).catch((e) => console.warn('[density] persist failed:', e));
    return () => { cancelled = true; };
  }, []);

  const setDensity = useCallback((mode: CardMode) => {
    setDensityState(mode);
    AsyncStorage.setItem(KEY, mode).catch((e) => console.warn('[density] persist failed:', e));
  }, []);

  return { density, setDensity } as const;
}
