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

export function layerDuration(key: LayerKey): string {
  switch (key) {
    case 'top': return '0 – 15 min';
    case 'heart': return '15 min – 2 h';
    case 'base': return '2 h et +';
  }
}

export function layerContextLabel(key: LayerKey): string {
  switch (key) {
    case 'top': return 'Note de tête';
    case 'heart': return 'Note de cœur';
    case 'base': return 'Note de fond';
  }
}

export function pickInitialLayer(top: number, heart: number, base: number): LayerKey {
  const max = Math.max(top, heart, base);
  if (heart === max) return 'heart';
  if (top === max) return 'top';
  return 'base';
}
