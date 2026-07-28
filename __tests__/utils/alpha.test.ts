import { alpha, tintLuminous, tintStructural } from '../../src/utils/alpha';

describe('alpha', () => {
  it('converts a 6-digit hex with the given ratio', () => {
    expect(alpha('#FF0000', 0.5)).toBe('rgba(255,0,0,0.5)');
  });

  it('expands a 3-digit hex', () => {
    expect(alpha('#F00', 0.25)).toBe('rgba(255,0,0,0.25)');
  });

  it('parses without a leading hash', () => {
    expect(alpha('00FF00', 1)).toBe('rgba(0,255,0,1)');
  });
});

describe('tintLuminous', () => {
  it('uses the full tier ratio in light mode', () => {
    expect(tintLuminous('#000000', 'hint', 'light')).toBe('rgba(0,0,0,0.16)');
    expect(tintLuminous('#000000', 'veil', 'light')).toBe('rgba(0,0,0,0.24)');
  });

  it('halves the ratio in dark mode (luminous effect)', () => {
    expect(tintLuminous('#000000', 'hint', 'dark')).toBe('rgba(0,0,0,0.08)');
    expect(tintLuminous('#000000', 'dim', 'dark')).toBe('rgba(0,0,0,0.2)');
  });
});

describe('tintStructural', () => {
  it('keeps the same ratio regardless of theme', () => {
    expect(tintStructural('#000000', 'dim')).toBe('rgba(0,0,0,0.4)');
  });
});
