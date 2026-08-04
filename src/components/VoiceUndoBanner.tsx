// src/components/VoiceUndoBanner.tsx — Bannière « Ce n'est pas lui ? » (§4.18)
// Affichée sur la fiche détail après une auto-ouverture vocale : ramène aux
// résultats si l'identification s'est trompée. Auto-dismiss + slide-in 250 ms.

import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  useReducedMotion,
} from 'react-native-reanimated';
import Ionicons from '@react-native-vector-icons/ionicons/static';
import { useTheme, type Theme } from '../theme/ThemeContext';

const ANIM_DURATION_MS = 250;

interface Props {
  visible: boolean;
  label: string;
  actionLabel: string;
  onPress: () => void;
  onDismiss: () => void;
  autoDismissMs?: number;
  /** Décalage bas (px) — ancrage au-dessus de la barre flottante de la fiche. */
  bottomOffset: number;
}

export default function VoiceUndoBanner({
  visible,
  label,
  actionLabel,
  onPress,
  onDismiss,
  autoDismissMs = 4000,
  bottomOffset,
}: Props) {
  const { theme } = useTheme();
  const s = useMemo(() => getStyles(theme), [theme]);
  const reducedMotion = useReducedMotion();
  const progress = useSharedValue(0);
  const [mounted, setMounted] = useState(visible);
  const unmountTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (visible) {
      if (unmountTimer.current) { clearTimeout(unmountTimer.current); unmountTimer.current = null; }
      setMounted(true);
    }
    progress.value = withTiming(visible ? 1 : 0, { duration: reducedMotion ? 0 : ANIM_DURATION_MS });
    if (!visible && mounted) {
      unmountTimer.current = setTimeout(() => setMounted(false), ANIM_DURATION_MS + 50);
    }
  }, [visible, reducedMotion, mounted, progress]);

  useEffect(() => {
    return () => { if (unmountTimer.current) clearTimeout(unmountTimer.current); };
  }, []);

  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(onDismiss, autoDismissMs);
    return () => clearTimeout(t);
  }, [visible, autoDismissMs, onDismiss]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * 24 }],
  }));

  if (!mounted) return null;

  return (
    <Animated.View
      style={[s.banner, { bottom: bottomOffset }, animatedStyle]}
      pointerEvents={visible ? 'auto' : 'none'}
      accessible
      accessibilityRole="alert"
      accessibilityLabel={`${label} ${actionLabel}`}
    >
      <Ionicons name="mic-outline" size={16} color={theme.colors.deal} />
      <Text style={s.label} numberOfLines={1} maxFontSizeMultiplier={1.3}>{label}</Text>
      <Pressable onPress={onPress} hitSlop={8} style={s.actionBtn} accessibilityRole="button" accessibilityLabel={actionLabel}>
        <Text style={s.action} allowFontScaling={false}>{actionLabel}</Text>
      </Pressable>
    </Animated.View>
  );
}

function getStyles(t: Theme) {
  return {
    banner: {
      position: 'absolute' as const,
      left: 12,
      right: 12,
      zIndex: 30,
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: t.spacing.sm,
      backgroundColor: t.colors.surface,
      borderRadius: t.radius.base,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border,
      paddingHorizontal: t.spacing.md,
      minHeight: 48,
      paddingVertical: t.spacing.sm,
      ...t.shadow.elevated,
    },
    label: {
      flex: 1,
      fontFamily: 'Inter_400Regular',
      fontSize: 13,
      color: t.colors.text,
    },
    action: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 13,
      color: t.colors.primary,
    },
    actionBtn: {
      paddingVertical: 12,
      paddingHorizontal: 4,
    },
  } as const;
}
