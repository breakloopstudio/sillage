// src/features/runner/runner-daily.ts — Défi quotidien « Le geste du jour ».
// Un objectif déterministe par jour (seed = date), identique pour tous les joueurs :
// équité (indépendant de la chance de spawn) + rituel quotidien, en synergie avec le
// SOTD de l'app. Le seed est un LCG (sans Math.random) — worklet-safe et reproductible.
// 100 % local (AsyncStorage), robuste au cold-start.

import AsyncStorage from '@react-native-async-storage/async-storage';
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
  (rand) => { const t = 500 + Math.floor(rand() * 4) * 250; return { id: 'score', label: `Atteins ${t} points`, icon: 'trophy-outline', check: c => c.score >= t }; },
  (rand) => { const t = 4 + Math.floor(rand() * 3) * 2; return { id: 'notes', label: `Collecte ${t} notes`, icon: 'leaf-outline', check: c => c.notesCollected >= t }; },
  (rand) => { const t = 2 + Math.floor(rand() * 3); return { id: 'combo', label: `Enchaîne un combo ×${t}`, icon: 'flash-outline', check: c => c.maxCombo >= t }; },
  (rand) => { const t = 3 + Math.floor(rand() * 3) * 2; return { id: 'nearmiss', label: `Frôle ${t} cristaux`, icon: 'speedometer-outline', check: c => c.nearMiss >= t }; },
  (rand) => { const t = 800 + Math.floor(rand() * 4) * 400; return { id: 'distance', label: `Cours ${t} mètres`, icon: 'walk-outline', check: c => c.distance >= t }; },
  (rand) => { const t = 1 + Math.floor(rand() * 2); return { id: 'shield', label: `Casse ${t} bouclier${t > 1 ? 's' : ''}`, icon: 'shield-checkmark-outline', check: c => c.shieldBreaks >= t }; },
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
