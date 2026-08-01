// src/features/scan/ScanIdle.tsx — État idle : scène de scan (balayage + voile + flacon)

import { useEffect, useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
  cancelAnimation,
  useReducedMotion,
} from 'react-native-reanimated';
import Ionicons from '@react-native-vector-icons/ionicons/static';
import { useTheme, type Theme } from '../../theme/ThemeContext';
import { textOn } from '../../utils/contrast';
import { alpha, tintLuminous } from '../../utils/alpha';

export interface RecentScan {
  parfumId: string;
  nom?: string;
  marque?: string;
  imageUrl?: string;
}

interface Props {
  onStartScan: () => void;
  onOpenSearch: () => void;
  onClose: () => void;
  recentScans?: RecentScan[];
  onOpenRecent?: (parfumId: string) => void;
  isOnline?: boolean;
}

const VF = 210;
const CORNER = 26;
const LINE_H = 3;

export function ScanIdle({ onStartScan, onOpenSearch, onClose, recentScans = [], onOpenRecent, isOnline = true }: Props) {
  const { theme, resolvedMode } = useTheme();
  const s = useMemo(() => getStyles(theme), [theme]);
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const scanY = useSharedValue(0);

  useEffect(() => {
    if (reduced) return;
    scanY.value = withRepeat(
      withTiming(VF - 16 - LINE_H, { duration: 1900, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
    return () => cancelAnimation(scanY);
  }, [reduced]);

  const scanStyle = useAnimatedStyle(() => ({ transform: [{ translateY: scanY.value }] }));

  return (
    <View style={[s.container, { paddingTop: insets.top + 16 }]}>
      <Pressable
        onPress={onClose}
        style={[s.closeBtn, { top: insets.top + 12 }]}
        hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
        accessibilityRole="button"
        accessibilityLabel="Fermer le scan"
      >
        <Ionicons name="close" size={20} color={theme.colors.textMuted} />
      </Pressable>

      <View style={s.main}>
        <View style={s.viewfinder}>
          <View style={[s.veilOuter, { backgroundColor: tintLuminous(theme.colors.primary, 'ghost', resolvedMode) }]} />
          <View style={[s.veilInner, { backgroundColor: tintLuminous(theme.colors.primary, 'hint', resolvedMode) }]} />
          <View style={[s.corner, s.tl]} />
          <View style={[s.corner, s.tr]} />
          <View style={[s.corner, s.bl]} />
          <View style={[s.corner, s.br]} />

          <View style={s.bottle}>
            <View style={[s.bCap, { backgroundColor: alpha(theme.colors.primary, 0.22) }]} />
            <View style={[s.bNeck, { backgroundColor: alpha(theme.colors.primary, 0.16) }]} />
            <View style={[s.bBody, { backgroundColor: alpha(theme.colors.primary, 0.13) }]} />
          </View>

          {!reduced && (
            <Animated.View style={[s.scanLine, scanStyle]}>
              <LinearGradient
                colors={[alpha(theme.colors.primary, 0), theme.colors.primary, alpha(theme.colors.primary, 0)]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={StyleSheet.absoluteFill}
              />
            </Animated.View>
          )}
        </View>

        <Text style={s.overline}>Sillage</Text>
        <Text style={s.title}>Cadre le flacon</Text>
        <Text style={s.desc}>
          L'IA reconnaît le parfum et trouve{'\n'}le meilleur prix pour toi.
        </Text>

        <View style={s.actions}>
          <Pressable onPress={onStartScan} style={[s.cta, !isOnline && { opacity: 0.5 }]}>
            <Ionicons name="camera-outline" size={20} color={textOn(theme.colors.primary)} style={{ marginRight: 8 }} />
            <Text style={s.ctaText}>Scanner un flacon</Text>
          </Pressable>

          <Pressable onPress={onOpenSearch} style={s.link} accessibilityRole="button" accessibilityLabel="Rechercher dans le catalogue">
            <Ionicons name="search-outline" size={16} color={theme.colors.textMuted} style={{ marginRight: 6 }} />
            <Text style={s.linkText}>Rechercher dans le catalogue</Text>
          </Pressable>
        </View>

        {recentScans.length > 0 && (
          <View style={s.recentWrap}>
            <Text style={s.recentTitle}>Scans récents</Text>
            <View style={s.recentRow}>
              {recentScans.map((r) => (
                <Pressable
                  key={r.parfumId}
                  style={s.recentItem}
                  onPress={() => onOpenRecent?.(r.parfumId)}
                  accessibilityRole="button"
                  accessibilityLabel={`${r.marque ?? ''} ${r.nom ?? ''}`.trim()}
                >
                  {r.imageUrl ? (
                    <Image source={{ uri: r.imageUrl }} style={s.recentImg} contentFit="contain" />
                  ) : (
                    <View style={[s.recentImg, s.recentImgEmpty]}>
                      <Ionicons name="flask-outline" size={20} color={theme.colors.textMuted} />
                    </View>
                  )}
                  <Text style={s.recentLabel} numberOfLines={1}>{r.nom ?? r.marque ?? 'Parfum'}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {!isOnline && (
          <Text style={s.offlineHint}>Scan indisponible hors-ligne</Text>
        )}
      </View>

      <Text style={[s.tip, { marginBottom: 24 + insets.bottom }]}>
        Astuce : cadre la marque et le nom pour un résultat optimal
      </Text>
    </View>
  );
}

function getStyles(t: Theme) {
  const veilOuter = 300;
  const veilInner = 232;
  return {
    container: {
      flex: 1,
      backgroundColor: t.colors.background,
      alignItems: 'center',
      paddingHorizontal: 32,
    },
    main: {
      flex: 1,
      width: '100%',
      justifyContent: 'center',
      alignItems: 'center',
    },
    closeBtn: {
      position: 'absolute',
      right: 16,
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: t.colors.surface2,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border,
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1,
    },
    viewfinder: {
      width: VF,
      height: VF,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 28,
    },
    veilOuter: {
      position: 'absolute',
      width: veilOuter,
      height: veilOuter,
      borderRadius: veilOuter / 2,
      left: (VF - veilOuter) / 2,
      top: (VF - veilOuter) / 2,
    },
    veilInner: {
      position: 'absolute',
      width: veilInner,
      height: veilInner,
      borderRadius: veilInner / 2,
      left: (VF - veilInner) / 2,
      top: (VF - veilInner) / 2,
    },
    corner: {
      position: 'absolute',
      width: CORNER,
      height: CORNER,
      borderColor: t.colors.primary,
      zIndex: 2,
    },
    tl: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 8 },
    tr: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 8 },
    bl: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 8 },
    br: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 8 },
    bottle: { alignItems: 'center' },
    bCap: { width: 28, height: 16, borderRadius: 5, marginBottom: 3 },
    bNeck: { width: 18, height: 10 },
    bBody: { width: 76, height: 94, borderRadius: 14 },
    scanLine: {
      position: 'absolute',
      top: 8,
      left: 12,
      right: 12,
      height: LINE_H,
      borderRadius: LINE_H / 2,
      zIndex: 3,
    },
    overline: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 10,
      letterSpacing: 2.5,
      textTransform: 'uppercase',
      color: t.colors.textMuted,
      marginBottom: 6,
    },
    title: {
      fontFamily: 'PlayfairDisplay_700Bold',
      fontSize: 32,
      color: t.colors.text,
      marginBottom: 8,
    },
    desc: {
      fontFamily: 'Inter_400Regular',
      fontSize: 14,
      color: t.colors.textMuted,
      textAlign: 'center',
      lineHeight: 21,
      marginBottom: 30,
    },
    actions: {
      width: '100%',
      maxWidth: 320,
    },
    cta: {
      flexDirection: 'row',
      backgroundColor: t.colors.primary,
      borderRadius: t.radius.base,
      height: 54,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 12,
      ...t.shadow.button,
    },
    ctaText: {
      color: textOn(t.colors.primary),
      fontFamily: 'Inter_600SemiBold',
      fontSize: 17,
    },
    recentWrap: {
      width: '100%',
      maxWidth: 320,
      marginTop: 10,
    },
    recentTitle: {
      fontFamily: 'Inter_500Medium',
      fontSize: 11,
      letterSpacing: 1,
      color: t.colors.textMuted,
      textTransform: 'uppercase',
      marginBottom: 10,
      textAlign: 'center',
    },
    recentRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 16,
    },
    recentItem: {
      width: 72,
      alignItems: 'center',
    },
    recentImg: {
      width: 64,
      height: 64,
      borderRadius: t.radius.base,
      backgroundColor: t.colors.surface2,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border,
    },
    recentImgEmpty: {
      justifyContent: 'center',
      alignItems: 'center',
    },
    recentLabel: {
      fontFamily: 'Inter_400Regular',
      fontSize: 11,
      color: t.colors.textMuted,
      marginTop: 4,
      textAlign: 'center',
      maxWidth: 72,
    },
    link: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 24,
    },
    linkText: {
      fontFamily: 'Inter_500Medium',
      fontSize: 14,
      color: t.colors.textMuted,
    },
    tip: {
      fontFamily: 'Inter_400Regular',
      fontSize: 12,
      color: t.colors.textMuted,
      textAlign: 'center',
    },
    offlineHint: {
      fontFamily: 'Inter_400Regular',
      fontSize: 12,
      color: t.colors.textMuted,
      marginTop: 4,
      textAlign: 'center',
    },
  } as const;
}
