// src/i18n/options.ts — Fabrique d'InitOptions i18next.
// Module SANS dépendance native (ni AsyncStorage ni expo-localization) :
// jest-setup.js l'importe directement pour initialiser i18next en français sans
// instancier le mock AsyncStorage global avant les jest.mock locaux des suites
// (home-cache, SWR…). Ne pas déplacer cette logique dans index.ts.

import type { InitOptions } from 'i18next';
import { resources } from './resources';
import { DEFAULT_NS, SOURCE_LANGUAGE, SUPPORTED_LANGUAGES } from './config';

export function buildInitOptions(lng: string): InitOptions {
  return {
    resources,
    defaultNS: DEFAULT_NS,
    lng,
    // La langue source ne fallback jamais ; les autres langues retombent sur la
    // source pour les clés non traduites (deviendra ['en', 'fr'] quand EN sera complet).
    fallbackLng: { [SOURCE_LANGUAGE]: [], default: [SOURCE_LANGUAGE] },
    supportedLngs: [...SUPPORTED_LANGUAGES],
    nonExplicitSupportedLngs: true,
    interpolation: { escapeValue: false },
    returnNull: false,
  };
}
