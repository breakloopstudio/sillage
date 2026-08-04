// src/types/i18next.d.ts — Typage fort des clés i18next (resource → t() typé).
// Toute clé inexistante dans src/locales/fr/*.json est une erreur TypeScript.

import 'i18next';
import type { resources } from '../i18n/resources';

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common';
    // CustomTypeOptions.resources est indexé par NAMESPACE (pas par langue).
    resources: (typeof resources)['fr'];
    returnNull: false;
  }
}
