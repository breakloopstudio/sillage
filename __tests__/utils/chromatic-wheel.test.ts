import {
  CHROMATIC_WHEEL, RING_ANCHORS, CENTER_NEUTRALS,
  getColorByKey, hueToAnchor, hueDistance, nearestAnchorIndex, hitPadIndex,
  hsvToHex, hexToHue,
  chromaSwatch, CHROMA_PALETTE_LIGHT, CHROMA_PALETTE_DARK,
  type ChromaticKey,
} from '../../src/utils/chromatic-wheel';

describe('chromatic-wheel', () => {
  it('defines 16 colors: 12 ring anchors + 4 center neutrals', () => {
    expect(CHROMATIC_WHEEL).toHaveLength(16);
    expect(RING_ANCHORS).toHaveLength(12);
    expect(CENTER_NEUTRALS).toHaveLength(4);
    expect(CENTER_NEUTRALS.map(c => c.key)).toEqual(['black', 'white', 'gray', 'brown']);
    expect(new Set(CHROMATIC_WHEEL.map(c => c.key)).size).toBe(16);
  });

  it('ring anchors are equidistant (30°) and sorted by hue', () => {
    for (const a of RING_ANCHORS) expect(typeof a.hue).toBe('number');
    const hues = RING_ANCHORS.map(a => a.hue as number);
    expect([...hues].sort((x, y) => x - y)).toEqual(hues);
    for (let i = 0; i < hues.length; i++) expect(hues[i]).toBe(i * 30);
  });

  it('respects RPC guard ceilings (≤ 8 accords, ≤ 6 notes)', () => {
    for (const c of CHROMATIC_WHEEL) {
      expect(c.accords.length).toBeLessThanOrEqual(8);
      expect(c.accords.length).toBeGreaterThan(0);
      expect(c.notes.length).toBeLessThanOrEqual(6);
      expect(c.season === null || ['spring', 'summer', 'fall', 'winter'].includes(c.season)).toBe(true);
    }
  });

  it('looks up a color by key', () => {
    expect(getColorByKey('black')?.tagline).toBe('Encens, myrrhe et nuit');
    expect(getColorByKey(null)).toBeUndefined();
    expect(getColorByKey('unknown')).toBeUndefined();
  });

  it('resolves FR labels via i18next (jest-setup init fr)', () => {
    expect(getColorByKey('red')?.label).toBe('Rouge');
    expect(getColorByKey('yellow')?.label).toBe('Jaune');
    expect(getColorByKey('lime')?.label).toBe('Citron vert');
    expect(getColorByKey('teal')?.label).toBe('Bleu canard');
    expect(getColorByKey('brown')?.label).toBe('Marron');
  });

  it('hueToAnchor snaps to the nearest ring anchor (Voronoi circulaire)', () => {
    expect(hueToAnchor(0).key).toBe('red');
    expect(hueToAnchor(20).key).toBe('orange');
    expect(hueToAnchor(100).key).toBe('lime');
    expect(hueToAnchor(130).key).toBe('green');
    expect(hueToAnchor(200).key).toBe('blue');
    expect(hueToAnchor(240).key).toBe('indigo');
    expect(hueToAnchor(300).key).toBe('magenta');
    expect(hueToAnchor(340).key).toBe('pink');
    // wrap-around : 359° est plus proche de rouge (0°) que de pink (330°)
    expect(hueToAnchor(359).key).toBe('red');
    expect(hueToAnchor(-30).key).toBe('pink');
    expect(hueToAnchor(720).key).toBe('red');
  });

  it('hueDistance returns shortest signed distance', () => {
    expect(hueDistance(10, 350)).toBe(-20);
    expect(hueDistance(350, 10)).toBe(20);
    expect(Math.abs(hueDistance(0, 180))).toBe(180);
    expect(hueDistance(90, 90)).toBe(0);
  });

  it('nearestAnchorIndex matches hueToAnchor (miroir du worklet de la roue)', () => {
    const hues = RING_ANCHORS.map(a => a.hue ?? 0);
    for (const probe of [0, 10, 15, 20, 45, 60, 90, 100, 130, 180, 200, 240, 300, 330, 359, -30, 720]) {
      const idx = nearestAnchorIndex(hues, probe);
      expect(RING_ANCHORS[idx]).toBe(hueToAnchor(probe));
    }
    // Tie exact à hue 15 entre red (0) et orange (30) → première ancre en hue croissante
    expect(RING_ANCHORS[nearestAnchorIndex(hues, 15)].key).toBe('red');
  });

  it('hitPadIndex returns the touched pad or -1', () => {
    const centers = [{ x: 100, y: 100 }, { x: 200, y: 100 }, { x: 150, y: 180 }];
    expect(hitPadIndex(100, 100, centers, 31)).toBe(0);
    expect(hitPadIndex(205, 102, centers, 31)).toBe(1);
    expect(hitPadIndex(150, 175, centers, 31)).toBe(2);
    // Hors zone (> hitRadius du centre le plus proche)
    expect(hitPadIndex(150, 130, centers, 31)).toBe(-1);
    expect(hitPadIndex(0, 0, centers, 31)).toBe(-1);
    // À la limite : le pad le plus proche gagne
    expect(hitPadIndex(128, 100, centers, 31)).toBe(0);
  });

  it('hsvToHex converts primaries and edge cases', () => {
    expect(hsvToHex(0, 1, 1)).toBe('#FF0000');
    expect(hsvToHex(120, 1, 1)).toBe('#00FF00');
    expect(hsvToHex(240, 1, 1)).toBe('#0000FF');
    expect(hsvToHex(0, 0, 1)).toBe('#FFFFFF');
    expect(hsvToHex(0, 0, 0)).toBe('#000000');
    // hue négatif / > 360 normalisé
    expect(hsvToHex(-120, 1, 1)).toBe(hsvToHex(240, 1, 1));
    expect(hsvToHex(480, 1, 1)).toBe(hsvToHex(120, 1, 1));
  });

  it('hexToHue roundtrips with hsvToHex', () => {
    expect(hexToHue('#FF0000')).toBe(0);
    expect(hexToHue('#00FF00')).toBe(120);
    expect(hexToHue(hsvToHex(215, 0.6, 0.9))).toBeCloseTo(215, 0);
    expect(hexToHue(hsvToHex(45, 0.8, 0.7))).toBeCloseTo(45, 0);
    // achromatique → 0
    expect(hexToHue('#808080')).toBe(0);
    expect(hexToHue('invalide')).toBe(0);
  });

  it('palettes cover all 16 keys in both modes with distinct swatch/soft/ink', () => {
    const keys = CHROMATIC_WHEEL.map(c => c.key) as ChromaticKey[];
    for (const key of keys) {
      const light = CHROMA_PALETTE_LIGHT[key];
      const dark = CHROMA_PALETTE_DARK[key];
      expect(light.swatch).toMatch(/^#[0-9A-F]{6}$/);
      expect(light.soft).toMatch(/^#[0-9A-F]{6}$/);
      expect(light.ink).toMatch(/^#[0-9A-F]{6}$/);
      expect(dark.swatch).toMatch(/^#[0-9A-F]{6}$/);
      expect(dark.soft).toMatch(/^#[0-9A-F]{6}$/);
      expect(dark.ink).toMatch(/^#[0-9A-F]{6}$/);
    }
    expect(chromaSwatch('red', 'light')).toBe(CHROMA_PALETTE_LIGHT.red);
    expect(chromaSwatch('red', 'dark')).toBe(CHROMA_PALETTE_DARK.red);
  });
});
