// src/services/language-storage.ts
// Persistance de la préférence de langue dans AsyncStorage

import AsyncStorage from '@react-native-async-storage/async-storage';
import { SYSTEM_LANGUAGE, isSupportedLanguage, type LanguagePreference } from '../i18n/config';

const KEY = '@sillage/language';

export async function getLanguagePreference(): Promise<LanguagePreference> {
  try {
    const v = await AsyncStorage.getItem(KEY);
    if (v === null || v === SYSTEM_LANGUAGE) return SYSTEM_LANGUAGE;
    return isSupportedLanguage(v) ? v : SYSTEM_LANGUAGE;
  } catch {
    return SYSTEM_LANGUAGE;
  }
}

export async function setLanguagePreference(preference: LanguagePreference): Promise<void> {
  await AsyncStorage.setItem(KEY, preference);
}
