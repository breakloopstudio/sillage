import { useEffect, useMemo, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { BlurView } from 'expo-blur';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useReducedMotion,
  withRepeat,
  withTiming,
  withSpring,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';
import Ionicons from '@react-native-vector-icons/ionicons/static';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, type Theme } from '../../theme/ThemeContext';
import { textOn } from '../../utils/contrast';
import { hapticsLight } from '../../services/haptics';
import { useAuthContext } from '../../contexts/AuthContext';
import { useNavigationChrome } from './NavigationChromeContext';

export interface BottomTabBarProps {
  state: { index: number; routes: Array<{ key: string; name: string }> };
  navigation: { navigate: (name: string) => void };
}

const FAB_SPACE = 64;
const INDICATOR_W = 28;
const PULSE_MIN = 1;
const PULSE_MAX = 1.18;

export function getIndicatorLeft(screenWidth: number, tabVisualIndex: number): number {
  const barW = Math.min(screenWidth * 0.88, 380);
  const tabArea = barW - FAB_SPACE;
  const tabW = tabArea / 4;
  const fabOffset = tabVisualIndex >= 2 ? FAB_SPACE : 0;
  return tabW * tabVisualIndex + tabW / 2 - INDICATOR_W / 2 + fabOffset;
}

const TAB_MAP = {
  index:       { iconActive: 'book',   iconInactive: 'book-outline',   label: 'Catalogue' },
  selection:   { iconActive: 'bookmark', iconInactive: 'bookmark-outline', label: 'Sélection' },
  collection:  { iconActive: 'flask',  iconInactive: 'flask-outline',  label: 'Parfumerie' },
  profile:     { iconActive: 'person', iconInactive: 'person-outline', label: 'Profil' },
} as const;

export default function DockBar({ state, navigation }: BottomTabBarProps) {
  const { theme, resolvedMode } = useTheme();
  const m = useMemo(() => getStyles(theme), [theme]);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuthContext();
  const { dockTranslateY } = useNavigationChrome();
  const { width: windowWidth } = useWindowDimensions();
  const reduceMotion = useReducedMotion();

  const pulseScale = useSharedValue(PULSE_MIN);
  const indicatorLeft = useSharedValue(
    getIndicatorLeft(windowWidth, Math.min(state.index, 3)),
  );

  useEffect(() => {
    if (reduceMotion) return;
    pulseScale.value = withRepeat(
      withTiming(PULSE_MAX, { duration: 2500, easing: Easing.out(Easing.ease) }),
      -1,
      true,
    );
    return () => cancelAnimation(pulseScale);
  }, [reduceMotion]);

  useEffect(() => {
    indicatorLeft.value = reduceMotion
      ? getIndicatorLeft(windowWidth, Math.min(state.index, 3))
      : withSpring(
          getIndicatorLeft(windowWidth, Math.min(state.index, 3)),
          { damping: 22, stiffness: 280, mass: 0.7 },
        );
  }, [state.index, windowWidth, reduceMotion]);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicatorLeft.value }],
  }));

  const dockStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: dockTranslateY.value }],
  }));

  const pulseRingStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
    opacity: reduceMotion ? 0 : 2 - pulseScale.value,
  }));

  const handleFabPress = useCallback(() => {
    router.push('/scan');
  }, [router]);

  const handleTabPress = useCallback((routeName: string) => {
    hapticsLight();
    navigation.navigate(routeName);
  }, [navigation]);

  const renderTab = (routeKey: string, routeName: string, index: number) => {
    const cfg = TAB_MAP[routeName as keyof typeof TAB_MAP];
    if (!cfg) return null;
    const isActive = state.index === index;

    if (routeName === 'profile' && user?.photoURL) {
      return (
        <Pressable
          key={routeKey}
          style={s.tab}
          onPress={() => handleTabPress(routeName)}
          accessibilityRole="tab"
          accessibilityState={{ selected: isActive }}
          accessibilityLabel={cfg.label}
        >
          <Image
            source={{ uri: user.photoURL }}
            style={[s.avatarIcon, isActive && m.avatarActive]}
          />
          <Text style={[m.label, isActive && m.labelOn]} allowFontScaling={false}>{cfg.label}</Text>
        </Pressable>
      );
    }

    return (
      <Pressable
        key={routeKey}
        style={s.tab}
        onPress={() => handleTabPress(routeName)}
        accessibilityRole="tab"
        accessibilityState={{ selected: isActive }}
        accessibilityLabel={cfg.label}
      >
        <Ionicons
          name={isActive ? cfg.iconActive : cfg.iconInactive}
          size={20}
          color={isActive ? theme.colors.primary : theme.colors.textMuted}
        />
        <Text style={[m.label, isActive && m.labelOn]} allowFontScaling={false}>{cfg.label}</Text>
      </Pressable>
    );
  };

  return (
    <Animated.View style={[s.wrapper, { paddingBottom: 8 + insets.bottom }, dockStyle]} pointerEvents="box-none">
      <View style={[s.bar, m.border, m.barShadow]}>
        <BlurView
          intensity={24}
          tint={resolvedMode === 'dark' ? 'dark' : 'light'}
          style={s.blur}
        />
        <View style={[s.overlay, m.overlay]} />
        <Animated.View style={[s.indicator, m.indicator, { left: 0 }, indicatorStyle]} />

        {state.routes[0] && renderTab(state.routes[0].key, state.routes[0].name, 0)}
        {state.routes[1] && renderTab(state.routes[1].key, state.routes[1].name, 1)}

        <View style={s.fabSlot}>
          <View style={s.fabOuter}>
            {!reduceMotion && (
              <Animated.View style={[s.pulseRing, m.pulseRing, pulseRingStyle]} />
            )}
            <Pressable
              style={[s.fab, m.fab, m.fabShadow]}
              onPress={handleFabPress}
              accessibilityRole="button"
              accessibilityLabel="Scanner un parfum"
            >
              <Ionicons name="camera" size={24} color={textOn(theme.colors.primary)} />
            </Pressable>
          </View>
        </View>

        {state.routes[2] && renderTab(state.routes[2].key, state.routes[2].name, 2)}
        {state.routes[3] && renderTab(state.routes[3].key, state.routes[3].name, 3)}
      </View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 64,
    width: '88%',
    maxWidth: 380,
    borderRadius: 24,
    overflow: 'hidden',
  },
  blur: {
    ...StyleSheet.absoluteFill,
    borderRadius: 24,
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    borderRadius: 24,
  },
  indicator: {
    position: 'absolute',
    top: 6,
    width: INDICATOR_W,
    height: 3,
    borderRadius: 2,
    zIndex: 2,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingTop: 6,
    zIndex: 2,
  },
  avatarIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  fabSlot: {
    flex: 0,
    width: FAB_SPACE,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    zIndex: 2,
  },
  fabOuter: {
    width: 56,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 3,
  },
  pulseRing: {
    position: 'absolute',
    inset: -4,
    borderRadius: 32,
    borderWidth: 1.5,
  },
});

function getStyles(t: Theme) {
  return {
    barShadow: { ...t.shadow.elevated },
    border: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border,
    },
    overlay: {
      backgroundColor: t.colors.background + 'E0',
    },
    indicator: { backgroundColor: t.colors.secondary },
    label: { fontFamily: 'Inter_500Medium', fontSize: 10, color: t.colors.textMuted },
    labelOn: { color: t.colors.primary },
    avatarActive: { borderColor: t.colors.primary, borderWidth: 2 },
    fab: { backgroundColor: t.colors.primary },
    fabShadow: { ...t.shadow.scanCircle },
    pulseRing: { borderColor: t.colors.primary + '4D' },
  } as const;
}
