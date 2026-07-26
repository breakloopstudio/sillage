// src/features/catalog/CollapsingHeader.tsx — Header collapsé avec animation scroll (100% UI thread)

import { useMemo } from 'react';
import { View, Text, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, {
  useAnimatedStyle,
  interpolate,
  Extrapolation,
  type SharedValue,
} from 'react-native-reanimated';
import Ionicons from '@react-native-vector-icons/ionicons/static';
import { useTheme, type Theme } from '../../theme/ThemeContext';

interface Props {
  scrollY: SharedValue<number>;
  brand: string | undefined;
  name: string | undefined;
  rightAction?: { icon: string; onPress: () => void; accessibilityLabel: string };
}

export default function CollapsingHeader({ scrollY, brand, name, rightAction }: Props) {
  const { theme } = useTheme();
  const s = useMemo(() => getStyles(theme), [theme]);
  const router = useRouter();

  const expandedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [20, 40], [1, 0], Extrapolation.CLAMP),
  }));

  const compactStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [20, 40], [0, 1], Extrapolation.CLAMP),
  }));

  if (!brand && !name) return null;

  return (
    <Animated.View style={s.root}>
      <SafeAreaView edges={['top']}>
        <View style={s.inner}>
          <Pressable
            onPress={() => router.back()}
            style={s.backBtn}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Retour"
          >
            <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
          </Pressable>

          <View style={s.textWrap}>
            <Animated.View style={[s.textStack, expandedStyle]}>
              {brand ? (
                <Text style={s.brand} numberOfLines={1}>{brand}</Text>
              ) : null}
              {name ? (
                <Text style={s.name} numberOfLines={2}>{name}</Text>
              ) : null}
            </Animated.View>
            <Animated.View style={[s.textStack, s.textStackCompact, compactStyle]}>
              {brand ? (
                <Text style={s.brandCompact} numberOfLines={1}>{brand}</Text>
              ) : null}
              {name ? (
                <Text style={s.nameCompact} numberOfLines={1}>{name}</Text>
              ) : null}
            </Animated.View>
          </View>

          {rightAction ? (
            <Pressable
              onPress={rightAction.onPress}
              style={s.backBtn}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel={rightAction.accessibilityLabel}
            >
              <Ionicons name={rightAction.icon as never} size={24} color={theme.colors.text} />
            </Pressable>
          ) : (
            <View style={s.backBtn} />
          )}
        </View>
      </SafeAreaView>
    </Animated.View>
  );
}

function getStyles(t: Theme) {
  return {
    root: {
      position: 'absolute' as const,
      top: 0,
      left: 0,
      right: 0,
      zIndex: 10,
      backgroundColor: t.colors.background,
    },
    inner: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      paddingHorizontal: 8,
      paddingBottom: 8,
      paddingTop: 4,
      gap: 8,
      minHeight: 52,
    },
    backBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      justifyContent: 'center' as const,
      alignItems: 'center' as const,
    },
    textWrap: {
      flex: 1,
      justifyContent: 'center' as const,
    },
    textStack: {},
    textStackCompact: {
      position: 'absolute' as const,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      justifyContent: 'center' as const,
    },
    brand: {
      fontSize: 11,
      textTransform: 'uppercase' as const,
      letterSpacing: 1.5,
      color: t.colors.textMuted,
      fontFamily: 'Inter_600SemiBold',
      marginBottom: 2,
    },
    name: {
      fontFamily: 'PlayfairDisplay_700Bold',
      fontSize: 26,
      color: t.colors.text,
      lineHeight: 30,
    },
    nameCompact: {
      fontFamily: 'PlayfairDisplay_700Bold',
      fontSize: 18,
      color: t.colors.text,
      lineHeight: 22,
    },
    brandCompact: {
      fontSize: 10,
      textTransform: 'uppercase' as const,
      letterSpacing: 1,
      color: t.colors.textMuted,
      fontFamily: 'Inter_600SemiBold',
      marginBottom: 1,
    },
  } as const;
}
