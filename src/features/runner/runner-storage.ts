// src/features/runner/runner-storage.ts — High score + skins AsyncStorage

import AsyncStorage from '@react-native-async-storage/async-storage';
import i18next from 'i18next';

const HIGH_SCORE_KEY = '@sillage/runner-highscore';
const SKINS_KEY = '@sillage/runner-skins';
const SELECTED_SKIN_KEY = '@sillage/runner-selected-skin';
const MUTED_KEY = '@sillage/runner-muted';

export const SKINS = [
  { key: 'default', get label() { return i18next.t('runner.skinViolette'); }, threshold: 0, bottle: '#6C3ED9', cap: '#D4A960' },
  { key: 'amber', get label() { return i18next.t('runner.skinAmbre'); }, threshold: 500, bottle: '#D97706', cap: '#FBBF24' },
  { key: 'frost', get label() { return i18next.t('runner.skinGivre'); }, threshold: 1500, bottle: '#06B6D4', cap: '#67E8F9' },
  { key: 'noir', get label() { return i18next.t('runner.skinNoir'); }, threshold: 3000, bottle: '#2A2238', cap: '#D4A960' },
] as const;

export function getSkinForScore(score: number): typeof SKINS[number] {
  let best: typeof SKINS[number] = SKINS[0];
  for (const s of SKINS) { if (score >= s.threshold) best = s; }
  return best;
}

// Tous les skins dont le seuil est franchi par le score (corrige le bug du run à 3000
// qui ne débloquait que « Noir » en sautant Ambre/Givre).
export function getSkinsForScore(score: number): Array<typeof SKINS[number]> {
  return SKINS.filter(s => score >= s.threshold);
}

export async function getUnlockedSkins(): Promise<string[]> {
  try {
    const v = await AsyncStorage.getItem(SKINS_KEY);
    if (v) { const arr = JSON.parse(v); if (Array.isArray(arr)) return arr; }
  } catch (e) { console.warn('[runner-storage] getUnlockedSkins', e); }
  return ['default'];
}

export async function unlockSkin(key: string): Promise<void> {
  try {
    const skins = await getUnlockedSkins();
    if (!skins.includes(key)) { skins.push(key); await AsyncStorage.setItem(SKINS_KEY, JSON.stringify(skins)); }
  } catch (e) { console.warn('[runner-storage] unlockSkin', e); }
}

// Déblocage atomique de plusieurs skins (1 lecture + 1 écriture) — évite la race du
// read-modify-write parallèle qui pouvait n'en persister qu'un (run à 3000 → Ambre+Givre+Noir).
export async function unlockSkins(keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  try {
    const skins = await getUnlockedSkins();
    const merged = [...new Set([...skins, ...keys])];
    if (merged.length !== skins.length) {
      await AsyncStorage.setItem(SKINS_KEY, JSON.stringify(merged));
    }
  } catch (e) { console.warn('[runner-storage] unlockSkins', e); }
}

export async function getHighScore(): Promise<number> {
  try {
    const v = await AsyncStorage.getItem(HIGH_SCORE_KEY);
    const n = v ? parseInt(v, 10) : 0;
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

export async function setHighScore(score: number): Promise<void> {
  try {
    await AsyncStorage.setItem(HIGH_SCORE_KEY, Math.floor(score).toString());
  } catch (e) { console.warn('[runner-storage] setHighScore', e); }
}

export async function getSelectedSkinKey(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(SELECTED_SKIN_KEY);
  } catch {
    return null;
  }
}

export async function setSelectedSkinKey(key: string): Promise<void> {
  try {
    await AsyncStorage.setItem(SELECTED_SKIN_KEY, key);
  } catch (e) { console.warn('[runner-storage] setSelectedSkinKey', e); }
}

export async function getMuted(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(MUTED_KEY)) === '1';
  } catch {
    return false;
  }
}

export async function setMuted(muted: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(MUTED_KEY, muted ? '1' : '0');
  } catch (e) { console.warn('[runner-storage] setMuted', e); }
}
