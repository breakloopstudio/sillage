// src/components/PermissionPrimer.tsx — Popup de pré-permission (just-in-time)
// Explique le bénéfice d'une permission AVANT le prompt système. Même langage
// visuel qu'InfoPopup (popup centré) + CTA primary « Continuer » + ghost
// « Pas maintenant » + ligne de réassurance (retrait du consentement).

import { useMemo, useEffect, useState } from 'react';
import { View, Text, Pressable, useWindowDimensions, BackHandler } from 'react-native';
import Ionicons from '@react-native-vector-icons/ionicons/static';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  useReducedMotion,
  cancelAnimation,
  runOnJS,
} from 'react-native-reanimated';
import { useTheme, type Theme } from '../theme/ThemeContext';
import { hapticsLight } from '../services/haptics';
import { PRIMER_REASSURANCE, type PermissionPrimerCopy } from '../utils/permission-primers';
import Button from './Button';

interface Props {
  visible: boolean;
  copy: PermissionPrimerCopy;
  onAccept: () => void;
  onDecline: () => void;
}

export default function PermissionPrimer({ visible, copy, onAccept, onDecline }: Props) {
  const { theme } = useTheme();
  const s = useMemo(() => getStyles(theme), [theme]);
  const { width: screenWidth } = useWindowDimensions();
  const reduced = useReducedMotion();
  const [mounted, setMounted] = useState(visible);

  const opacity = useSharedValue(0);
  const scale = useSharedValue(1);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      opacity.value = 0;
      scale.value = reduced ? 1 : 0.92;
      opacity.value = withTiming(1, { duration: reduced ? 150 : 250 });
      scale.value = withTiming(1, { duration: reduced ? 150 : 250 });
    } else if (mounted) {
      opacity.value = withTiming(0, { duration: reduced ? 100 : 150 }, (finished) => {
        if (finished) runOnJS(setMounted)(false);
      });
      scale.value = withTiming(reduced ? 1 : 0.92, { duration: reduced ? 100 : 150 });
    }
    return () => {
      cancelAnimation(opacity);
      cancelAnimation(scale);
    };
  }, [visible, reduced]);

  useEffect(() => {
    if (!visible) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { onDecline(); return true; });
    return () => sub.remove();
  }, [visible, onDecline]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  const cardWidth = Math.min(300, screenWidth - 64);

  const handleAccept = () => { hapticsLight(); onAccept(); };
  const handleDecline = () => { hapticsLight(); onDecline(); };

  if (!mounted) return null;

  return (
    <View style={s.backdrop}>
      <Pressable
        style={s.backdropTouch}
        onPress={handleDecline}
        accessibilityRole="button"
        accessibilityLabel="Fermer"
      />
      <Animated.View style={[s.card, { width: cardWidth }, animStyle]}>
        <View style={s.iconCircle}>
          <Ionicons name={copy.icon as never} size={26} color={theme.colors.primaryInk} />
        </View>

        <Text style={s.title}>{copy.title}</Text>

        <Text style={s.message} maxFontSizeMultiplier={1.3}>{copy.message}</Text>

        <View style={s.actions}>
          <Button onPress={handleAccept} style={s.acceptBtn}>{copy.acceptLabel}</Button>
          <Pressable
            onPress={handleDecline}
            style={s.declineBtn}
            hitSlop={{ top: 6, bottom: 6 }}
            accessibilityRole="button"
            accessibilityLabel="Pas maintenant"
          >
            <Text style={s.declineText}>Pas maintenant</Text>
          </Pressable>
        </View>

        <Text style={s.reassurance} maxFontSizeMultiplier={1.3}>{PRIMER_REASSURANCE}</Text>
      </Animated.View>
    </View>
  );
}

function getStyles(t: Theme) {
  return {
    backdrop: {
      position: 'absolute' as const,
      inset: 0,
      zIndex: 100,
      justifyContent: 'center' as const,
      alignItems: 'center' as const,
    },
    backdropTouch: {
      ...({ position: 'absolute' as const, inset: 0, backgroundColor: 'rgba(0,0,0,0.4)' } as const),
    },
    card: {
      backgroundColor: t.colors.surface,
      borderRadius: t.radius.card,
      paddingHorizontal: 24,
      paddingTop: 28,
      paddingBottom: 20,
      alignItems: 'center' as const,
      ...t.shadow.elevated,
    },
    iconCircle: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: t.colors.primarySoft,
      justifyContent: 'center' as const,
      alignItems: 'center' as const,
      marginBottom: 14,
    },
    title: {
      fontFamily: 'PlayfairDisplay_600SemiBold',
      fontSize: 20,
      color: t.colors.text,
      textAlign: 'center' as const,
      marginBottom: 10,
    },
    message: {
      fontFamily: 'Inter_400Regular',
      fontSize: 14,
      lineHeight: 21,
      color: t.colors.textMuted,
      textAlign: 'center' as const,
    },
    actions: {
      alignSelf: 'stretch' as const,
      marginTop: 18,
      gap: 4,
    },
    acceptBtn: {
      alignSelf: 'stretch' as const,
    },
    declineBtn: {
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      paddingVertical: 10,
      minHeight: 44,
    },
    declineText: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 14,
      color: t.colors.textMuted,
    },
    reassurance: {
      fontFamily: 'Inter_400Regular',
      fontSize: 11,
      lineHeight: 16,
      color: t.colors.textMuted,
      textAlign: 'center' as const,
      marginTop: 8,
      opacity: 0.85,
    },
  } as const;
}
