// src/hooks/useDensityPreference.ts — Persistance AsyncStorage du mode d'affichage grille

import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import i18next from 'i18next';
import type { CardMode } from '../components/ParfumCard';

// Labels résolus à l'affichage via i18next (§23) — jamais lus au scope module.
export const GRID_MODES: { key: CardMode; label: string }[] = [
  { key: 'comfortable', get label() { return i18next.t('density.comfortable'); } },
  { key: 'compactPlus', get label() { return i18next.t('density.compactPlus'); } },
  { key: 'list', get label() { return i18next.t('density.list'); } },
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
