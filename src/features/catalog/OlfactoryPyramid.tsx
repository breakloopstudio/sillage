import { useState, useCallback, useEffect, useMemo } from 'react';
import { View, Text } from 'react-native';
import Svg, { Defs, RadialGradient, Stop, Ellipse } from 'react-native-svg';
import Ionicons from '@react-native-vector-icons/ionicons/static';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withTiming,
  cancelAnimation,
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';
import { useWindowDimensions } from 'react-native';
import { useTheme, type Theme } from '../../theme/ThemeContext';
import { hapticsLight } from '../../services/haptics';
import { pickInitialLayer, layerAphorism, type LayerKey } from './pyramid/geometry';
import PyramidStage from './pyramid/PyramidStage';
import NoteCloud from './pyramid/NoteCloud';

const AnimatedEllipse = Animated.createAnimatedComponent(Ellipse);

interface LayerDef {
  key: LayerKey;
  label: string;
  notes: string[];
  color: string;
  soft: string;
  ink: string;
}

interface Props {
  topNotes: string[];
  heartNotes: string[];
  baseNotes: string[];
  onNotePress?: (note: string, layer?: LayerKey) => void;
}

export default function OlfactoryPyramid({ topNotes, heartNotes, baseNotes, onNotePress }: Props) {
  const { theme, resolvedMode } = useTheme();
  const c = theme.colors;
  const { width: screenW } = useWindowDimensions();
  const s = useMemo(() => getStyles(theme), [theme]);

  const [active, setActive] = useState<LayerKey | null>(() =>
    pickInitialLayer(topNotes.length, heartNotes.length, baseNotes.length));

  const layers: [LayerDef, LayerDef, LayerDef] = useMemo(
    () => [
      { key: 'top', label: 'Tête', notes: topNotes, color: c.pyramidTop, soft: c.pyramidTopSoft, ink: c.pyramidTopInk },
      { key: 'heart', label: 'Cœur', notes: heartNotes, color: c.pyramidHeart, soft: c.pyramidHeartSoft, ink: c.pyramidHeartInk },
      { key: 'base', label: 'Fond', notes: baseNotes, color: c.pyramidBase, soft: c.pyramidBaseSoft, ink: c.pyramidBaseInk },
    ],
    [topNotes, heartNotes, baseNotes, c],
  );

  const activeLayer = useMemo(() => active ? (layers.find(l => l.key === active) ?? null) : null, [active, layers]);
  const activeInk = activeLayer?.ink ?? c.textMuted;

  const handleSelect = useCallback((key: LayerKey) => {
    hapticsLight();
    setActive(prev => prev === key ? null : key);
  }, []);

  const handleNotePress = useCallback(
    (note: string, layer: LayerKey) => onNotePress?.(note, layer),
    [onNotePress],
  );

  const hasAnyNotes = layers.some(l => l.notes.length > 0);
  if (!hasAnyNotes) return null;

  const dims = useMemo(() => {
    const svgW = Math.min(250, screenW - 200);
    const svgH = Math.round(svgW * 0.92);
    return { svgW, svgH };
  }, [screenW]);

  const veilH = dims.svgH + 120;

  const veilPrevO = useSharedValue(0);
  const veilNextO = useSharedValue(0);
  const [veilColors, setVeilColors] = useState<{ prev: string; next: string }>({
    prev: _layerGradientColor(activeLayer, resolvedMode),
    next: _layerGradientColor(activeLayer, resolvedMode),
  });

  useEffect(() => {
    const nextColor = _layerGradientColor(activeLayer, resolvedMode);
    setVeilColors(prev => ({ prev: prev.next, next: nextColor }));
    const masterO = activeLayer ? (resolvedMode === 'light' ? 0.5 : 0.35) : 0;
    veilPrevO.value = withTiming(0, { duration: 300 });
    veilNextO.value = withTiming(masterO, { duration: 300 });
    return () => {
      cancelAnimation(veilPrevO);
      cancelAnimation(veilNextO);
    };
  }, [activeLayer, resolvedMode]);

  const veilPrevProps = useAnimatedProps(() => ({ opacity: veilPrevO.value }));
  const veilNextProps = useAnimatedProps(() => ({ opacity: veilNextO.value }));

  return (
    <Animated.View style={s.root} entering={FadeIn.duration(400)}>
      <View pointerEvents="none" style={[s.veilWrap, { height: veilH }]}>
        <Svg width={screenW} height={veilH}>
          <Defs>
            <RadialGradient id="veil-prev-grad" cx="50%" cy="50%" rx="50%" ry="50%">
              <Stop offset="0" stopColor={veilColors.prev} stopOpacity={resolvedMode === 'light' ? 0.12 : 0.14} />
              <Stop offset="1" stopColor={veilColors.prev} stopOpacity={0} />
            </RadialGradient>
            <RadialGradient id="veil-next-grad" cx="50%" cy="50%" rx="50%" ry="50%">
              <Stop offset="0" stopColor={veilColors.next} stopOpacity={resolvedMode === 'light' ? 0.12 : 0.14} />
              <Stop offset="1" stopColor={veilColors.next} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <AnimatedEllipse
            cx={screenW / 2}
            cy={dims.svgH * 0.55}
            rx={screenW * 0.7}
            ry={dims.svgH * 0.75}
            fill="url(#veil-prev-grad)"
            animatedProps={veilPrevProps}
          />
          <AnimatedEllipse
            cx={screenW / 2}
            cy={dims.svgH * 0.55}
            rx={screenW * 0.7}
            ry={dims.svgH * 0.75}
            fill="url(#veil-next-grad)"
            animatedProps={veilNextProps}
          />
        </Svg>
      </View>

      <View style={s.header}>
        <View style={s.headerRow}>
          <View style={s.headerBadge}>
            <Ionicons name="layers-outline" size={14} color={c.primary} />
          </View>
          <Text style={s.title}>Pyramide olfactive</Text>
        </View>
        <View style={s.aphorismSlot}>
          <Animated.Text
            key={active ?? 'none'}
            entering={FadeIn.duration(180)}
            exiting={FadeOut.duration(180)}
            style={[s.aphorism, active ? { color: activeInk } : {}]}
          >
            {layerAphorism(active)}
          </Animated.Text>
        </View>
      </View>

      <PyramidStage
        layers={layers}
        active={active}
        onSelect={handleSelect}
        resolvedMode={resolvedMode}
        borderColor={c.border}
        textMuted={c.textMuted}
      />

      <NoteCloud layer={activeLayer ?? null} onNotePress={handleNotePress} />
    </Animated.View>
  );
}

function _layerGradientColor(layer: LayerDef | null, _resolvedMode: 'light' | 'dark'): string {
  return layer ? layer.color : 'transparent';
}

function getStyles(t: Theme) {
  const c = t.colors;
  return {
    root: { marginTop: 24, marginBottom: 4 },
    header: { marginBottom: 18 },
    headerRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8 },
    headerBadge: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: c.primarySoft,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
    },
    title: { fontFamily: 'PlayfairDisplay_600SemiBold', fontSize: 18, color: c.text },
    aphorismSlot: { height: 22, marginTop: 6, marginLeft: 36, justifyContent: 'center' as const },
    aphorism: { fontFamily: 'PlayfairDisplay_700Bold_Italic', fontSize: 15, color: c.textMuted },
    veilWrap: {
      position: 'absolute' as const,
      top: 56,
      left: -16,
      right: -16,
      alignItems: 'center' as const,
      overflow: 'hidden' as const,
    },
  } as const;
}
