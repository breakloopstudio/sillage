import {
  alpha,
  layerDuration,
  layerContextLabel,
  pickInitialLayer,
  PERSIST,
} from '../src/features/catalog/pyramid/geometry';

describe('PERSIST', () => {
  it('exposes a persistence ratio per layer', () => {
    expect(PERSIST.top).toBeGreaterThan(0);
    expect(PERSIST.heart).toBeGreaterThan(0);
    expect(PERSIST.base).toBe(1);
  });

  it('grows from top to base (evaporation)', () => {
    expect(PERSIST.top).toBeLessThan(PERSIST.heart);
    expect(PERSIST.heart).toBeLessThan(PERSIST.base);
  });

  it('keeps every ratio within 0..1', () => {
    for (const k of ['top', 'heart', 'base'] as const) {
      expect(PERSIST[k]).toBeGreaterThanOrEqual(0);
      expect(PERSIST[k]).toBeLessThanOrEqual(1);
    }
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

describe('layerDuration', () => {
  it('returns correct durations with en-dashes', () => {
    expect(layerDuration('top')).toBe('0 – 15 min');
    expect(layerDuration('heart')).toBe('15 min – 2 h');
    expect(layerDuration('base')).toBe('2 h et +');
  });

  it('uses en-dash (U+2013)', () => {
    expect(layerDuration('top')).toContain('–');
    expect(layerDuration('heart')).toContain('–');
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
