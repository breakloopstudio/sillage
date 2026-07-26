import { useCallback, useEffect, useMemo } from 'react';
import { View, Text, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withRepeat,
  withSequence,
  cancelAnimation,
  Easing,
  interpolate,
} from 'react-native-reanimated';
import {
  shade,
  alpha,
  layerDuration,
  type LayerKey,
} from './geometry';

interface LayerDef {
  key: LayerKey;
  label: string;
  notes: string[];
  color: string;
  soft: string;
  ink: string;
}

interface Props {
  layers: [LayerDef, LayerDef, LayerDef];
  active: LayerKey | null;
  onSelect: (key: LayerKey) => void;
  resolvedMode: 'light' | 'dark';
  borderColor: string;
  textMuted: string;
}

const BAND_WIDTHS = [0.45, 0.7, 0.95];
const BAND_HEIGHT = 52;
const BAND_GAP = 4;
const LABEL_W = 68;
const TIME_W = 72;

export default function PyramidStage({ layers, active, onSelect, resolvedMode, borderColor, textMuted }: Props) {
  const { width: screenW } = useWindowDimensions();

  const stageW = useMemo(() => Math.min(250, screenW - 200), [screenW]);

  const emph0 = useSharedValue(0);
  const emph1 = useSharedValue(0);
  const emph2 = useSharedValue(0);
  const emph = [emph0, emph1, emph2];

  const glowO = useSharedValue(0);

  const entry0 = useSharedValue(0);
  const entry1 = useSharedValue(0);
  const entry2 = useSharedValue(0);
  const entry = [entry0, entry1, entry2];

  const particleY = useSharedValue(0);
  const totalH = BAND_HEIGHT * 3 + BAND_GAP * 2;

  useEffect(() => {
    const keys: LayerKey[] = ['top', 'heart', 'base'];
    for (let k = 0; k < 3; k++) {
      emph[k].value = withTiming(active === keys[k] ? 1 : active === null ? 0 : -1, { duration: 250 });
      if (active !== keys[k]) continue;
      const peak = resolvedMode === 'light' ? 0.45 : 0.18;
      const stable = resolvedMode === 'light' ? 0.4 : 0.14;
      const breathLow = resolvedMode === 'light' ? 0.25 : 0.10;
      glowO.value = withSequence(
        withTiming(breathLow, { duration: 0 }),
        withTiming(peak, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
        withTiming(breathLow, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
        withTiming(peak, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
        withTiming(stable, { duration: 300 }),
      );
    }
    if (active === null) {
      glowO.value = withTiming(0, { duration: 200 });
    }
  }, [active]);

  useEffect(() => {
    for (let k = 0; k < 3; k++) {
      entry[k].value = withDelay(k * 120, withTiming(1, { duration: 350 }));
    }
    const particleTimer = setTimeout(() => {
      particleY.value = withRepeat(
        withTiming(totalH, { duration: 5500, easing: Easing.inOut(Easing.quad) }),
        -1,
        false,
      );
    }, 600);
    return () => {
      clearTimeout(particleTimer);
      cancelAnimation(particleY);
      for (let k = 0; k < 3; k++) cancelAnimation(entry[k]);
      cancelAnimation(glowO);
    };
  }, [totalH]);

  const bandStyles = [
    useAnimatedStyle(() => ({
      opacity: entry0.value * interpolate(emph0.value, [-1, 0, 1], [0.35, 0.92, 1]),
      transform: [{ scale: interpolate(emph0.value, [0, 1], [1, 1.03]) }],
    })),
    useAnimatedStyle(() => ({
      opacity: entry1.value * interpolate(emph1.value, [-1, 0, 1], [0.35, 0.92, 1]),
      transform: [{ scale: interpolate(emph1.value, [0, 1], [1, 1.03]) }],
    })),
    useAnimatedStyle(() => ({
      opacity: entry2.value * interpolate(emph2.value, [-1, 0, 1], [0.35, 0.92, 1]),
      transform: [{ scale: interpolate(emph2.value, [0, 1], [1, 1.03]) }],
    })),
  ];

  const haloStyles = [
    useAnimatedStyle(() => ({ opacity: emph0.value === 1 ? glowO.value : 0 })),
    useAnimatedStyle(() => ({ opacity: emph1.value === 1 ? glowO.value : 0 })),
    useAnimatedStyle(() => ({ opacity: emph2.value === 1 ? glowO.value : 0 })),
  ];

  const particleStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: particleY.value }],
    opacity: interpolate(particleY.value, [0, totalH * 0.15, totalH * 0.85, totalH], [0, 0.55, 0.55, 0]),
  }));

  const handleSelect = useCallback((key: LayerKey) => onSelect(key), [onSelect]);

  return (
    <View style={sRoot}>
      {layers.map((layer, k) => {
        const bandW = stageW * BAND_WIDTHS[k];
        const isActive = active === layer.key;
        const colorEnd = shade(layer.color, resolvedMode === 'light' ? -0.12 : 0.08);
        return (
          <Pressable
            key={layer.key}
            onPress={() => handleSelect(layer.key)}
            accessibilityRole="button"
            accessibilityLabel={`Notes de ${layer.label.toLowerCase()}, ${layer.notes.length} notes`}
            accessibilityState={{ selected: isActive }}
            style={{ height: BAND_HEIGHT + BAND_GAP, flexDirection: 'row', alignItems: 'center' }}
          >
            <View style={{ width: LABEL_W, alignItems: 'flex-end', paddingRight: 10 }}>
              <Text
                style={{
                  fontFamily: 'PlayfairDisplay_600SemiBold',
                  fontSize: 16,
                  color: isActive ? layer.ink : textMuted,
                }}
              >
                {layer.label}
              </Text>
              <View
                style={{
                  marginTop: 3,
                  minWidth: 20,
                  height: 20,
                  borderRadius: 10,
                  paddingHorizontal: 6,
                  backgroundColor: layer.soft,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text
                  allowFontScaling={false}
                  style={{ fontFamily: 'Inter_700Bold', fontSize: 11, color: layer.ink }}
                >
                  {layer.notes.length}
                </Text>
              </View>
            </View>

            <View style={{ width: stageW, height: BAND_HEIGHT, justifyContent: 'center', alignItems: 'center' }}>
              <Animated.View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }, haloStyles[k]]}>
                <View
                  style={{
                    width: bandW + 24,
                    height: BAND_HEIGHT + 16,
                    borderRadius: (BAND_HEIGHT + 16) / 2,
                    backgroundColor: alpha(layer.color, resolvedMode === 'light' ? 0.35 : 0.12),
                  }}
                />
              </Animated.View>
              <Animated.View style={[{ width: bandW, height: BAND_HEIGHT, borderRadius: 8, overflow: 'hidden' }, bandStyles[k]]}>
                <LinearGradient
                  colors={[layer.color, colorEnd]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
              </Animated.View>
            </View>

            <View style={{ width: TIME_W, flexDirection: 'row', alignItems: 'center', paddingLeft: 10, gap: 6 }}>
              <View style={{ width: 12, height: StyleSheet.hairlineWidth, backgroundColor: borderColor }} />
              <Text
                allowFontScaling={false}
                style={{ fontFamily: 'Inter_400Regular', fontSize: 10, color: textMuted, fontVariant: ['tabular-nums'] }}
              >
                {layerDuration(layer.key)}
              </Text>
            </View>
          </Pressable>
        );
      })}

      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { alignItems: 'center' }]}>
        <Animated.View
          style={[
            {
              width: 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: '#FFFFFF',
              position: 'absolute',
              top: 0,
            },
            particleStyle,
          ]}
        />
      </View>
    </View>
  );
}

const sRoot = { alignItems: 'center' as const, alignSelf: 'center' as const };
