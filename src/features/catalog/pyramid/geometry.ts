export type LayerKey = 'top' | 'heart' | 'base';
export interface Pt { x: number; y: number }

export function shade(hex: string, ratio: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const fn = (c: number) => {
    const v = ratio < 0
      ? Math.round(c * (1 + ratio))
      : Math.round(c + (255 - c) * ratio);
    return Math.max(0, Math.min(255, v));
  };
  const toHex = (c: number) => fn(c).toString(16).padStart(2, '0').toUpperCase();
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function alpha(hex: string, a: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}

export function centroid(points: Pt[]): Pt {
  const n = points.length;
  if (n === 0) return { x: 0, y: 0 };
  return {
    x: points.reduce((s, p) => s + p.x, 0) / n,
    y: points.reduce((s, p) => s + p.y, 0) / n,
  };
}

export function bandPoly(w: number, h: number, k: 0 | 1 | 2, gap: number): { points: Pt[]; centroid: Pt; svg: string } {
  const cx = w / 2;
  const bh = h / 3;
  const y0 = k * bh;
  const y1 = (k + 1) * bh;
  const hw = (y: number) => (w / 2) * (y / h);

  const raw: Pt[] = [
    { x: cx - hw(y0), y: y0 },
    { x: cx + hw(y0), y: y0 },
    { x: cx + hw(y1), y: y1 },
    { x: cx - hw(y1), y: y1 },
  ];

  const c = centroid(raw);

  const inset = (p: Pt): Pt => {
    const dx = c.x - p.x;
    const dy = c.y - p.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist === 0) return p;
    const t = Math.min(0.5, gap / dist);
    return { x: p.x + dx * t, y: p.y + dy * t };
  };

  const points = raw.map(inset);

  return {
    points,
    centroid: c,
    svg: points.map(p => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' '),
  };
}

export function layerDuration(key: LayerKey): string {
  switch (key) {
    case 'top': return '0 \u2013 15 min';
    case 'heart': return '15 min \u2013 2 h';
    case 'base': return '2 h et +';
  }
}

export function layerAphorism(key: LayerKey | null): string {
  switch (key) {
    case 'top': return "L'\u00e9clat des premi\u00e8res minutes";
    case 'heart': return 'Le c\u0153ur qui porte';
    case 'base': return "L'empreinte qui persiste";
    default: return 'Le parfum, heure par heure';
  }
}

export function layerContextLabel(key: LayerKey): string {
  switch (key) {
    case 'top': return 'Note de t\u00eate';
    case 'heart': return 'Note de c\u0153ur';
    case 'base': return 'Note de fond';
  }
}

export function pickInitialLayer(top: number, heart: number, base: number): LayerKey {
  const max = Math.max(top, heart, base);
  if (heart === max) return 'heart';
  if (top === max) return 'top';
  return 'base';
}
