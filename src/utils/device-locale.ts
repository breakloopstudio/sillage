// src/utils/device-locale.ts — Locale appareil pour la voix (STT on-device +
// transcription serveur). L'app vise le multilingue : rien n'est forcé en FR.
import * as Localization from 'expo-localization';

let cachedLangs: string[] | null = null;
let cachedTag: string | null = null;

/** Tag BCP-47 de la langue préférée de l'appareil (STT on-device : 'fr-FR',
 *  'es-ES', 'en-US'…). getLocales() est garanti non vide ; fallback défensif. */
export function deviceSttLang(): string {
  if (!cachedTag) {
    try {
      cachedTag = Localization.getLocales()[0]?.languageTag || 'en-US';
    } catch {
      cachedTag = 'en-US';
    }
  }
  return cachedTag;
}

/** Codes langue de l'appareil (ISO 639-1 en pratique, nullable côté API) —
 *  max 3, dédupliqués, envoyés à la transcription serveur comme indices
 *  (gpt-transcribe accepte plusieurs hints pour le code-switching). */
export function deviceVoiceLanguages(): string[] {
  if (!cachedLangs) {
    const codes: string[] = [];
    try {
      for (const l of Localization.getLocales()) {
        const c = (l.languageCode ?? '').toLowerCase();
        if (c && !codes.includes(c)) codes.push(c);
        if (codes.length >= 3) break;
      }
    } catch {
      // API indisponible → pas d'indice, le serveur auto-détectera.
    }
    cachedLangs = codes;
  }
  return [...cachedLangs];
}
