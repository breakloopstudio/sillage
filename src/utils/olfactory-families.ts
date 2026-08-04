// src/utils/olfactory-families.ts — Taxonomie des familles olfactives
// Regroupe les ~46 valeurs anglaises fragmentées de `famille_olfactive`
// (woody, white floral, warm spicy…) en 6 familles exploitables.
// Chaque valeur n'appartient qu'à une seule famille (pas de doublon).
// Labels/taglines résolus via i18next à l'affichage (§23).

import i18next from 'i18next';
import type { Theme } from '../theme/theme';

export interface OlfactoryFamily {
  key: string;
  label: string;
  tagline: string;
  icon: string;
  accent: keyof Theme['colors'];
  accentSoft: keyof Theme['colors'];
  values: string[];
}

export const OLFACTORY_FAMILIES: OlfactoryFamily[] = [
  {
    key: 'boisee',
    get label() { return i18next.t('families.boisee.label'); },
    get tagline() { return i18next.t('families.boisee.tagline'); },
    icon: 'leaf-outline',
    accent: 'deal',
    accentSoft: 'dealSoft',
    values: ['woody', 'oud', 'leather', 'patchouli', 'smoky', 'earthy', 'mossy', 'tobacco'],
  },
  {
    key: 'florale',
    get label() { return i18next.t('families.florale.label'); },
    get tagline() { return i18next.t('families.florale.tagline'); },
    icon: 'flower-outline',
    accent: 'primary',
    accentSoft: 'primarySoft',
    values: ['floral', 'white floral', 'rose', 'iris', 'tuberose', 'yellow floral', 'violet', 'powdery', 'aldehydic', 'soapy'],
  },
  {
    key: 'hesperidee',
    get label() { return i18next.t('families.hesperidee.label'); },
    get tagline() { return i18next.t('families.hesperidee.tagline'); },
    icon: 'sunny-outline',
    accent: 'fair',
    accentSoft: 'fairSoft',
    values: ['citrus', 'fresh', 'aquatic', 'marine', 'ozonic', 'mineral'],
  },
  {
    key: 'ambree',
    get label() { return i18next.t('families.ambree.label'); },
    get tagline() { return i18next.t('families.ambree.tagline'); },
    icon: 'flame-outline',
    accent: 'secondary',
    accentSoft: 'secondarySoft',
    values: ['amber', 'warm spicy', 'vanilla', 'soft spicy', 'musky', 'animalic'],
  },
  {
    key: 'gourmande',
    get label() { return i18next.t('families.gourmande.label'); },
    get tagline() { return i18next.t('families.gourmande.tagline'); },
    icon: 'cafe-outline',
    accent: 'seasonFall',
    accentSoft: 'seasonFallSoft',
    values: ['fruity', 'sweet', 'caramel', 'lactonic', 'almond', 'tropical', 'cherry', 'coconut', 'coffee', 'honey'],
  },
  {
    key: 'aromatique',
    get label() { return i18next.t('families.aromatique.label'); },
    get tagline() { return i18next.t('families.aromatique.tagline'); },
    icon: 'sparkles-outline',
    accent: 'seasonSpring',
    accentSoft: 'seasonSpringSoft',
    values: ['aromatic', 'fresh spicy', 'lavender', 'green', 'herbal'],
  },
];

export function getFamilyByKey(key: string | null | undefined): OlfactoryFamily | undefined {
  if (!key) return undefined;
  return OLFACTORY_FAMILIES.find(f => f.key === key);
}

export function getFamilyByValue(value: string | null | undefined): OlfactoryFamily | undefined {
  if (!value) return undefined;
  const v = value.toLowerCase().trim();
  return OLFACTORY_FAMILIES.find(f => f.values.includes(v));
}
