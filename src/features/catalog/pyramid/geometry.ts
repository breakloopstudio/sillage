import i18next from 'i18next';

export type LayerKey = 'top' | 'heart' | 'base';

export const PERSIST: Record<LayerKey, number> = {
  top: 0.34,
  heart: 0.66,
  base: 1,
};

export function alpha(hex: string, a: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}

// Labels résolus à l'appel via i18next (§23.3) — jamais au scope module.
export function layerDuration(key: LayerKey): string {
  switch (key) {
    case 'top': return i18next.t('pyramid.duration.top');
    case 'heart': return i18next.t('pyramid.duration.heart');
    case 'base': return i18next.t('pyramid.duration.base');
  }
}

export function layerContextLabel(key: LayerKey): string {
  switch (key) {
    case 'top': return i18next.t('pyramid.context.top');
    case 'heart': return i18next.t('pyramid.context.heart');
    case 'base': return i18next.t('pyramid.context.base');
  }
}

export function pickInitialLayer(top: number, heart: number, base: number): LayerKey {
  const max = Math.max(top, heart, base);
  if (heart === max) return 'heart';
  if (top === max) return 'top';
  return 'base';
}
