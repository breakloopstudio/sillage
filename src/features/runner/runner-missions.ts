// src/features/runner/runner-missions.ts — Succès à paliers (bronze/argent/or) du mini-jeu.
// Chaque mission a 3 paliers ; un palier débloqué reste acquis. Le système persiste le
// plus haut palier atteint par mission. `nextObjective` calcule le prochain palier le
// plus proche pour l'effet « presque » (rejeu) affiché au game over.

import AsyncStorage from '@react-native-async-storage/async-storage';

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
  { key: 'score', label: 'Casse', icon: 'trophy-outline', unit: 'pts', value: c => c.score, tiers: [50, 500, 3000] },
  { key: 'distance', label: 'Marathon', icon: 'walk-outline', unit: 'm', value: c => c.distance, tiers: [500, 1500, 5000] },
  { key: 'combo', label: 'Enchaînement', icon: 'flash-outline', unit: '×', value: c => c.maxCombo, tiers: [2, 3, 4] },
  { key: 'nearmiss', label: 'Frôleur', icon: 'speedometer-outline', unit: 'frôlés', value: c => c.nearMiss, tiers: [3, 5, 10] },
  { key: 'shield', label: 'Intouchable', icon: 'shield-checkmark-outline', unit: 'boucliers', value: c => c.shieldBreaks, tiers: [1, 3, 6] },
  { key: 'harvest', label: 'Récolte', icon: 'leaf-outline', unit: 'notes', value: c => c.notesCollected, tiers: [4, 8, 15] },
  { key: 'runs', label: 'Habitué', icon: 'footsteps-outline', unit: 'runs', value: c => c.totalRuns, tiers: [5, 20, 50] },
  { key: 'explorer', label: 'Explorateur', icon: 'compass-outline', unit: 'm', value: c => c.totalDistance, tiers: [5000, 20000, 50000] },
  { key: 'collector', label: 'Collectionneur', icon: 'flask-outline', unit: 'notes', value: c => c.totalNotes, tiers: [20, 100, 300] },
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
