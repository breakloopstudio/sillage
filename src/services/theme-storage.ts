// src/services/theme-storage.ts
// Persistance de la préférence de thème dans AsyncStorage

import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@sillage/theme';

export type ThemeMode = 'system' | 'light' | 'dark';

const VALID_MODES: readonly ThemeMode[] = ['system', 'light', 'dark'];

function isValidMode(v: string | null): v is ThemeMode {
  return VALID_MODES.includes(v as ThemeMode);
}

export async function getThemeMode(): Promise<ThemeMode> {
  try {
    const v = await AsyncStorage.getItem(KEY);
    return isValidMode(v) ? v : 'system';
  } catch {
    return 'system';
  }
}

export async function setThemeMode(mode: ThemeMode): Promise<void> {
  await AsyncStorage.setItem(KEY, mode);
}
