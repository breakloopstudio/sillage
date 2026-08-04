import { useEffect, useMemo, useCallback, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedReaction,
  useReducedMotion,
  withSpring,
  withTiming,
  withSequence,
  interpolate,
  Extrapolation,
  runOnJS,
} from 'react-native-reanimated';
import Ionicons from '@react-native-vector-icons/ionicons/static';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import i18next from 'i18next';
import { useTheme, type Theme } from '../../theme/ThemeContext';
import { textOn } from '../../utils/contrast';
import { alpha, tintLuminous } from '../../utils/alpha';
import { hapticsLight } from '../../services/haptics';
import { useNavigationChrome } from './NavigationChromeContext';

export interface BottomTabBarProps {
  state: { index: number; routes: Array<{ key: string; name: string }> };
  navigation: { navigate: (name: string) => void };
}

const FAB_SPACE = 64;
const FAB_SIZE = 56;
const FAB_INNER = 30;
const ICON_SIZE = 20;

const BAR_H_EXPANDED = 64;
const BAR_H_COMPACT = 50;
const LABEL_H = 12;
const LABEL_GAP = 4;

const PILL_W = 46;
const PILL_H = 30;
const HALO_OUTER = 44;
const HALO_INNER = 26;

const FAB_EMERGE = (FAB_SIZE - BAR_H_COMPACT) / 2;

const TAB_CONTENT_H_EXPANDED = ICON_SIZE + LABEL_GAP + LABEL_H;
const ICON_CENTER_EXPANDED = (BAR_H_EXPANDED - TAB_CONTENT_H_EXPANDED) / 2 + ICON_SIZE / 2;
const ICON_CENTER_COMPACT = BAR_H_COMPACT / 2;

const RIM_SHADE = [
  'rgba(255,255,255,0.32)',
  'rgba(255,255,255,0.08)',
  'rgba(255,255,255,0)',
  'rgba(0,0,0,0)',
  'rgba(0,0,0,0.24)',
] as const;
const LENS_SHADE = [
  'rgba(0,0,0,0.30)',
  'rgba(0,0,0,0.06)',
  'rgba(255,255,255,0.14)',
] as const;

export function getTabCenter(screenWidth: number, tabVisualIndex: number): number {
  const barW = Math.min(screenWidth * 0.88, 380);
  const tabW = (barW - FAB_SPACE) / 4;
  if (tabVisualIndex < 2) return (tabVisualIndex + 0.5) * tabW;
  return 2 * tabW + FAB_SPACE + (tabVisualIndex - 2 + 0.5) * tabW;
}

// Labels d'onglets résolus à l'affichage via getters i18next (§23).
const TAB_MAP = {
  index:      { iconActive: 'book',  iconInactive: 'book-outline',  get label() { return i18next.t('tabs.catalog'); } },
  favoris:    { iconActive: 'heart', iconInactive: 'heart-outline', get label() { return i18next.t('tabs.favorites'); } },
  collection: { iconActive: 'flask', iconInactive: 'flask-outline', get label() { return i18next.t('tabs.perfumerie'); } },
  communaute: { iconActive: 'people', iconInactive: 'people-outline', get label() { return i18next.t('tabs.community'); } },
} as const;

export default function DockBar({ state, navigation }: BottomTabBarProps) {
  const { theme, resolvedMode } = useTheme();
  const m = useMemo(() => getStyles(theme), [theme]);
  const haloColors = useMemo(
    () => ({
      outer: tintLuminous(theme.colors.primary, 'hint', resolvedMode),
      inner: tintLuminous(theme.colors.primary, 'veil', resolvedMode),
    }),
    [theme.colors.primary, resolvedMode],
  );
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { dockTranslateY, dockCompact } = useNavigationChrome();
  const { width: windowWidth } = useWindowDimensions();
  const reduceMotion = useReducedMotion();

  const [isDockHidden, setIsDockHidden] = useState(false);
  useAnimatedReaction(
    () => dockTranslateY.value > 60,
    (hidden) => { runOnJS(setIsDockHidden)(hidden); },
  );

  const fabScale = useSharedValue(1);
  const indicatorCenter = useSharedValue(
    getTabCenter(windowWidth, Math.min(state.index, 3)),
  );
  const indicatorStretch = useSharedValue(1);
  const prevIndexRef = useRef(state.index);

  useEffect(() => {
    const idx = Math.min(state.index, 3);
    const center = getTabCenter(windowWidth, idx);
    indicatorCenter.value = reduceMotion
      ? center
      : withSpring(center, { damping: 22, stiffness: 280, mass: 0.7 });
    if (!reduceMotion && prevIndexRef.current !== state.index) {
      indicatorStretch.value = withSequence(
        withSpring(1.25, { damping: 11, stiffness: 200 }),
        withSpring(1, { damping: 13, stiffness: 170 }),
      );
    }
    prevIndexRef.current = state.index;
  }, [state.index, windowWidth, reduceMotion]);

  const dockStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: dockTranslateY.value }],
  }));

  const barHeightStyle = useAnimatedStyle(() => ({
    height: interpolate(dockCompact.value, [0, 1], [BAR_H_EXPANDED, BAR_H_COMPACT]),
  }));

  const labelWrapStyle = useAnimatedStyle(() => {
    const c = dockCompact.value;
    return {
      opacity: interpolate(c, [0, 0.6], [1, 0], Extrapolation.CLAMP),
      height: interpolate(c, [0, 1], [LABEL_H, 0], Extrapolation.CLAMP),
      marginTop: interpolate(c, [0, 1], [LABEL_GAP, 0], Extrapolation.CLAMP),
    };
  });

  const pillStyle = useAnimatedStyle(() => {
    const c = dockCompact.value;
    const sx = indicatorStretch.value;
    const ic = interpolate(c, [0, 1], [ICON_CENTER_EXPANDED, ICON_CENTER_COMPACT]);
    return {
      opacity: interpolate(c, [0, 0.5], [1, 0], Extrapolation.CLAMP),
      top: ic - PILL_H / 2,
      transform: [
        { translateX: indicatorCenter.value - (PILL_W * sx) / 2 },
        { scaleX: sx },
      ],
    };
  });

  const haloStyle = useAnimatedStyle(() => {
    const c = dockCompact.value;
    const sx = indicatorStretch.value;
    const ic = interpolate(c, [0, 1], [ICON_CENTER_EXPANDED, ICON_CENTER_COMPACT]);
    return {
      opacity: interpolate(c, [0.4, 1], [0, 1], Extrapolation.CLAMP),
      top: ic - HALO_OUTER / 2,
      transform: [
        { translateX: indicatorCenter.value - (HALO_OUTER * sx) / 2 },
        { scaleX: sx },
      ],
    };
  });

  const fabStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(dockCompact.value, [0, 1], [0, -FAB_EMERGE]) },
      { scale: fabScale.value },
    ],
  }));

  const handleFabPress = useCallback(() => {
    router.push('/scan');
  }, [router]);

  const handleFabIn = useCallback(() => {
    fabScale.value = reduceMotion ? 0.94 : withSpring(0.9, { damping: 15, stiffness: 320 });
  }, [reduceMotion]);

  const handleFabOut = useCallback(() => {
    fabScale.value = reduceMotion
      ? withTiming(1, { duration: 0 })
      : withSpring(1, { damping: 11, stiffness: 260 });
  }, [reduceMotion]);

  const handleTabPress = useCallback((routeName: string) => {
    hapticsLight();
    navigation.navigate(routeName);
  }, [navigation]);

  const renderTab = (routeKey: string, routeName: string, index: number) => {
    const cfg = TAB_MAP[routeName as keyof typeof TAB_MAP];
    if (!cfg) return null;
    const isActive = state.index === index;

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
          size={ICON_SIZE}
          color={isActive ? theme.colors.primary : theme.colors.textMuted}
        />
        <Animated.View style={[s.labelWrap, labelWrapStyle]}>
          <Text style={[m.label, isActive && m.labelOn]} allowFontScaling={false}>{cfg.label}</Text>
        </Animated.View>
      </Pressable>
    );
  };

  return (
    <Animated.View style={[s.wrapper, { paddingBottom: 8 + insets.bottom }, dockStyle]} pointerEvents={isDockHidden ? 'none' : 'box-none'}>
      <Animated.View style={[s.bar, m.border, m.barShadow, barHeightStyle]}>
        <BlurView
          intensity={24}
          tint={resolvedMode === 'dark' ? 'dark' : 'light'}
          style={s.blur}
        />
        <View style={[s.overlay, m.overlay]} />

        <Animated.View
          style={[s.pill, m.pill, pillStyle]}
          pointerEvents="none"
          accessible={false}
        />
        <Animated.View
          style={[s.halo, haloStyle]}
          pointerEvents="none"
          accessible={false}
        >
          <View style={[s.haloOuter, { backgroundColor: haloColors.outer }]} />
          <View style={[s.haloInner, { backgroundColor: haloColors.inner }]} />
        </Animated.View>

        {state.routes[0] && renderTab(state.routes[0].key, state.routes[0].name, 0)}
        {state.routes[1] && renderTab(state.routes[1].key, state.routes[1].name, 1)}

        <View style={s.fabSlot}>
          <Animated.View style={[s.fabOuter, m.fabShadow, m.fabRing, fabStyle]}>
            <Pressable
              style={[s.fab, m.fabRing]}
              onPressIn={handleFabIn}
              onPressOut={handleFabOut}
              onPress={handleFabPress}
              accessibilityRole="button"
              accessibilityLabel={i18next.t('scan.scanFabA11y')}
            >
              <LinearGradient style={s.fabShade} colors={RIM_SHADE} />
              <View style={[s.fabInner, m.fabRing]}>
                <LinearGradient style={s.fabInnerShade} colors={LENS_SHADE} />
                <Ionicons name="camera" size={22} color={textOn(theme.colors.primary)} />
              </View>
            </Pressable>
          </Animated.View>
        </View>

        {state.routes[2] && renderTab(state.routes[2].key, state.routes[2].name, 2)}
        {state.routes[3] && renderTab(state.routes[3].key, state.routes[3].name, 3)}
      </Animated.View>
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
    width: '88%',
    maxWidth: 380,
    borderRadius: 24,
  },
  blur: {
    ...StyleSheet.absoluteFill,
    borderRadius: 24,
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    borderRadius: 24,
  },
  pill: {
    position: 'absolute',
    left: 0,
    width: PILL_W,
    height: PILL_H,
    borderRadius: PILL_H / 2,
    zIndex: 1,
  },
  halo: {
    position: 'absolute',
    left: 0,
    width: HALO_OUTER,
    height: HALO_OUTER,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  haloOuter: {
    ...StyleSheet.absoluteFill,
    borderRadius: HALO_OUTER / 2,
  },
  haloInner: {
    width: HALO_INNER,
    height: HALO_INNER,
    borderRadius: HALO_INNER / 2,
  },
  tab: {
    flex: 1,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  labelWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  fabSlot: {
    flex: 0,
    width: FAB_SPACE,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    zIndex: 3,
  },
  fabOuter: {
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fab: {
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fabShade: {
    ...StyleSheet.absoluteFill,
    borderRadius: FAB_SIZE / 2,
  },
  fabInner: {
    width: FAB_INNER,
    height: FAB_INNER,
    borderRadius: FAB_INNER / 2,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fabInnerShade: {
    ...StyleSheet.absoluteFill,
    borderRadius: FAB_INNER / 2,
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
      backgroundColor: alpha(t.colors.background, 0.88),
    },
    pill: { backgroundColor: t.colors.primarySoft },
    label: { fontFamily: 'Inter_500Medium', fontSize: 10, lineHeight: 12, color: t.colors.textMuted },
    labelOn: { color: t.colors.primary },
    fabRing: { backgroundColor: t.colors.primary },
    fabShadow: { ...t.shadow.scanCircle },
  } as const;
}
