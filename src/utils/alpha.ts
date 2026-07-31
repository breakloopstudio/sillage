export type AlphaTier = 'ghost' | 'hint' | 'veil' | 'dim';

const RATIO: Record<AlphaTier, number> = { ghost: 0.08, hint: 0.16, veil: 0.24, dim: 0.40 };

function rgba(hex: string, a: number): string {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return 'rgba(0,0,0,0)';
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const clamped = Math.min(1, Math.max(0, a));
  return `rgba(${r},${g},${b},${clamped})`;
}

export function alpha(hex: string, ratio: number): string {
  return rgba(hex, ratio);
}

export function tintLuminous(hex: string, tier: AlphaTier, mode: 'light' | 'dark'): string {
  return rgba(hex, mode === 'dark' ? RATIO[tier] / 2 : RATIO[tier]);
}

export function tintStructural(hex: string, tier: AlphaTier): string {
  return rgba(hex, RATIO[tier]);
}
