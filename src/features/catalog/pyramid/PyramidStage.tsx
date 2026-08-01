import { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, LayoutChangeEvent } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
  interpolateColor,
  Extrapolation,
  FadeIn,
  FadeInDown,
  useReducedMotion,
} from 'react-native-reanimated';
import { alpha, layerDuration, PERSIST, type LayerKey } from './geometry';
import NoteCloud from './NoteCloud';

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
  selected: Set<LayerKey>;
  onSelect: (key: LayerKey) => void;
  onNotePress: (note: string, layer: LayerKey) => void;
  resolvedMode: 'light' | 'dark';
  surface2: string;
  borderColor: string;
  textMuted: string;
}

const HEADER_H = 34;
const SEG_GAP = 8;
const SEG_H = 10;
const SEG_CENTER_IN_ROW = HEADER_H + SEG_GAP + SEG_H / 2;
const FIL_X = 9;
const FIL_W = 2;
const RAIL_PAD = 30;
const NODE = 9;
const HALO_OUTER = 28;
const HALO_INNER = 18;
const ROW_GAP = 16;

export default function PyramidStage({
  layers,
  selected,
  onSelect,
  onNotePress,
  resolvedMode,
  surface2,
  borderColor,
  textMuted,
}: Props) {
  const reduced = useReducedMotion();
  const [rowY, setRowY] = useState<(number | null)[]>([null, null, null]);

  const railColor = resolvedMode === 'dark' ? alpha(textMuted, 0.32) : borderColor;

  const handleRowLayout = useCallback((k: number, y: number) => {
    setRowY(prev => {
      if (prev[k] === y) return prev;
      const next = prev.slice();
      next[k] = y;
      return next;
    });
  }, []);

  const y0 = rowY[0];
  const y2 = rowY[2];
  const railReady = y0 !== null && y2 !== null;
  const filTop = (y0 ?? 0) + SEG_CENTER_IN_ROW;
  const filH = railReady ? (y2 as number) - (y0 as number) : 0;

  return (
    <View style={sStage}>
      <View style={[sColumn, { gap: ROW_GAP }]}>
        {layers.map((layer, k) => (
          <StrateRow
            key={layer.key}
            layer={layer}
            index={k}
            isActive={selected.has(layer.key)}
            anyActive={selected.size > 0}
            onSelect={onSelect}
            onNotePress={onNotePress}
            reduced={reduced}
            surface2={surface2}
            railColor={railColor}
            textMuted={textMuted}
            onRowLayout={y => handleRowLayout(k, y)}
          />
        ))}

        <View
          pointerEvents="none"
          style={[
            sFil,
            {
              left: FIL_X,
              width: FIL_W,
              top: filTop,
              height: filH,
              backgroundColor: railColor,
            },
          ]}
        />

        {layers.map((layer, k) =>
          rowY[k] !== null ? (
            <RailNode
              key={`n-${layer.key}`}
              top={(rowY[k] as number) + SEG_CENTER_IN_ROW}
              active={selected.has(layer.key)}
              color={layer.color}
              soft={layer.soft}
              reduced={reduced}
              mode={resolvedMode}
            />
          ) : null,
        )}
      </View>
    </View>
  );
}

interface RowProps {
  layer: LayerDef;
  index: number;
  isActive: boolean;
  anyActive: boolean;
  onSelect: (key: LayerKey) => void;
  onNotePress: (note: string, layer: LayerKey) => void;
  reduced: boolean;
  surface2: string;
  railColor: string;
  textMuted: string;
  onRowLayout: (y: number) => void;
}

function StrateRow({
  layer,
  index,
  isActive,
  anyActive,
  onSelect,
  onNotePress,
  reduced,
  surface2,
  railColor,
  textMuted,
  onRowLayout,
}: RowProps) {
  const emph = useSharedValue(isActive ? 1 : anyActive ? -1 : 0);

  useEffect(() => {
    const target = isActive ? 1 : anyActive ? -1 : 0;
    emph.value = withTiming(target, { duration: reduced ? 0 : 250 });
  }, [isActive, anyActive]);

  const ringColor = alpha(layer.color, 0.55);
  const capColor = alpha(layer.color, 0.4);

  const labelStyle = useAnimatedStyle(() => ({
    fontSize: interpolate(emph.value, [-1, 0, 1], [13, 15, 26], Extrapolation.CLAMP),
    color: interpolateColor(emph.value, [-1, 0, 1], [textMuted, textMuted, layer.ink]),
  }));

  const fillStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      emph.value,
      [-1, 0, 1],
      [layer.soft, layer.soft, layer.color],
    ),
    borderColor: interpolateColor(
      emph.value,
      [-1, 0, 1],
      [capColor, capColor, 'transparent'],
    ),
  }));

  const trackStyle = useAnimatedStyle(() => ({
    borderWidth: interpolate(emph.value, [0, 1], [0, 1.5], Extrapolation.CLAMP),
    borderColor: interpolateColor(
      emph.value,
      [-1, 0, 1],
      ['transparent', 'transparent', ringColor],
    ),
  }));

  const handlePress = useCallback(() => onSelect(layer.key), [onSelect, layer.key]);
  const handleLayout = useCallback(
    (e: LayoutChangeEvent) => onRowLayout(e.nativeEvent.layout.y),
    [onRowLayout],
  );

  return (
    <Animated.View
      entering={FadeIn.delay(reduced ? 0 : index * 90).duration(reduced ? 0 : 350)}
      onLayout={handleLayout}
    >
      <Pressable
        onPress={handlePress}
        accessibilityRole="button"
        accessibilityLabel={`${layer.label}, ${layer.notes.length} notes, ${layerDuration(layer.key)}`}
        accessibilityState={{ selected: isActive }}
        style={sRow}
      >
        <View style={sCore}>
          <View style={sHeaderRow}>
            <Animated.Text numberOfLines={1} style={[sLabel, labelStyle]}>
              {layer.label}
            </Animated.Text>
            <View style={[sCountPill, { backgroundColor: layer.soft }]}>
              <Text allowFontScaling={false} style={[sCountText, { color: layer.ink }]}>
                {layer.notes.length}
              </Text>
            </View>
            <View style={sSpacer} />
            <View style={[sTick, { backgroundColor: railColor }]} />
            <Text
              allowFontScaling={false}
              style={{ fontFamily: 'Inter_400Regular', fontSize: 10, color: textMuted, fontVariant: ['tabular-nums'] }}
            >
              {layerDuration(layer.key)}
            </Text>
          </View>

          <View style={sSegWrap}>
            <Animated.View style={[sTrack, { backgroundColor: surface2 }, trackStyle]}>
              <Animated.View style={[sFill, fillStyle, { width: `${PERSIST[layer.key] * 100}%` }]} />
            </Animated.View>
          </View>
        </View>

        {isActive && (
          <Animated.View entering={FadeInDown.duration(reduced ? 0 : 220)} style={sEmanation}>
            <NoteCloud layer={layer} onNotePress={onNotePress} />
          </Animated.View>
        )}
      </Pressable>
    </Animated.View>
  );
}

interface NodeProps {
  top: number;
  active: boolean;
  color: string;
  soft: string;
  reduced: boolean;
  mode: 'light' | 'dark';
}

function RailNode({ top, active, color, soft, reduced, mode }: NodeProps) {
  const emph = useSharedValue(active ? 1 : 0);

  useEffect(() => {
    emph.value = withTiming(active ? 1 : 0, { duration: reduced ? 0 : 250 });
  }, [active]);

  const dotStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(emph.value, [0, 1], [soft, color]),
    transform: [{ scale: interpolate(emph.value, [0, 1], [1, 1.5]) }],
  }));

  const haloStyle = useAnimatedStyle(() => ({
    opacity: interpolate(emph.value, [0, 1], [0, 1]),
    transform: [{ scale: interpolate(emph.value, [0, 1], [0.6, 1]) }],
  }));

  const outerA = mode === 'light' ? 0.08 : 0.05;
  const innerA = mode === 'light' ? 0.2 : 0.12;

  return (
    <View pointerEvents="none" style={[sNodeWrap, { top: top - HALO_OUTER / 2 }]}>
      <Animated.View style={[sHaloOuter, haloStyle, { backgroundColor: alpha(color, outerA) }]} />
      <Animated.View style={[sHaloInner, haloStyle, { backgroundColor: alpha(color, innerA) }]} />
      <Animated.View style={[sDot, dotStyle]} />
    </View>
  );
}

const sStage = {
  marginTop: 4,
} as const;

const sColumn = {
  position: 'relative' as const,
  paddingLeft: RAIL_PAD,
} as const;

const sRow = {
  minHeight: 44,
} as const;

const sCore = {} as const;

const sHeaderRow = {
  height: HEADER_H,
  flexDirection: 'row' as const,
  alignItems: 'center' as const,
} as const;

const sLabel = {
  fontFamily: 'PlayfairDisplay_600SemiBold',
  lineHeight: 30,
} as const;

const sCountPill = {
  marginLeft: 8,
  minWidth: 18,
  height: 18,
  borderRadius: 9,
  paddingHorizontal: 5,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
} as const;

const sCountText = {
  fontFamily: 'Inter_700Bold',
  fontSize: 10,
} as const;

const sSpacer = { flex: 1 } as const;

const sTick = {
  width: 8,
  height: StyleSheet.hairlineWidth,
  marginRight: 6,
} as const;

const sSegWrap = {
  marginTop: SEG_GAP,
  height: SEG_H,
  flexDirection: 'row' as const,
} as const;

const sTrack = {
  flex: 1,
  height: SEG_H,
  borderRadius: 5,
  overflow: 'hidden' as const,
} as const;

const sFill = {
  height: SEG_H,
  borderRadius: 5,
  borderWidth: 1,
} as const;

const sEmanation = {
  marginTop: 10,
} as const;

const sFil = {
  position: 'absolute' as const,
  borderRadius: 1,
} as const;

const sNodeWrap = {
  position: 'absolute' as const,
  left: FIL_X + FIL_W / 2 - HALO_OUTER / 2,
  width: HALO_OUTER,
  height: HALO_OUTER,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
} as const;

const sHaloOuter = {
  position: 'absolute' as const,
  width: HALO_OUTER,
  height: HALO_OUTER,
  borderRadius: HALO_OUTER / 2,
} as const;

const sHaloInner = {
  position: 'absolute' as const,
  width: HALO_INNER,
  height: HALO_INNER,
  borderRadius: HALO_INNER / 2,
} as const;

const sDot = {
  width: NODE,
  height: NODE,
  borderRadius: NODE / 2,
} as const;
