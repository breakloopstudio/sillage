import { brandColor, BRAND_PALETTE } from '../../src/utils/brand-color';

describe('brandColor', () => {
  it('returns a color from the palette', () => {
    expect(BRAND_PALETTE).toContain(brandColor('Dior'));
    expect(BRAND_PALETTE).toContain(brandColor('Chanel'));
    expect(BRAND_PALETTE).toContain(brandColor(''));
  });

  it('is deterministic', () => {
    expect(brandColor('Tom Ford')).toBe(brandColor('Tom Ford'));
    expect(brandColor('Guerlain')).toBe(brandColor('Guerlain'));
  });

  it('handles unicode brands without crashing', () => {
    expect(BRAND_PALETTE).toContain(brandColor('L\u2019Artisan'));
    expect(BRAND_PALETTE).toContain(brandColor('\u00C9tat Libre'));
  });
});
