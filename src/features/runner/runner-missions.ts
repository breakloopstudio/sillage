// src/features/runner/runner-missions.ts — Succès persistés du mini-jeu

import AsyncStorage from '@react-native-async-storage/async-storage';

export interface MissionContext {
  score: number;
  distance: number;
  maxCombo: number;
  nearMiss: number;
  shieldBreaks: number;
  notesCollected: number;
}

export interface Mission {
  key: string;
  label: string;
  icon: string;
  check: (ctx: MissionContext) => boolean;
}

export const MISSIONS: Mission[] = [
  { key: 'first_steps', label: 'Première casse', icon: 'footsteps-outline', check: c => c.score >= 50 },
  { key: 'confirmed', label: 'Nez confirmé', icon: 'ribbon-outline', check: c => c.score >= 500 },
  { key: 'legend', label: 'Légende', icon: 'trophy-outline', check: c => c.score >= 3000 },
  { key: 'marathon', label: 'Marathon', icon: 'walk-outline', check: c => c.distance >= 1500 },
  { key: 'combo_master', label: 'Enchaînement ×4', icon: 'flash-outline', check: c => c.maxCombo >= 4 },
  { key: 'close_call', label: 'Frôleur', icon: 'speedometer-outline', check: c => c.nearMiss >= 5 },
  { key: 'untouchable', label: 'Intouchable', icon: 'shield-checkmark-outline', check: c => c.shieldBreaks >= 1 },
  { key: 'harvester', label: 'Belle récolte', icon: 'leaf-outline', check: c => c.notesCollected >= 8 },
];

const MISSIONS_KEY = '@parfumscan/runner-missions';

export async function getUnlockedMissions(): Promise<string[]> {
  try {
    const v = await AsyncStorage.getItem(MISSIONS_KEY);
    if (v) { const arr = JSON.parse(v); if (Array.isArray(arr)) return arr; }
  } catch (e) { console.warn('[runner-missions] getUnlockedMissions', e); }
  return [];
}

export async function unlockMissions(keys: string[]): Promise<void> {
  try {
    const current = await getUnlockedMissions();
    const merged = [...new Set([...current, ...keys])];
    await AsyncStorage.setItem(MISSIONS_KEY, JSON.stringify(merged));
  } catch (e) { console.warn('[runner-missions] unlockMissions', e); }
}

export function evaluateMissions(ctx: MissionContext, unlocked: string[]): Mission[] {
  return MISSIONS.filter(m => !unlocked.includes(m.key) && m.check(ctx));
}
