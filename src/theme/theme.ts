// src/theme/theme.ts
// Design tokens ParfumScan — Refonte « Luxe malin »
// Phase A : nouveaux tokens + rétrocompatibilité avec l'existant
// Dark mode : palette « Luxe profond »

import type { ViewStyle } from 'react-native';// ── Palette light (inchangée) ──
const lightColors = {
  background: '#F8F6F2',
  surface: '#FFFFFF',
  surface2: '#F3F1ED',
  surfaceImgBottom: '#EDEAE5',
  border: '#E8E4DE',
  text: '#1A1520',
  textMuted: '#6E6963',
  textInverse: '#FFFFFF',
  primary: '#6C3ED9',
  primarySoft: '#F0EBFA',
  primaryInk: '#4C2A9E',
  secondary: '#C8945A',
  secondaryInk: '#8B6934',
  secondarySoft: '#FBF5EE',
  deal: '#0D9488',
  dealSoft: '#E6F7F5',
  dealInk: '#0A6E66',
  overpriced: '#E04444',
  overpricedSoft: '#FEF2F2',
  overpricedInk: '#B91C1C',
  fair: '#D97706',
  fairSoft: '#FFF8ED',
  fairInk: '#8B6934',
  favorite: '#E04444',
  favoriteSoft: '#FEF2F2',
  pyramidTop: '#0D9488',
  pyramidTopSoft: '#E6F7F5',
  pyramidHeart: '#C8945A',
  pyramidHeartSoft: '#FBF5EE',
  pyramidBase: '#6C3ED9',
  pyramidBaseSoft: '#F0EBFA',
  danger: '#E04444',
  success: '#0D9488',
  warning: '#D97706',
  medium: '#8B8580',
  light: '#F3F1ED',
  primaryShade: '#4C2A9E',
  primaryTint: '#8B5CF6',
  secondaryShade: '#B3814A',
  secondaryTint: '#D4A574',
  tertiary: '#D97706',
  violetSoft: '#F0EBFA',
  violetInk: '#4C2A9E',
  reward: '#C8945A',
  rewardInk: '#8B6934',
  rewardSoft: '#FBF5EE',
  pyramidTopInk: '#0A6E66',
  pyramidHeartInk: '#B3814A',
  pyramidBaseInk: '#4C2A9E',
  seasonSpring: '#3E9B6D',
  seasonSpringSoft: '#EAF4EE',
  seasonSummer: '#EE6C4A',
  seasonSummerSoft: '#FDEEE8',
  seasonFall: '#A85B32',
  seasonFallSoft: '#F5EDE6',
  seasonWinter: '#4A7FB5',
  seasonWinterSoft: '#EBF1F8',
  accord0: '#B5791F',
  accord1: '#8A5A2C',
  accord2: '#7C4A33',
  accord3: '#C24E7C',
  accord4: '#8E6FA6',
  accord5: '#3F8A52',
  accord6: '#C0512B',
  accord7: '#2B7E8F',
  perf: '#3D5A6C',
  perfSoft: '#E9EFF2',
  perfInk: '#2C4654',
  scanBeam: 'rgba(108, 62, 217, 0.85)',
  glow: 'rgba(108, 62, 217, 0.35)',
} as const;

// ── Palette dark « Luxe profond » ──
const darkColors = {
  background: '#0B0712',
  surface: '#15101E',
  surface2: '#1D1728',
  surfaceImgBottom: '#0E0A16',
  border: '#2A2238',
  text: '#EDE8F5',
  textMuted: '#988EA8',
  textInverse: '#0B0712',
  primary: '#8B6CF6',
  primarySoft: '#1E1830',
  primaryInk: '#B9A0F8',
  secondary: '#D4A960',
  secondaryInk: '#E0C090',
  secondarySoft: '#241E12',
  deal: '#2DD4BF',
  dealSoft: '#0D2826',
  dealInk: '#5EEAD4',
  overpriced: '#EF4444',
  overpricedSoft: '#291010',
  overpricedInk: '#FCA5A5',
  fair: '#F59E0B',
  fairSoft: '#221A0C',
  fairInk: '#E0C090',
  favorite: '#EF4444',
  favoriteSoft: '#291010',
  pyramidTop: '#2DD4BF',
  pyramidTopSoft: '#0D2826',
  pyramidHeart: '#D4A960',
  pyramidHeartSoft: '#241E12',
  pyramidBase: '#8B6CF6',
  pyramidBaseSoft: '#1E1830',
  danger: '#EF4444',
  success: '#2DD4BF',
  warning: '#F59E0B',
  medium: '#988EA8',
  light: '#1D1728',
  primaryShade: '#B9A0F8',
  primaryTint: '#A78BFA',
  secondaryShade: '#E0BC7A',
  secondaryTint: '#DEB87A',
  tertiary: '#F59E0B',
  violetSoft: '#1E1830',
  violetInk: '#B9A0F8',
  reward: '#D4A960',
  rewardInk: '#E0C090',
  rewardSoft: '#241E12',
  pyramidTopInk: '#5EEAD4',
  pyramidHeartInk: '#E0BC7A',
  pyramidBaseInk: '#B9A0F8',
  seasonSpring: '#5FBF8A',
  seasonSpringSoft: '#0F2A1E',
  seasonSummer: '#F58A63',
  seasonSummerSoft: '#2E1A12',
  seasonFall: '#C97F4F',
  seasonFallSoft: '#27190F',
  seasonWinter: '#6FA3DE',
  seasonWinterSoft: '#16222F',
  accord0: '#D9A24A',
  accord1: '#B9854E',
  accord2: '#AB785C',
  accord3: '#E07BA1',
  accord4: '#B79BCC',
  accord5: '#67B27C',
  accord6: '#E07A52',
  accord7: '#4FA6B8',
  perf: '#7FA0B3',
  perfSoft: '#15222B',
  perfInk: '#A6C1D1',
  scanBeam: 'rgba(139, 108, 246, 0.90)',
  glow: 'rgba(139, 108, 246, 0.40)',
} as const;

// ── Ombres light (inchangées) ──
const lightShadow = {
  card: {
    shadowColor: '#1A1520',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  elevated: {
    shadowColor: '#1A1520',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 6,
  },
  button: {
    shadowColor: '#6C3ED9',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  scanCircle: {
    shadowColor: '#6C3ED9',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
} as const;

// ── Ombres dark (bordures subtiles, pas d'ombres noires invisibles) ──
const darkShadow = {
  card: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  elevated: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  button: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
    borderWidth: 1,
    borderColor: 'rgba(139,108,246,0.25)',
  },
  scanCircle: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
    borderWidth: 1.5,
    borderColor: 'rgba(139,108,246,0.30)',
  },
} as const;

// ── Tokens partagés (identiques dans les deux thèmes) ──
const shared = {
  fonts: {
    display: { fontFamily: 'PlayfairDisplay_700Bold' },
    displaySemiBold: { fontFamily: 'PlayfairDisplay_600SemiBold' },
    displayItalic: { fontFamily: 'PlayfairDisplay_700Bold_Italic' },
    body: { fontFamily: 'Inter_400Regular' },
    bodyMedium: { fontFamily: 'Inter_500Medium' },
    bodySemiBold: { fontFamily: 'Inter_600SemiBold' },
    bodyBold: { fontFamily: 'Inter_700Bold' },
    heading: { fontFamily: 'PlayfairDisplay_700Bold' },
    headingSemiBold: { fontFamily: 'PlayfairDisplay_600SemiBold' },
    headingMedium: { fontFamily: 'PlayfairDisplay_500Medium' },
    size: {
      xs: 10,
      sm: 12,
      base: 14,
      md: 16,
      lg: 18,
      xl: 22,
      '2xl': 28,
      '3xl': 34,
      '4xl': 42,
    },
  },
  radius: {
    sm: 8,
    base: 12,
    card: 16,
    lg: 20,
    xl: 24,
    full: 9999,
  },
  spacing: {
    xs: 4,
    sm: 8,
    base: 12,
    md: 16,
    lg: 20,
    xl: 24,
    '2xl': 32,
    '3xl': 48,
  },
} as const;

export interface Theme {
  colors: Record<string, string>;
  fonts: typeof shared.fonts;
  radius: typeof shared.radius;
  spacing: typeof shared.spacing;
  shadow: {
    card: ViewStyle;
    elevated: ViewStyle;
    button: ViewStyle;
    scanCircle: ViewStyle;
  };
}

export const lightTheme: Theme = {
  colors: lightColors,
  ...shared,
  shadow: lightShadow,
};

export const darkTheme: Theme = {
  colors: darkColors,
  ...shared,
  shadow: darkShadow,
};

// Rétrocompatibilité — les anciens imports continuent de fonctionner
// tant que tous les composants ne sont pas migrés vers useTheme()
// À supprimer en fin de Phase 6
export const theme = lightTheme;
