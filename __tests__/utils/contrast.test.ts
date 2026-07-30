import { luminance, textOn } from '../../src/utils/contrast';

describe('luminance', () => {
  it('is ~0 for black and ~1 for white', () => {
    expect(luminance('#000000')).toBeCloseTo(0, 5);
    expect(luminance('#FFFFFF')).toBeCloseTo(1, 5);
  });
});

describe('textOn', () => {
  it('picks dark ink on light backgrounds', () => {
    expect(textOn('#FFFFFF')).toBe('#1A1520');
    expect(textOn('#F8F6F2')).toBe('#1A1520');
  });

  it('picks white on dark backgrounds', () => {
    expect(textOn('#000000')).toBe('#FFFFFF');
    expect(textOn('#0B0712')).toBe('#FFFFFF');
    expect(textOn('#6C3ED9')).toBe('#FFFFFF');
  });

  it('falls back to white on invalid hex (no crash)', () => {
    expect(textOn('not-a-color')).toBe('#FFFFFF');
  });
});
