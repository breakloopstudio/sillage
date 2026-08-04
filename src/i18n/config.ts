// src/i18n/config.ts — Constantes i18n (langues supportées, fallback, namespace)

export const DEFAULT_NS = 'common';

/** Valeur « langue système » de la préférence utilisateur (AsyncStorage). */
export const SYSTEM_LANGUAGE = 'system';

/**
 * Langues traduites de l'app. S'enrichit aux phases i18n :
 * Phase 2 → 'en', Phase 3 → 'es' | 'de' | 'it' | 'pt-BR'.
 */
export const SUPPORTED_LANGUAGES = ['fr'] as const;
export type AppLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export type LanguagePreference = typeof SYSTEM_LANGUAGE | AppLanguage;

/** Choix offerts dans Settings : Système + une entrée par langue disponible. */
export const AVAILABLE_LANGUAGES: ReadonlyArray<{ code: AppLanguage; nativeLabel: string }> = [
  { code: 'fr', nativeLabel: 'Français' },
];

/** Langue source : celle dans laquelle le code est écrit (`fr.json` fait foi). */
export const SOURCE_LANGUAGE: AppLanguage = 'fr';

/**
 * Langue affichée quand la locale appareil n'est supportée par aucune traduction.
 * 'fr' tant que l'anglais n'est pas traduit (Phase 2) — deviendra 'en'.
 */
export const UNSUPPORTED_FALLBACK_LANGUAGE: AppLanguage = 'fr';

export function isSupportedLanguage(v: string | null | undefined): v is AppLanguage {
  return !!v && (SUPPORTED_LANGUAGES as readonly string[]).includes(v);
}

export function nativeLabelFor(code: AppLanguage): string {
  return AVAILABLE_LANGUAGES.find(l => l.code === code)?.nativeLabel ?? code;
}
