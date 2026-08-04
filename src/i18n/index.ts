// src/i18n/index.ts — Initialisation i18next.
// Détection : préférence utilisateur (AsyncStorage) → locale appareil → fallback.
// Gate de rendu : app/_layout.tsx attend initI18n() avant le premier rendu.
// NB : les InitOptions vivent dans options.ts (module pur, importable par jest-setup).

import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
// i18next ≥ 24 exige Intl.PluralRules pour les pluriels ; polyfill si Hermes
// ne l'expose pas pour une locale donnée (no-op sinon).
import 'intl-pluralrules';
import * as Localization from 'expo-localization';
import { getLanguagePreference, setLanguagePreference } from '../services/language-storage';
import { buildInitOptions } from './options';
import {
  SOURCE_LANGUAGE,
  SYSTEM_LANGUAGE,
  UNSUPPORTED_FALLBACK_LANGUAGE,
  isSupportedLanguage,
  type AppLanguage,
  type LanguagePreference,
} from './config';

/**
 * Résout la langue d'affichage : préférence explicite → locales appareil → fallback.
 * Match par languageCode (ISO 639-1) ; quand des variantes régionales seront
 * supportées (ex. 'pt-BR' vs 'pt-PT'), affiner avec languageTag/regionCode.
 */
export function resolveInitialLanguage(preference: LanguagePreference): AppLanguage {
  if (preference !== SYSTEM_LANGUAGE && isSupportedLanguage(preference)) return preference;
  try {
    for (const locale of Localization.getLocales()) {
      const code = locale.languageCode?.toLowerCase();
      if (isSupportedLanguage(code)) return code;
    }
  } catch { /* locale indisponible : fallback */ }
  return UNSUPPORTED_FALLBACK_LANGUAGE;
}

let initPromise: Promise<void> | null = null;

/** Initialisation async (app) : lit la préférence persistée puis la locale appareil. */
export function initI18n(): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      if (i18next.isInitialized) return;
      const preference = await getLanguagePreference();
      const lng = resolveInitialLanguage(preference);
      await i18next.use(initReactI18next).init(buildInitOptions(lng));
    })();
  }
  return initPromise;
}

/** Langue active (résolue, jamais 'system'). */
export function getActiveLanguage(): AppLanguage {
  const lng = i18next.language;
  return isSupportedLanguage(lng) ? lng : SOURCE_LANGUAGE;
}

/**
 * Change la langue (réglage Settings) : appliquée d'abord, persistée ensuite.
 * Ne reject jamais — un échec de persistance laisse la langue appliquée pour
 * la session (l'état affiché reste cohérent avec le rendu).
 */
export async function setAppLanguage(preference: LanguagePreference): Promise<void> {
  const lng = resolveInitialLanguage(preference);
  if (i18next.language !== lng) await i18next.changeLanguage(lng);
  try {
    await setLanguagePreference(preference);
  } catch { /* préférence non persistée : la langue reste appliquée pour la session */ }
}

export default i18next;
