import { useState, useCallback, useMemo } from 'react';
import { View, Text } from 'react-native';
import Ionicons from '@react-native-vector-icons/ionicons/static';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useTheme, type Theme } from '../../theme/ThemeContext';
import { hapticsLight } from '../../services/haptics';
import { pickInitialLayer, layerAphorism, type LayerKey } from './pyramid/geometry';
import PyramidStage from './pyramid/PyramidStage';

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

  return (
    <Animated.View style={s.root} entering={FadeIn.duration(400)}>
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
        onNotePress={handleNotePress}
        resolvedMode={resolvedMode}
        surface2={c.surface2}
        borderColor={c.border}
        textMuted={c.textMuted}
      />
    </Animated.View>
  );
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
  } as const;
}
