// src/features/catalog/CollapsingHeader.tsx — Header collapsé avec animation scroll

import { useMemo, useState } from 'react';
import { View, Text, Pressable, LayoutAnimation } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, {
  useAnimatedStyle,
  useAnimatedReaction,
  interpolate,
  Extrapolation,
  runOnJS,
  type SharedValue,
} from 'react-native-reanimated';
import Ionicons from '@react-native-vector-icons/ionicons/static';
import { useTheme, type Theme } from '../../theme/ThemeContext';

function applyLayoutAnimation() {
  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
}

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
  const [compact, setCompact] = useState(false);

  useAnimatedReaction(
    () => scrollY.value > 30,
    (isCompact) => {
      runOnJS(setCompact)(isCompact);
      runOnJS(applyLayoutAnimation)();
    },
    [],
  );

  const brandStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 15], [1, 1], Extrapolation.CLAMP),
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
            {brand ? (
              <Animated.Text style={[compact ? s.brandCompact : s.brand, brandStyle]} numberOfLines={1}>
                {brand}
              </Animated.Text>
            ) : null}
            {name ? (
              <Text
                style={compact ? s.nameCompact : s.name}
                numberOfLines={compact ? 1 : 2}
              >
                {name}
              </Text>
            ) : null}
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
