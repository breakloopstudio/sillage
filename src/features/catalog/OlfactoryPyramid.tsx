import { useState, useCallback, useMemo } from 'react';
import { View, Text, Pressable } from 'react-native';
import Ionicons from '@react-native-vector-icons/ionicons/static';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';
import { useTheme, type Theme } from '../../theme/ThemeContext';
import { hapticsLight } from '../../services/haptics';
import { pickInitialLayer, type LayerKey } from './pyramid/geometry';
import PyramidStage from './pyramid/PyramidStage';
import NoteCloud from './pyramid/NoteCloud';

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
  generalNotes?: string[];
  onNotePress?: (note: string, layer?: LayerKey) => void;
}

export default function OlfactoryPyramid({ topNotes, heartNotes, baseNotes, generalNotes, onNotePress }: Props) {
  const { theme, resolvedMode } = useTheme();
  const c = theme.colors;
  const s = useMemo(() => getStyles(theme), [theme]);

  const [selected, setSelected] = useState<Set<LayerKey>>(() => {
    const initial = pickInitialLayer(topNotes.length, heartNotes.length, baseNotes.length);
    return new Set<LayerKey>([initial]);
  });

  const layers: [LayerDef, LayerDef, LayerDef] = useMemo(
    () => [
      { key: 'top', label: 'Tête', notes: topNotes, color: c.pyramidTop, soft: c.pyramidTopSoft, ink: c.pyramidTopInk },
      { key: 'heart', label: 'Cœur', notes: heartNotes, color: c.pyramidHeart, soft: c.pyramidHeartSoft, ink: c.pyramidHeartInk },
      { key: 'base', label: 'Fond', notes: baseNotes, color: c.pyramidBase, soft: c.pyramidBaseSoft, ink: c.pyramidBaseInk },
    ],
    [topNotes, heartNotes, baseNotes, c],
  );

  const openableKeys = useMemo(
    () => layers.filter(l => l.notes.length > 0).map(l => l.key),
    [layers],
  );

  const allOpen = useMemo(
    () => openableKeys.length > 0 && openableKeys.every(k => selected.has(k)),
    [openableKeys, selected],
  );

  const handleSelect = useCallback((key: LayerKey) => {
    hapticsLight();
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const handleToggleAll = useCallback(() => {
    hapticsLight();
    setSelected(prev => {
      const everyOpen = openableKeys.length > 0 && openableKeys.every(k => prev.has(k));
      return everyOpen ? new Set<LayerKey>() : new Set<LayerKey>(openableKeys);
    });
  }, [openableKeys]);

  const handleNotePress = useCallback(
    (note: string, layer: LayerKey) => onNotePress?.(note, layer),
    [onNotePress],
  );

  const handleGeneralNotePress = useCallback(
    (note: string) => onNotePress?.(note),
    [onNotePress],
  );

  const reduced = useReducedMotion();

  const hasAnyNotes = layers.some(l => l.notes.length > 0);

  if (!hasAnyNotes) {
    const general = (generalNotes ?? [])
      .map(n => (typeof n === 'string' ? n.trim() : ''))
      .filter(n => n.length > 0);
    if (general.length === 0) return null;

    const generalLayer: LayerDef = {
      key: 'base',
      label: 'Notes',
      notes: general,
      color: c.primary,
      soft: c.primarySoft,
      ink: c.primaryInk,
    };

    return (
      <Animated.View style={s.root} entering={FadeIn.duration(reduced ? 0 : 400)}>
        <View style={s.header}>
          <View style={s.headerRow}>
            <View style={s.headerBadge}>
              <Ionicons name="layers-outline" size={14} color={c.primaryInk} />
            </View>
            <Text style={s.title}>Notes</Text>
          </View>
        </View>
        <NoteCloud layer={generalLayer} onNotePress={handleGeneralNotePress} />
      </Animated.View>
    );
  }

  return (
    <Animated.View style={s.root} entering={FadeIn.duration(reduced ? 0 : 400)}>
      <View style={s.header}>
        <View style={s.headerBar}>
          <View style={s.headerRow}>
            <View style={s.headerBadge}>
              <Ionicons name="layers-outline" size={14} color={c.primaryInk} />
            </View>
            <Text style={s.title}>Pyramide olfactive</Text>
          </View>
          <Pressable
            onPress={handleToggleAll}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={allOpen ? 'Tout replier' : 'Tout afficher'}
          >
            <Text style={s.headerAction}>{allOpen ? 'Tout replier' : 'Tout afficher'}</Text>
          </Pressable>
        </View>
      </View>

      <PyramidStage
        layers={layers}
        selected={selected}
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
    headerBar: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const },
    headerRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8 },
    headerAction: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: c.primary },
    headerBadge: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: c.primarySoft,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
    },
    title: { fontFamily: 'PlayfairDisplay_600SemiBold', fontSize: 18, color: c.text },
  } as const;
}
