import {
  shade,
  alpha,
  centroid,
  bandPoly,
  layerDuration,
  layerAphorism,
  layerContextLabel,
  pickInitialLayer,
} from '../src/features/catalog/pyramid/geometry';

describe('shade', () => {
  it('darkens a hex color', () => {
    const result = shade('#6C3ED9', -0.12);
    expect(result).toMatch(/^#[0-9A-F]{6}$/);
    const r = parseInt(result.slice(1, 3), 16);
    expect(r).toBeLessThan(0x6C);
  });

  it('lightens a hex color', () => {
    const result = shade('#0D9488', 0.08);
    expect(result).toMatch(/^#[0-9A-F]{6}$/);
    const r = parseInt(result.slice(1, 3), 16);
    expect(r).toBeGreaterThan(0x0D);
  });

  it('clamps to 0', () => {
    expect(shade('#000000', -0.5)).toBe('#000000');
  });

  it('clamps to 255', () => {
    expect(shade('#FFFFFF', 0.5)).toBe('#FFFFFF');
  });

  it('returns uppercase hex', () => {
    const result = shade('#aabbcc', -0.1);
    expect(result).toBe(result.toUpperCase());
  });
});

describe('alpha', () => {
  it('returns rgba string with given alpha', () => {
    expect(alpha('#C8945A', 0.35)).toBe('rgba(200,148,90,0.35)');
  });

  it('handles alpha 1', () => {
    expect(alpha('#000000', 1)).toBe('rgba(0,0,0,1)');
  });

  it('handles alpha 0', () => {
    expect(alpha('#FFFFFF', 0)).toBe('rgba(255,255,255,0)');
  });
});

describe('centroid', () => {
  it('computes centroid of a square', () => {
    const pts = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }];
    expect(centroid(pts)).toEqual({ x: 5, y: 5 });
  });

  it('handles empty array', () => {
    expect(centroid([])).toEqual({ x: 0, y: 0 });
  });
});

describe('bandPoly', () => {
  const w = 240;
  const h = 220;

  it('returns 4 points for k=0 (top triangle)', () => {
    const { points, svg } = bandPoly(w, h, 0, 3);
    expect(points).toHaveLength(4);
    expect(points[0].x).toBeCloseTo(points[1].x, 0);
    expect(points[0].y).toBeCloseTo(points[1].y, 0);
    expect(svg).toMatch(/^[\d.,\-\s]+$/);
  });

  it('returns 4 points for k=1 (heart band)', () => {
    const { points } = bandPoly(w, h, 1, 3);
    expect(points).toHaveLength(4);
    expect(points[0].y).toBeCloseTo(points[1].y, 0);
    expect(points[2].y).toBeCloseTo(points[3].y, 0);
  });

  it('inset moves vertices toward centroid for k=1', () => {
    const { points, centroid: c } = bandPoly(w, h, 1, 3);
    const w0pts = bandPoly(w, h, 1, 0).points;
    for (let i = 0; i < 4; i++) {
      const dInset = Math.hypot(points[i].x - c.x, points[i].y - c.y);
      const dRaw = Math.hypot(w0pts[i].x - c.x, w0pts[i].y - c.y);
      expect(dInset).toBeLessThanOrEqual(dRaw);
    }
  });

  it('returns correct points for k=2 (base band, inset from bottom)', () => {
    const { points } = bandPoly(w, h, 2, 3);
    expect(points).toHaveLength(4);
    const bh = h / 3;
    expect(points[2].y).toBeLessThan(h);
    expect(points[2].y).toBeGreaterThan(h - bh);
    expect(points[3].y).toBeGreaterThan(h - bh);
  });
});

describe('layerDuration', () => {
  it('returns correct durations with en-dashes', () => {
    expect(layerDuration('top')).toBe('0 – 15 min');
    expect(layerDuration('heart')).toBe('15 min – 2 h');
    expect(layerDuration('base')).toBe('2 h et +');
  });

  it('uses en-dash (U+2013)', () => {
    expect(layerDuration('top')).toContain('\u2013');
    expect(layerDuration('heart')).toContain('\u2013');
  });
});

describe('layerAphorism', () => {
  it('returns aphorisms for each key', () => {
    expect(layerAphorism('top')).toBe("L'éclat des premières minutes");
    expect(layerAphorism('heart')).toBe('Le cœur qui porte');
    expect(layerAphorism('base')).toBe("L'empreinte qui persiste");
  });

  it('returns default for null', () => {
    expect(layerAphorism(null)).toBe('Le parfum, heure par heure');
  });
});

describe('layerContextLabel', () => {
  it('returns context labels', () => {
    expect(layerContextLabel('top')).toBe('Note de tête');
    expect(layerContextLabel('heart')).toBe('Note de cœur');
    expect(layerContextLabel('base')).toBe('Note de fond');
  });
});

describe('pickInitialLayer', () => {
  it('picks the layer with most notes', () => {
    expect(pickInitialLayer(2, 5, 3)).toBe('heart');
    expect(pickInitialLayer(6, 5, 3)).toBe('top');
    expect(pickInitialLayer(2, 3, 7)).toBe('base');
  });

  it('breaks ties in favor of heart', () => {
    expect(pickInitialLayer(2, 2, 2)).toBe('heart');
    expect(pickInitialLayer(5, 5, 3)).toBe('heart');
  });

  it('returns heart when all zero', () => {
    expect(pickInitialLayer(0, 0, 0)).toBe('heart');
  });

  it('returns heart when top=heart>base', () => {
    expect(pickInitialLayer(4, 4, 2)).toBe('heart');
  });
});
