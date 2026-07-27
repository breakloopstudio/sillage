// src/utils/olfactory-families.ts — Taxonomie des familles olfactives
// Regroupe les ~46 valeurs anglaises fragmentées de `famille_olfactive`
// (woody, white floral, warm spicy…) en 6 familles françaises exploitables.
// Chaque valeur n'appartient qu'à une seule famille (pas de doublon).

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
    label: 'Boisée',
    tagline: 'La forêt sur la peau',
    icon: 'leaf-outline',
    accent: 'deal',
    accentSoft: 'dealSoft',
    values: ['woody', 'oud', 'leather', 'patchouli', 'smoky', 'earthy', 'mossy', 'tobacco'],
  },
  {
    key: 'florale',
    label: 'Florale',
    tagline: 'Un bouquet au cou',
    icon: 'flower-outline',
    accent: 'primary',
    accentSoft: 'primarySoft',
    values: ['floral', 'white floral', 'rose', 'iris', 'tuberose', 'yellow floral', 'violet', 'powdery', 'aldehydic', 'soapy'],
  },
  {
    key: 'hesperidee',
    label: 'Hespéridée',
    tagline: "L'éclat du matin",
    icon: 'sunny-outline',
    accent: 'fair',
    accentSoft: 'fairSoft',
    values: ['citrus', 'fresh', 'aquatic', 'marine', 'ozonic', 'mineral'],
  },
  {
    key: 'ambree',
    label: 'Ambrée',
    tagline: 'La chaleur du soir',
    icon: 'flame-outline',
    accent: 'secondary',
    accentSoft: 'secondarySoft',
    values: ['amber', 'warm spicy', 'vanilla', 'soft spicy', 'musky', 'animalic'],
  },
  {
    key: 'gourmande',
    label: 'Gourmande',
    tagline: 'Vanille et caramel',
    icon: 'cafe-outline',
    accent: 'seasonFall',
    accentSoft: 'seasonFallSoft',
    values: ['fruity', 'sweet', 'caramel', 'lactonic', 'almond', 'tropical', 'cherry', 'coconut', 'coffee', 'honey'],
  },
  {
    key: 'aromatique',
    label: 'Aromatique',
    tagline: 'Herbes et lavande',
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
