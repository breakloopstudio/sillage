// src/components/PriceAlertSheet.tsx — Gestion d'une alerte prix (cible pré-remplie)

import { useMemo, useEffect, useState, useCallback } from 'react';
import { View, Text, Pressable, BackHandler } from 'react-native';
import { Image } from 'expo-image';
import Ionicons from '@react-native-vector-icons/ionicons/static';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  cancelAnimation,
  useReducedMotion,
  runOnJS,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, type Theme } from '../theme/ThemeContext';
import { hapticsLight } from '../services/haptics';
import { getLowestObservedPrice } from '../services/user-data';
import { formatPrice } from '../utils/format-price';
import { suggestTargetPrice } from '../utils/price-alerts';
import type { UserPriceAlert } from '../models/user-price-alert.interface';

type AlertMode = 'drop' | 'target';

interface Props {
  visible: boolean;
  parfumId: string;
  nom: string;
  marque: string;
  imageUrl: string | null;
  bestPrice?: number;
  referencePrice?: number;
  existingAlert: UserPriceAlert | null;
  onClose: () => void;
  onSave: (active: boolean, targetPrice: number | null) => void;
}

const STEP = 5;

export default function PriceAlertSheet({
  visible, parfumId, nom, marque, imageUrl, bestPrice, referencePrice, existingAlert, onClose, onSave,
}: Props) {
  const { theme } = useTheme();
  const s = useMemo(() => getStyles(theme), [theme]);
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const [imgFailed, setImgFailed] = useState(false);
  const [mounted, setMounted] = useState(visible);

  const [active, setActive] = useState(false);
  const [mode, setMode] = useState<AlertMode>('drop');
  const [targetValue, setTargetValue] = useState(0);
  const [lowest, setLowest] = useState<number | null>(null);

  const translateY = useSharedValue(300);
  const backdropOpacity = useSharedValue(0);
  const knobX = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      backdropOpacity.value = withTiming(1, { duration: reduced ? 0 : 200 });
      translateY.value = reduced ? withTiming(0, { duration: 0 }) : withSpring(0, { damping: 22, stiffness: 280, mass: 0.8 });
      const suggested = suggestTargetPrice(bestPrice, referencePrice);
      if (existingAlert) {
        setActive(true);
        if (existingAlert.targetPrice != null) { setMode('target'); setTargetValue(existingAlert.targetPrice); }
        else { setMode('drop'); setTargetValue(suggested ?? 0); }
      } else {
        setActive(true);
        if (suggested != null) { setMode('target'); setTargetValue(suggested); }
        else { setMode('drop'); setTargetValue(0); }
      }
      setLowest(null);
      getLowestObservedPrice(parfumId).then(setLowest);
    } else if (mounted) {
      backdropOpacity.value = withTiming(0, { duration: reduced ? 0 : 150 });
      translateY.value = withTiming(300, { duration: reduced ? 0 : 200 }, (finished) => {
        if (finished) runOnJS(setMounted)(false);
      });
    }
    return () => {
      cancelAnimation(backdropOpacity);
      cancelAnimation(translateY);
    };
  }, [visible, reduced]);

  useEffect(() => {
    if (!visible) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { onClose(); return true; });
    return () => sub.remove();
  }, [visible, onClose]);

  useEffect(() => {
    knobX.value = reduced ? withTiming(active ? 20 : 0, { duration: 0 }) : withSpring(active ? 20 : 0, { stiffness: 300, damping: 20 });
  }, [active, reduced]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdropOpacity.value }));
  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));
  const knobStyle = useAnimatedStyle(() => ({ transform: [{ translateX: knobX.value }] }));

  const handleToggle = useCallback(() => { hapticsLight(); setActive(v => !v); }, []);
  const handleMode = useCallback((m: AlertMode) => { hapticsLight(); setMode(m); }, []);
  const handleDec = useCallback(() => { hapticsLight(); setTargetValue(v => Math.max(STEP, v - STEP)); }, []);
  const handleInc = useCallback(() => { hapticsLight(); setTargetValue(v => v + STEP); }, []);
  const handleSave = useCallback(() => {
    hapticsLight();
    onSave(active, active && mode === 'target' ? targetValue : null);
  }, [active, mode, targetValue, onSave]);

  if (!mounted) return null;

  return (
    <View style={s.wrapper}>
      <Animated.View style={[s.backdrop, backdropStyle]}>
        <Pressable style={s.backdropTouch} onPress={onClose} />
      </Animated.View>
      <Animated.View style={[s.sheet, { paddingBottom: insets.bottom + 20 }, sheetStyle]}>
        <View style={s.handle} />

        <View style={s.header}>
          {imageUrl && !imgFailed ? (
            <Image source={{ uri: imageUrl }} style={s.headerImg} contentFit="cover" transition={200} onError={() => setImgFailed(true)} />
          ) : (
            <View style={s.headerImgPlaceholder}>
              <Ionicons name="notifications-outline" size={20} color={theme.colors.textMuted} />
            </View>
          )}
          <View style={s.headerText}>
            <Text style={s.headerBrand} numberOfLines={1}>{marque}</Text>
            <Text style={s.headerName} numberOfLines={2}>{nom}</Text>
          </View>
        </View>

        <Pressable style={s.toggleRow} onPress={handleToggle} accessibilityRole="switch" accessibilityState={{ checked: active }} accessibilityLabel="Alerte prix">
          <View style={s.toggleLeft}>
            <Ionicons name={active ? 'notifications' : 'notifications-outline'} size={20} color={active ? theme.colors.primary : theme.colors.textMuted} />
            <View>
              <Text style={s.toggleLabel}>Alerte prix</Text>
              <Text style={s.toggleDesc}>{active ? 'Tu seras prévenu' : 'Alerte désactivée'}</Text>
            </View>
          </View>
          <View style={[s.track, active && s.trackActive]}>
            <Animated.View style={[s.knob, { backgroundColor: active ? theme.colors.primary : theme.colors.textMuted }, knobStyle]} />
          </View>
        </Pressable>

        {active ? (
          <View style={s.modeBlock}>
            <View style={s.modeChips}>
              <Pressable style={[s.modeChip, mode === 'drop' && s.modeChipActive]} onPress={() => handleMode('drop')} accessibilityRole="button" accessibilityLabel="Préviens-moi d'une baisse">
                <Text style={[s.modeChipText, mode === 'drop' && s.modeChipTextActive]} allowFontScaling={false}>Une baisse</Text>
              </Pressable>
              <Pressable style={[s.modeChip, mode === 'target' && s.modeChipActive]} onPress={() => handleMode('target')} accessibilityRole="button" accessibilityLabel="Préviens-moi sous un prix">
                <Text style={[s.modeChipText, mode === 'target' && s.modeChipTextActive]} allowFontScaling={false}>Sous un prix</Text>
              </Pressable>
            </View>

            {mode === 'target' ? (
              <View style={s.stepperRow}>
                <Pressable style={s.stepperBtn} onPress={handleDec} hitSlop={6} accessibilityRole="button" accessibilityLabel="Diminuer">
                  <Ionicons name="remove" size={18} color={theme.colors.primary} />
                </Pressable>
                <Text style={s.stepperValue}>{formatPrice(targetValue, { decimals: 0 })}</Text>
                <Pressable style={s.stepperBtn} onPress={handleInc} hitSlop={6} accessibilityRole="button" accessibilityLabel="Augmenter">
                  <Ionicons name="add" size={18} color={theme.colors.primary} />
                </Pressable>
              </View>
            ) : (
              <Text style={s.modeHint}>Déclenchée dès −10 % ou −5 €.</Text>
            )}

            {lowest != null ? (
              <Text style={s.lowestHint}>Plus bas constaté : {formatPrice(lowest, { decimals: 0 })}</Text>
            ) : null}
          </View>
        ) : null}

        <Pressable style={[s.cta, !active && s.ctaOff]} onPress={handleSave} accessibilityRole="button" accessibilityLabel={active ? 'Enregistrer' : 'Désactiver l\u2019alerte'}>
          <Text style={[s.ctaText, !active && s.ctaTextOff]}>{active ? 'Enregistrer' : 'Désactiver l\u2019alerte'}</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

function getStyles(t: Theme) {
  return {
    wrapper: { position: 'absolute' as const, inset: 0, zIndex: 100, justifyContent: 'flex-end' as const },
    backdrop: { ...({ position: 'absolute' as const, inset: 0, backgroundColor: 'rgba(0,0,0,0.4)' } as const) },
    backdropTouch: { flex: 1 },
    sheet: {
      backgroundColor: t.colors.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingTop: 12,
      paddingHorizontal: 16,
      gap: 4,
      ...t.shadow.elevated,
    },
    handle: { alignSelf: 'center' as const, width: 36, height: 5, borderRadius: 3, backgroundColor: t.colors.border, marginBottom: 12 },
    header: {
      flexDirection: 'row' as const, alignItems: 'center' as const, gap: 12,
      paddingBottom: 12, borderBottomWidth: 0.5, borderBottomColor: t.colors.border, marginBottom: 8,
    },
    headerImg: { width: 48, height: 48, borderRadius: 10, backgroundColor: t.colors.surface2 },
    headerImgPlaceholder: { width: 48, height: 48, borderRadius: 10, backgroundColor: t.colors.surface2, justifyContent: 'center' as const, alignItems: 'center' as const },
    headerText: { flex: 1 },
    headerBrand: { fontFamily: 'Inter_400Regular', fontSize: 11, textTransform: 'uppercase' as const, letterSpacing: 1.2, color: t.colors.textMuted, marginBottom: 2 },
    headerName: { fontFamily: 'PlayfairDisplay_600SemiBold', fontSize: 17, color: t.colors.text },

    toggleRow: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const, paddingVertical: 12, paddingHorizontal: 8, gap: 12 },
    toggleLeft: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 10, flex: 1 },
    toggleLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: t.colors.text },
    toggleDesc: { fontFamily: 'Inter_400Regular', fontSize: 12, color: t.colors.textMuted, marginTop: 1 },
    track: { width: 48, height: 28, borderRadius: 14, backgroundColor: t.colors.border, justifyContent: 'center' as const, paddingHorizontal: 3 },
    trackActive: { backgroundColor: t.colors.primarySoft },
    knob: { width: 22, height: 22, borderRadius: 11 },

    modeBlock: { paddingHorizontal: 8, paddingTop: 4, paddingBottom: 8, gap: 10 },
    modeChips: { flexDirection: 'row' as const, gap: 8 },
    modeChip: { flex: 1, alignItems: 'center' as const, justifyContent: 'center' as const, paddingVertical: 10, minHeight: 44, borderRadius: 20, backgroundColor: t.colors.surface2, borderWidth: 1, borderColor: 'transparent' },
    modeChipActive: { backgroundColor: t.colors.primarySoft, borderColor: t.colors.primary },
    modeChipText: { fontFamily: 'Inter_500Medium', fontSize: 13, color: t.colors.textMuted },
    modeChipTextActive: { color: t.colors.primaryInk, fontFamily: 'Inter_600SemiBold' },
    stepperRow: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const, gap: 20 },
    stepperBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: t.colors.surface2, alignItems: 'center' as const, justifyContent: 'center' as const },
    stepperValue: { fontFamily: 'Inter_700Bold', fontSize: 22, color: t.colors.text, minWidth: 90, textAlign: 'center' as const, fontVariant: ['tabular-nums'] as import('react-native').FontVariant[] },
    modeHint: { fontFamily: 'Inter_400Regular', fontSize: 13, color: t.colors.textMuted, textAlign: 'center' as const },
    lowestHint: { fontFamily: 'Inter_500Medium', fontSize: 12, color: t.colors.dealInk, textAlign: 'center' as const },

    cta: { marginTop: 8, paddingVertical: 14, alignItems: 'center' as const, borderRadius: t.radius.base, backgroundColor: t.colors.primary, minHeight: 50, justifyContent: 'center' as const },
    ctaOff: { backgroundColor: t.colors.surface2 },
    ctaText: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: '#FFFFFF' },
    ctaTextOff: { color: t.colors.danger },
  } as const;
}
