import { useCallback, useEffect, useMemo } from 'react';
import { View, Text, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import Svg, { G, Polygon, Defs, LinearGradient, RadialGradient, Stop, Pattern, Line, Ellipse, Circle } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withTiming,
  withDelay,
  withRepeat,
  withSequence,
  cancelAnimation,
  Easing,
  interpolate,
} from 'react-native-reanimated';
import {
  bandPoly,
  shade,
  layerDuration,
  type LayerKey,
} from './geometry';

const AnimatedPolygon = Animated.createAnimatedComponent(Polygon);
const AnimatedEllipse = Animated.createAnimatedComponent(Ellipse);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedG = Animated.createAnimatedComponent(G);

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

export default function PyramidStage({ layers, active, onSelect, resolvedMode, borderColor, textMuted }: Props) {
  const { width: screenW } = useWindowDimensions();

  const dims = useMemo(() => {
    const svgW = Math.min(250, screenW - 200);
    const svgH = Math.round(svgW * 0.92);
    const bh = svgH / 3;
    const cx = svgW / 2;
    const gap = 3;
    const labelW = 68;
    const timeW = 72;
    const rowH = Math.max(bh, 64);
    return { svgW, svgH, bh, cx, gap, labelW, timeW, rowH };
  }, [screenW]);

  const { svgW, svgH, bh, cx, gap, labelW, timeW, rowH } = dims;

  const bands = useMemo(
    () => layers.map((_, k) => bandPoly(svgW, svgH, k as 0 | 1 | 2, gap)),
    [svgW, svgH, gap, layers],
  );

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

  useEffect(() => {
    const keys: LayerKey[] = ['top', 'heart', 'base'];
    for (let k = 0; k < 3; k++) {
      emph[k].value = active === keys[k] ? 1 : active === null ? 0 : -1;
      if (active !== keys[k]) continue;
      const peak = resolvedMode === 'light' ? 0.45 : 0.18;
      const stable = resolvedMode === 'light' ? 0.4 : 0.14;
      const breathLow = resolvedMode === 'light' ? 0.25 : 0.10;
      glowO.value = withSequence(
        withTiming(breathLow, { duration: 0 }),
        withTiming(peak, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
        withTiming(breathLow, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
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
    particleY.value = withRepeat(
      withTiming(svgH, { duration: 5500, easing: Easing.inOut(Easing.quad) }),
      -1,
      false,
    );
    return () => {
      cancelAnimation(particleY);
      for (let k = 0; k < 3; k++) cancelAnimation(entry[k]);
      cancelAnimation(glowO);
    };
  }, [svgH]);

  const gradProps = [
    useAnimatedProps(() => ({ opacity: entry0.value * interpolate(emph0.value, [-1, 0, 1], [0, 0.92, 1]) })),
    useAnimatedProps(() => ({ opacity: entry1.value * interpolate(emph1.value, [-1, 0, 1], [0, 0.92, 1]) })),
    useAnimatedProps(() => ({ opacity: entry2.value * interpolate(emph2.value, [-1, 0, 1], [0, 0.92, 1]) })),
  ];

  const softProps = [
    useAnimatedProps(() => ({ opacity: entry0.value * interpolate(emph0.value, [-1, 0, 1], [0.4, 0, 0]) })),
    useAnimatedProps(() => ({ opacity: entry1.value * interpolate(emph1.value, [-1, 0, 1], [0.4, 0, 0]) })),
    useAnimatedProps(() => ({ opacity: entry2.value * interpolate(emph2.value, [-1, 0, 1], [0.4, 0, 0]) })),
  ];

  const scalePropsArr = [
    useAnimatedProps(() => {
      const s = interpolate(emph0.value, [0, 1], [1, 1.03]);
      const midY = 0.5 * bh;
      return { transform: `translate(${cx} ${midY}) scale(${s}) translate(${-cx} ${-midY})` };
    }),
    useAnimatedProps(() => {
      const s = interpolate(emph1.value, [0, 1], [1, 1.03]);
      const midY = 1.5 * bh;
      return { transform: `translate(${cx} ${midY}) scale(${s}) translate(${-cx} ${-midY})` };
    }),
    useAnimatedProps(() => {
      const s = interpolate(emph2.value, [0, 1], [1, 1.03]);
      const midY = 2.5 * bh;
      return { transform: `translate(${cx} ${midY}) scale(${s}) translate(${-cx} ${-midY})` };
    }),
  ];

  const haloProps = [
    useAnimatedProps(() => ({ opacity: emph0.value === 1 ? glowO.value : 0 })),
    useAnimatedProps(() => ({ opacity: emph1.value === 1 ? glowO.value : 0 })),
    useAnimatedProps(() => ({ opacity: emph2.value === 1 ? glowO.value : 0 })),
  ];

  const particleProps = useAnimatedProps(() => ({
    cy: particleY.value,
    opacity: interpolate(particleY.value, [0, svgH * 0.15, svgH * 0.85, svgH], [0, 0.55, 0.55, 0]),
  }));

  const handleSelect = useCallback((key: LayerKey) => onSelect(key), [onSelect]);

  return (
    <View style={sRoot}>
      {layers.map((layer, k) => (
        <Pressable
          key={layer.key}
          onPress={() => handleSelect(layer.key)}
          accessibilityRole="button"
          accessibilityLabel={`Notes de ${layer.label.toLowerCase()}, ${layer.notes.length} notes`}
          accessibilityState={{ selected: active === layer.key }}
          style={{ height: rowH, flexDirection: 'row', alignItems: 'center' }}
        >
          <View style={{ width: labelW, alignItems: 'flex-end', paddingRight: 10 }}>
            <Text
              style={{
                fontFamily: 'PlayfairDisplay_600SemiBold',
                fontSize: 16,
                color: active === layer.key ? layer.ink : textMuted,
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

          <View style={{ width: svgW, height: rowH }} />

          <View style={{ width: timeW, flexDirection: 'row', alignItems: 'center', paddingLeft: 10, gap: 6 }}>
            <View style={{ width: 12, height: StyleSheet.hairlineWidth, backgroundColor: borderColor }} />
            <Text
              allowFontScaling={false}
              style={{ fontFamily: 'Inter_400Regular', fontSize: 10, color: textMuted, fontVariant: ['tabular-nums'] }}
            >
              {layerDuration(layer.key)}
            </Text>
          </View>
        </Pressable>
      ))}

      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <Svg width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`} style={{ alignSelf: 'center' }}>
          <Defs>
            {layers.map(l => (
              <LinearGradient key={`grad-${l.key}`} id={`grad-${l.key}`} x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor={l.color} stopOpacity="1" />
                <Stop offset="1" stopColor={shade(l.color, resolvedMode === 'light' ? -0.12 : 0.08)} stopOpacity="1" />
              </LinearGradient>
            ))}
            {layers.map(l => (
              <Pattern key={`hatch-${l.key}`} id={`hatch-${l.key}`} patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
                <Line x1="0" y1="0" x2="0" y2="6" stroke={shade(l.color, -0.4)} strokeWidth="1" opacity="0.08" />
              </Pattern>
            ))}
            {layers.map(l => (
              <RadialGradient key={`halo-${l.key}`} id={`halo-${l.key}`} cx="50%" cy="50%" rx="50%" ry="50%">
                <Stop offset="0" stopColor={l.color} stopOpacity={resolvedMode === 'light' ? 0.35 : 0.12} />
                <Stop offset="1" stopColor={l.color} stopOpacity="0" />
              </RadialGradient>
            ))}
          </Defs>

          {layers.map((l, k) => {
            const band = bands[k];
            const svgPts = band.svg;
            const midY = (k + 0.5) * bh;
            const haloRx = (svgW / 2) * (midY / svgH) * 1.5 + 12;
            const key = layers[k].key;
            const isActive = active === key;
            return (
              <G key={key}>
                {(isActive || emph[k].value > 0) ? (
                  <AnimatedEllipse
                    cx={cx}
                    cy={midY}
                    rx={haloRx}
                    ry={bh * 0.65}
                    fill={`url(#halo-${l.key})`}
                    animatedProps={haloProps[k]}
                  />
                ) : null}
                <AnimatedG animatedProps={scalePropsArr[k]}>
                  <AnimatedPolygon points={svgPts} fill={l.soft} animatedProps={softProps[k]} />
                  <AnimatedPolygon points={svgPts} fill={`url(#grad-${l.key})`} animatedProps={gradProps[k]} />
                  <Polygon points={svgPts} fill={`url(#hatch-${l.key})`} opacity={0.9} />
                </AnimatedG>
              </G>
            );
          })}

          <AnimatedCircle cx={cx} r={3} fill="#FFFFFF" animatedProps={particleProps} />
        </Svg>
      </View>
    </View>
  );
}

const sRoot = { alignItems: 'center' as const, alignSelf: 'center' as const };
