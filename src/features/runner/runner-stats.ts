// src/features/runner/runner-stats.ts — Carnet de runs : stats lifetime locales.
// Donne de la valeur à chaque course (pas seulement le meilleur run) et fonde les
// missions à paliers, le défi quotidien et les objectifs personnels. 100 % local
// (AsyncStorage) — robuste au cold-start, zéro latence, zéro setState en boucle.

import AsyncStorage from '@react-native-async-storage/async-storage';

const STATS_KEY = '@sillage/runner-stats';

export interface RunnerStats {
  totalRuns: number;
  totalDistance: number;
  bestScore: number;
  bestCombo: number;
  bestNearMiss: number;
  totalNearMiss: number;
  totalShieldBreaks: number;
  notesByType: Record<string, number>;
  playDays: number;
  lastPlayDay: string;
}

export interface RunSummary {
  score: number;
  distance: number;
  maxCombo: number;
  nearMiss: number;
  shieldBreaks: number;
  notesByType: Record<string, number>;
}

const EMPTY: RunnerStats = {
  totalRuns: 0,
  totalDistance: 0,
  bestScore: 0,
  bestCombo: 0,
  bestNearMiss: 0,
  totalNearMiss: 0,
  totalShieldBreaks: 0,
  notesByType: {},
  playDays: 0,
  lastPlayDay: '',
};

export function todayKey(date: Date = new Date()): string {
  const m = `${date.getMonth() + 1}`.padStart(2, '0');
  const d = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${m}-${d}`;
}

export async function getRunnerStats(): Promise<RunnerStats> {
  try {
    const v = await AsyncStorage.getItem(STATS_KEY);
    if (v) {
      const parsed = JSON.parse(v) as Partial<RunnerStats>;
      return { ...EMPTY, ...parsed, notesByType: { ...(parsed.notesByType ?? {}) } };
    }
  } catch (e) { console.warn('[runner-stats] getRunnerStats', e); }
  return { ...EMPTY, notesByType: {} };
}

export async function recordRun(run: RunSummary): Promise<RunnerStats> {
  const stats = await getRunnerStats();
  const today = todayKey();
  stats.totalRuns += 1;
  stats.totalDistance += run.distance;
  stats.bestScore = Math.max(stats.bestScore, run.score);
  stats.bestCombo = Math.max(stats.bestCombo, run.maxCombo);
  stats.bestNearMiss = Math.max(stats.bestNearMiss, run.nearMiss);
  stats.totalNearMiss += run.nearMiss;
  stats.totalShieldBreaks += run.shieldBreaks;
  for (const key of Object.keys(run.notesByType)) {
    stats.notesByType[key] = (stats.notesByType[key] ?? 0) + run.notesByType[key];
  }
  if (stats.lastPlayDay !== today) {
    stats.playDays += 1;
    stats.lastPlayDay = today;
  }
  try {
    await AsyncStorage.setItem(STATS_KEY, JSON.stringify(stats));
  } catch (e) { console.warn('[runner-stats] recordRun', e); }
  return stats;
}

export function totalNotes(stats: RunnerStats): number {
  return Object.values(stats.notesByType).reduce((sum, n) => sum + n, 0);
}
