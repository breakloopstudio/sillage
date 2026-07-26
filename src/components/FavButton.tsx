// src/components/FavButton.tsx — Cœur favori auto-contenu (cartes + hero)
// Lit/écrit le FavorisContext, pop spring + haptique, auth gate. Se positionne en absolute top-right.

import { useMemo, useEffect, useRef, useCallback } from 'react';
import { Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
  withSpring,
  Easing,
  useReducedMotion,
} from 'react-native-reanimated';
import Ionicons from '@react-native-vector-icons/ionicons/static';
import { useRouter } from 'expo-router';
import { useTheme, type Theme } from '../theme/ThemeContext';
import { useAuthContext } from '../contexts/AuthContext';
import { useFavorisContext } from '../contexts/FavorisContext';
import { hapticsLight, hapticsSuccess } from '../services/haptics';
import type { Parfum } from '../models';

type Size = 'xs' | 'sm' | 'lg';

interface Props {
  parfum: Parfum;
  size?: Size;
}

const DIMS: Record<Size, { box: number; icon: number; top: number; right: number }> = {
  xs: { box: 26, icon: 13, top: 6, right: 6 },
  sm: { box: 32, icon: 16, top: 8, right: 8 },
  lg: { box: 40, icon: 20, top: 12, right: 12 },
};

export default function FavButton({ parfum, size = 'sm' }: Props) {
  const { theme } = useTheme();
  const s = useMemo(() => getStyles(theme, size), [theme, size]);
  const router = useRouter();
  const { isAuthenticated } = useAuthContext();
  const { favIds, toggleFav } = useFavorisContext();
  const isFav = favIds.has(parfum.id);
  const reduced = useReducedMotion();
  const pop = useSharedValue(1);
  const prevFav = useRef(isFav);

  useEffect(() => {
    if (prevFav.current === isFav) return;
    prevFav.current = isFav;
    if (reduced) return;
    pop.value = withSequence(
      withTiming(1.3, { duration: 110, easing: Easing.out(Easing.ease) }),
      withSpring(1, { damping: 10, stiffness: 500 }),
    );
  }, [isFav, reduced, pop]);

  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));

  const handlePress = useCallback(() => {
    if (!isAuthenticated) { router.push('/auth/login'); return; }
    if (isFav) hapticsLight(); else hapticsSuccess();
    toggleFav(parfum);
  }, [isAuthenticated, isFav, toggleFav, parfum, router]);

  return (
    <Pressable
      onPress={handlePress}
      style={s.btn}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={isFav ? 'Retirer des favoris' : 'Ajouter aux favoris'}
    >
      <Animated.View style={[s.inner, animStyle]}>
        <Ionicons
          name={isFav ? 'heart' : 'heart-outline'}
          size={DIMS[size].icon}
          color={isFav ? theme.colors.favorite : theme.colors.textMuted}
        />
      </Animated.View>
    </Pressable>
  );
}

function getStyles(t: Theme, size: Size) {
  const { box, top, right } = DIMS[size];
  return {
    btn: {
      position: 'absolute' as const,
      top,
      right,
      zIndex: 5,
      width: box,
      height: box,
      borderRadius: box / 2,
      backgroundColor: t.colors.surface,
      justifyContent: 'center' as const,
      alignItems: 'center' as const,
      ...t.shadow.card,
    },
    inner: {
      justifyContent: 'center' as const,
      alignItems: 'center' as const,
    },
  } as const;
}
