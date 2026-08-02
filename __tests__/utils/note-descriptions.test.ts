import { getNoteDescription, getNoteEmoji, getAccordDescription } from '../../src/utils/note-descriptions';

describe('getNoteDescription', () => {
  it('returns a description for known notes', () => {
    const desc = getNoteDescription('bergamot');
    expect(desc).toContain('Agrume méditerranéen');
    expect(desc.length).toBeGreaterThan(20);
  });

  it('is case-insensitive', () => {
    const lower = getNoteDescription('vanilla');
    const upper = getNoteDescription('VANILLA');
    expect(lower).toBe(upper);
  });

  it('trims whitespace', () => {
    const desc = getNoteDescription('  vanilla  ');
    expect(desc).toBe(getNoteDescription('vanilla'));
  });

  it('returns a generic fallback for unknown notes', () => {
    const desc = getNoteDescription('nonexistent_note_xyz');
    expect(desc).toContain('Une matière première');
    expect(desc.length).toBeGreaterThan(10);
  });

  it('returns fallback for empty string', () => {
    const desc = getNoteDescription('');
    expect(desc).toContain('Une matière première');
  });

  it('handles multi-word note names', () => {
    const desc = getNoteDescription('orange blossom');
    expect(desc).toContain("Fleur d'oranger");
  });

  it('handles notes with special characters', () => {
    const desc = getNoteDescription('ylang-ylang');
    expect(desc).toContain('exotique');
  });
});

describe('getNoteEmoji', () => {
  it('returns an emoji for known notes', () => {
    expect(getNoteEmoji('bergamot')).toBe('🍋');
    expect(getNoteEmoji('vanilla')).toBe('🍯');
    expect(getNoteEmoji('rose')).toBe('🌸');
    expect(getNoteEmoji('cedar')).toBe('🪵');
  });

  it('returns sparkles for unknown notes', () => {
    expect(getNoteEmoji('unknown_note')).toBe('✨');
    expect(getNoteEmoji('')).toBe('✨');
  });

  it('is case-insensitive', () => {
    expect(getNoteEmoji('BERGAMOT')).toBe('🍋');
    expect(getNoteEmoji('Rose')).toBe('🌸');
  });
});

describe('getAccordDescription', () => {
  it('returns a dedicated accord description for olfactory families', () => {
    const desc = getAccordDescription('fresh spicy');
    expect(desc).toContain('épices froides');
  });

  it('prefers the accord description over the note one (amber)', () => {
    const desc = getAccordDescription('amber');
    expect(desc).toContain('résineux');
    expect(desc).not.toBe(getNoteDescription('amber'));
  });

  it('falls back to the note description for ingredient-accords', () => {
    expect(getAccordDescription('bergamot')).toBe(getNoteDescription('bergamot'));
  });

  it('is case-insensitive and trims whitespace', () => {
    expect(getAccordDescription('  WOODY  ')).toBe(getAccordDescription('woody'));
  });

  it('returns null for unknown accords', () => {
    expect(getAccordDescription('nonexistent_accord_xyz')).toBeNull();
    expect(getAccordDescription('')).toBeNull();
  });
});
