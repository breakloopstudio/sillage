// src/i18n/resources.ts — Ressources bundlées (chaînes UI uniquement).
// Les traductions du catalogue (notes, descriptions) vivent en Supabase Storage
// (Phase 4) pour rester scalables sans gonfler le bundle.

import frCommon from '../locales/fr/common.json';
import enCommon from '../locales/en/common.json';
import esCommon from '../locales/es/common.json';
import deCommon from '../locales/de/common.json';
import itCommon from '../locales/it/common.json';
import ptBRCommon from '../locales/pt-BR/common.json';

export const resources = {
  fr: {
    common: frCommon,
  },
  en: {
    common: enCommon,
  },
  es: {
    common: esCommon,
  },
  de: {
    common: deCommon,
  },
  it: {
    common: itCommon,
  },
  'pt-BR': {
    common: ptBRCommon,
  },
};
