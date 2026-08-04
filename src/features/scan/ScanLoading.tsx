// src/features/scan/ScanLoading.tsx — Animation signature : particules + texte poétique

import { useEffect, useState, useRef, useMemo } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Image } from 'expo-image';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withDelay,
  Easing,
  cancelAnimation,
  useReducedMotion,
} from 'react-native-reanimated';
import { useTheme, type Theme } from '../../theme/ThemeContext';

const PARTICLES = 8;
const TEXTS = [
  'Analyse des notes...',
  'Comparaison des prix...',
  'Identification en cours...',
  'Recherche du meilleur deal...',
  'Presque...',
];

function Particle({ index, t }: { index: number; t: Theme }) {
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(0.6);
  const reduced = useReducedMotion();

  const { scale, duration, translateAmount, size, left } = useMemo(() => ({
    scale: 0.6 + (index * 0.07) % 0.4,
    duration: 1000 + (index * 73) % 600,
    translateAmount: -40 - (index * 5) % 30,
    size: 6 + (index * 2) % 8,
    left: 15 + (index * 8) % 70,
  }), [index]);

  useEffect(() => {
    if (reduced) {
      opacity.value = 0;
      return;
    }
    const stagger = index * 120;

    translateY.value = withDelay(
      stagger,
      withRepeat(
        withTiming(translateAmount, { duration, easing: Easing.out(Easing.ease) }),
        -1,
        false,
      ),
    );
    opacity.value = withDelay(
      stagger,
      withRepeat(withTiming(0, { duration, easing: Easing.out(Easing.ease) }), -1, false),
    );

    return () => {
      cancelAnimation(translateY);
      cancelAnimation(opacity);
    };
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }, { scale }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        s.particle,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          left: `${left}%`,
          backgroundColor: t.colors.primary,
        },
        style,
      ]}
    />
  );
}

function HaloRing({ t }: { t: Theme }) {
  const rotation = useSharedValue(0);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced) return;
    rotation.value = withRepeat(
      withTiming(360, { duration: 3000, easing: Easing.linear }),
      -1,
      false,
    );
    return () => cancelAnimation(rotation);
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return (
    <Animated.View style={[s.haloContainer, style]}>
      <View style={[s.haloArc, { borderColor: t.colors.glow }]} />
    </Animated.View>
  );
}

interface Props {
  onCancel?: () => void;
  thumbnail?: string;
}

export function ScanLoading({ onCancel, thumbnail }: Props) {
  const { theme } = useTheme();
  const m = useMemo(() => getStyles(theme), [theme]);
  const [textIndex, setTextIndex] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setTextIndex(prev => (prev + 1) % TEXTS.length);
    }, 800);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const particles = useMemo(() =>
    Array.from({ length: PARTICLES }, (_, i) => (
      <Particle key={i} index={i} t={theme} />
    )),
  [theme]);

  return (
    <View style={m.container}>
      <View style={m.animZone}>
        <HaloRing t={theme} />
        <View style={m.particlesBox}>
          {particles}
        </View>
        <View style={m.centerIcon}>
          {thumbnail ? (
            <Image source={{ uri: thumbnail }} style={m.thumb} contentFit="contain" />
          ) : (
            <View style={[m.iconCircle, { backgroundColor: theme.colors.primarySoft }]}>
              <View style={[m.iconDot, { backgroundColor: theme.colors.primary }]} />
            </View>
          )}
        </View>
      </View>

      <Text style={m.text}>{TEXTS[textIndex]}</Text>

      {onCancel && (
        <Pressable onPress={onCancel} style={m.cancelBtn} hitSlop={12}>
          <Text style={m.cancelText}>Annuler</Text>
        </Pressable>
      )}
    </View>
  );
}

const s = {
  particle: {
    position: 'absolute',
    bottom: '50%',
  },
  haloContainer: {
    position: 'absolute',
    width: 160,
    height: 160,
  },
  haloArc: {
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 2,
    borderStyle: 'solid',
    opacity: 0.6,
  },
} as const;

function getStyles(t: Theme) {
  return {
    container: {
      flex: 1,
      backgroundColor: t.colors.background,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 32,
    },
    animZone: {
      width: 180,
      height: 180,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 40,
    },
    particlesBox: {
      position: 'absolute',
      width: 180,
      height: 180,
      justifyContent: 'center',
      alignItems: 'center',
    },
    centerIcon: {
      width: 60,
      height: 60,
      justifyContent: 'center',
      alignItems: 'center',
    },
    iconCircle: {
      width: 48,
      height: 48,
      borderRadius: 24,
      justifyContent: 'center',
      alignItems: 'center',
    },
    thumb: {
      width: 60,
      height: 60,
      borderRadius: t.radius.base,
      backgroundColor: t.colors.surface2,
    },
    iconDot: {
      width: 12,
      height: 12,
      borderRadius: 6,
    },
    text: {
      fontFamily: 'PlayfairDisplay_600SemiBold',
      fontSize: 18,
      color: t.colors.text,
      textAlign: 'center',
    },
    cancelBtn: {
      marginTop: 32,
      paddingVertical: 12,
      paddingHorizontal: 24,
      borderRadius: t.radius.base,
      borderWidth: 1,
      borderColor: t.colors.border,
    },
    cancelText: {
      fontFamily: 'Inter_500Medium',
      fontSize: 14,
      color: t.colors.textMuted,
    },
  } as const;
}