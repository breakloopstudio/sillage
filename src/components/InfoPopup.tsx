import { useMemo, useEffect, useState } from 'react';
import { View, Text, Pressable, useWindowDimensions, BackHandler } from 'react-native';
import Ionicons from '@react-native-vector-icons/ionicons/static';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, useReducedMotion, cancelAnimation, runOnJS } from 'react-native-reanimated';
import { useTheme, type Theme } from '../theme/ThemeContext';

interface Props {
  visible: boolean;
  title: string;
  message: string;
  icon?: string;
  onClose: () => void;
}

export default function InfoPopup({ visible, title, message, icon = 'help-circle-outline', onClose }: Props) {
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
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { onClose(); return true; });
    return () => sub.remove();
  }, [visible, onClose]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  const cardWidth = Math.min(300, screenWidth - 64);

  if (!mounted) return null;

  return (
    <View style={s.backdrop}>
      <Pressable
        style={s.backdropTouch}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Fermer"
      />
      <Animated.View style={[s.card, { width: cardWidth }, animStyle]}>
        <Pressable onPress={onClose} style={s.closeBtn} hitSlop={12} accessibilityRole="button" accessibilityLabel="Fermer">
          <Ionicons name="close" size={20} color={theme.colors.textMuted} />
        </Pressable>

        <View style={s.iconCircle}>
          <Ionicons name={icon as never} size={26} color={theme.colors.primaryInk} />
        </View>

        <Text style={s.title}>{title}</Text>

        <Text style={s.message} maxFontSizeMultiplier={1.3}>{message}</Text>
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
      paddingTop: 36,
      paddingBottom: 28,
      alignItems: 'center' as const,
      ...t.shadow.elevated,
    },
    closeBtn: {
      position: 'absolute' as const,
      top: 12,
      right: 12,
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: t.colors.surface2,
      justifyContent: 'center' as const,
      alignItems: 'center' as const,
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
  } as const;
}
