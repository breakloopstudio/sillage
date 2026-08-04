// src/features/runner/runner-missions.ts — Succès à paliers (bronze/argent/or) du mini-jeu.
// Chaque mission a 3 paliers ; un palier débloqué reste acquis. Le système persiste le
// plus haut palier atteint par mission. `nextObjective` calcule le prochain palier le
// plus proche pour l'effet « presque » (rejeu) affiché au game over.

import AsyncStorage from '@react-native-async-storage/async-storage';
import i18next from 'i18next';

export interface MissionContext {
  score: number;
  distance: number;
  maxCombo: number;
  nearMiss: number;
  shieldBreaks: number;
  notesCollected: number;
  totalRuns: number;
  totalDistance: number;
  totalNotes: number;
}

export interface Mission {
  key: string;
  label: string;
  icon: string;
  unit: string;
  value: (ctx: MissionContext) => number;
  tiers: number[];
}

export interface FreshTier {
  mission: Mission;
  tier: number;
}

export interface NextObjective {
  label: string;
  icon: string;
  current: number;
  target: number;
  unit: string;
}

export const MISSIONS: Mission[] = [
  { key: 'score', get label() { return i18next.t('runner.missionScore'); }, icon: 'trophy-outline', unit: 'pts', value: c => c.score, tiers: [50, 500, 3000] },
  { key: 'distance', get label() { return i18next.t('runner.missionDistance'); }, icon: 'walk-outline', unit: 'm', value: c => c.distance, tiers: [500, 1500, 5000] },
  { key: 'combo', get label() { return i18next.t('runner.missionCombo'); }, icon: 'flash-outline', unit: '×', value: c => c.maxCombo, tiers: [2, 3, 4] },
  { key: 'nearmiss', get label() { return i18next.t('runner.missionNearmiss'); }, icon: 'speedometer-outline', get unit() { return i18next.t('runner.unitNearmiss'); }, value: c => c.nearMiss, tiers: [3, 5, 10] },
  { key: 'shield', get label() { return i18next.t('runner.missionShield'); }, icon: 'shield-checkmark-outline', get unit() { return i18next.t('runner.unitShield'); }, value: c => c.shieldBreaks, tiers: [1, 3, 6] },
  { key: 'harvest', get label() { return i18next.t('runner.missionHarvest'); }, icon: 'leaf-outline', get unit() { return i18next.t('runner.unitNotes'); }, value: c => c.notesCollected, tiers: [4, 8, 15] },
  { key: 'runs', get label() { return i18next.t('runner.missionRuns'); }, icon: 'footsteps-outline', get unit() { return i18next.t('runner.unitRuns'); }, value: c => c.totalRuns, tiers: [5, 20, 50] },
  { key: 'explorer', get label() { return i18next.t('runner.missionExplorer'); }, icon: 'compass-outline', unit: 'm', value: c => c.totalDistance, tiers: [5000, 20000, 50000] },
  { key: 'collector', get label() { return i18next.t('runner.missionCollector'); }, icon: 'flask-outline', get unit() { return i18next.t('runner.unitNotes'); }, value: c => c.totalNotes, tiers: [20, 100, 300] },
];

const MISSIONS_KEY = '@sillage/runner-missions';

export async function getMissionTiers(): Promise<Record<string, number>> {
  try {
    const v = await AsyncStorage.getItem(MISSIONS_KEY);
    if (v) {
      const parsed = JSON.parse(v);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, number>;
      }
    }
  } catch (e) { console.warn('[runner-missions] getMissionTiers', e); }
  return {};
}

export async function saveMissionTiers(tiers: Record<string, number>): Promise<void> {
  try {
    await AsyncStorage.setItem(MISSIONS_KEY, JSON.stringify(tiers));
  } catch (e) { console.warn('[runner-missions] saveMissionTiers', e); }
}

function reachedTier(mission: Mission, ctx: MissionContext): number {
  const val = mission.value(ctx);
  let reached = 0;
  for (let i = 0; i < mission.tiers.length; i++) {
    if (val >= mission.tiers[i]) reached = i + 1;
  }
  return reached;
}

export function evaluateMissionTiers(ctx: MissionContext, current: Record<string, number>): FreshTier[] {
  const fresh: FreshTier[] = [];
  for (const mission of MISSIONS) {
    const reached = reachedTier(mission, ctx);
    const prev = current[mission.key] ?? 0;
    if (reached > prev) fresh.push({ mission, tier: reached });
  }
  return fresh;
}

// Prochain palier le plus proche (progression relative la plus haute) — effet « presque ».
export function nextObjective(ctx: MissionContext, current: Record<string, number>): NextObjective | null {
  let best: NextObjective | null = null;
  let bestRatio = -1;
  for (const mission of MISSIONS) {
    const prev = current[mission.key] ?? 0;
    if (prev >= mission.tiers.length) continue;
    const target = mission.tiers[prev];
    const val = mission.value(ctx);
    if (val >= target) continue;
    const ratio = val / target;
    if (ratio > bestRatio) {
      bestRatio = ratio;
      best = { label: mission.label, icon: mission.icon, current: Math.floor(val), target, unit: mission.unit };
    }
  }
  return best;
}
