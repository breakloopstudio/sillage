// src/i18n/resources.ts — Ressources bundlées (chaînes UI uniquement).
// Les traductions du catalogue (notes, descriptions) vivent en Supabase Storage
// (Phase 4) pour rester scalables sans gonfler le bundle.

import frCommon from '../locales/fr/common.json';

export const resources = {
  fr: {
    common: frCommon,
  },
};
