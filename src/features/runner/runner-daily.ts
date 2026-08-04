// src/features/runner/runner-daily.ts — Défi quotidien « Le geste du jour ».
// Un objectif déterministe par jour (seed = date), identique pour tous les joueurs :
// équité (indépendant de la chance de spawn) + rituel quotidien, en synergie avec le
// SOTD de l'app. Le seed est un LCG (sans Math.random) — worklet-safe et reproductible.
// 100 % local (AsyncStorage), robuste au cold-start.

import AsyncStorage from '@react-native-async-storage/async-storage';
import i18next from 'i18next';
import { todayKey } from './runner-stats';

const DAILY_KEY = '@sillage/runner-daily';

export interface DailyContext {
  score: number;
  distance: number;
  maxCombo: number;
  nearMiss: number;
  shieldBreaks: number;
  notesCollected: number;
}

export interface DailyChallenge {
  id: string;
  label: string;
  icon: string;
  check: (ctx: DailyContext) => boolean;
}

function seedFromDate(date: Date): number {
  const n = date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();
  // Finalizer murmur3 : avalanche — des dates proches donnent des seeds très différents,
  // sinon un LCG multiplicatif sur seeds consécutifs produirait le même défi des mois durant.
  let x = n | 0;
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
  x = x ^ (x >>> 16);
  return ((x >>> 0) % 2147483647) || 1;
}

function lcg(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 48271) % 2147483647;
    return state / 2147483647;
  };
}

const DEFS: Array<(rand: () => number) => DailyChallenge> = [
  (rand) => { const th = 500 + Math.floor(rand() * 4) * 250; return { id: 'score', label: i18next.t('runner.dailyScore', { count: th }), icon: 'trophy-outline', check: c => c.score >= th }; },
  (rand) => { const th = 4 + Math.floor(rand() * 3) * 2; return { id: 'notes', label: i18next.t('runner.dailyNotes', { count: th }), icon: 'leaf-outline', check: c => c.notesCollected >= th }; },
  (rand) => { const th = 2 + Math.floor(rand() * 3); return { id: 'combo', label: i18next.t('runner.dailyCombo', { count: th }), icon: 'flash-outline', check: c => c.maxCombo >= th }; },
  (rand) => { const th = 3 + Math.floor(rand() * 3) * 2; return { id: 'nearmiss', label: i18next.t('runner.dailyNearmiss', { count: th }), icon: 'speedometer-outline', check: c => c.nearMiss >= th }; },
  (rand) => { const th = 800 + Math.floor(rand() * 4) * 400; return { id: 'distance', label: i18next.t('runner.dailyDistance', { count: th }), icon: 'walk-outline', check: c => c.distance >= th }; },
  (rand) => { const th = 1 + Math.floor(rand() * 2); return { id: 'shield', label: i18next.t('runner.dailyShield', { count: th }), icon: 'shield-checkmark-outline', check: c => c.shieldBreaks >= th }; },
];

export function getDailyChallenge(date: Date = new Date()): DailyChallenge {
  const rand = lcg(seedFromDate(date));
  const idx = Math.floor(rand() * DEFS.length);
  return DEFS[idx](rand);
}

export async function isDailyDone(date: Date = new Date()): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(DAILY_KEY)) === todayKey(date);
  } catch {
    return false;
  }
}

export async function markDailyDone(date: Date = new Date()): Promise<void> {
  try {
    await AsyncStorage.setItem(DAILY_KEY, todayKey(date));
  } catch (e) { console.warn('[runner-daily] markDailyDone', e); }
}
