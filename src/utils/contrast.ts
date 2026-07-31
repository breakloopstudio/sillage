// src/utils/contrast.ts — Couleur de texte optimale sur fond coloré (WCAG)
function channel(c: number): number {
  const v = c / 255;
  return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

export function luminance(hex: string): number {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

const DARK_INK = '#1A1520';
const WHITE = '#FFFFFF';

/**
 * Retourne '#1A1520' (encre foncée) ou '#FFFFFF' selon le meilleur contraste
 * sur le fond donné. Fonctionne dans les deux thèmes sans connaître le mode.
 */
export function textOn(bgHex: string): typeof DARK_INK | typeof WHITE {
  const lbg = luminance(bgHex);
  const ld = luminance(DARK_INK);
  const crDark = (lbg + 0.05) / (ld + 0.05);
  const crWhite = (1.0 + 0.05) / (lbg + 0.05);
  return crDark >= crWhite ? DARK_INK : WHITE;
}
