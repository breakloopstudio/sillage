import { useMemo, useEffect } from 'react';
import { View, Text, Pressable, useWindowDimensions } from 'react-native';
import Ionicons from '@react-native-vector-icons/ionicons/static';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, cancelAnimation } from 'react-native-reanimated';
import { useTheme, type Theme } from '../theme/ThemeContext';
import { translateNote } from '../utils/translate-note';
import { getNoteEmoji, getNoteDescription } from '../utils/note-descriptions';
import { alpha, layerDuration, layerContextLabel, type LayerKey } from '../features/catalog/pyramid/geometry';

interface Props {
  visible: boolean;
  noteName: string;
  layer?: LayerKey | null;
  onClose: () => void;
}

export default function NoteDetailPopup({ visible, noteName, layer, onClose }: Props) {
  const { theme } = useTheme();
  const c = theme.colors;
  const s = useMemo(() => getStyles(theme, layer, c), [theme, layer]);
  const { width: screenWidth } = useWindowDimensions();

  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.92);

  useEffect(() => {
    if (!visible) return;
    opacity.value = withTiming(1, { duration: 250 });
    scale.value = withTiming(1, { duration: 250 });
    return () => {
      cancelAnimation(opacity);
      cancelAnimation(scale);
    };
  }, [visible]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  const displayName = translateNote(noteName);
  const emoji = getNoteEmoji(noteName);
  const description = getNoteDescription(noteName);
  const cardWidth = Math.min(300, screenWidth - 64);

  const layerColors = layer ? {
    color: _layerColor(layer, c), soft: _layerSoft(layer, c), ink: _layerInk(layer, c),
  } : null;

  if (!visible) return null;

  return (
    <View style={s.backdrop}>
      <Pressable
        style={s.backdropTouch}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Fermer le détail de la note"
      />
      <Animated.View style={[s.card, { width: cardWidth }, layerColors ? { borderWidth: 1, borderColor: alpha(layerColors.color, 0.24) } : null, animStyle]}>
        <Pressable onPress={onClose} style={s.closeBtn} hitSlop={12}>
          <Ionicons name="close" size={20} color={theme.colors.textMuted} />
        </Pressable>

        <View style={[s.emojiCircle, layerColors ? { backgroundColor: layerColors.soft } : null]}>
          <Text style={s.emojiText}>{emoji}</Text>
        </View>

        <Text style={s.noteName}>{displayName}</Text>

        {layer && layerColors ? (
          <View style={s.contextChip}>
            <View style={[s.contextDot, { backgroundColor: layerColors.color }]} />
            <Text style={[s.contextLabel, { color: layerColors.ink }]}>
              {layerContextLabel(layer)}
            </Text>
          </View>
        ) : null}

        {layer ? (
          <View style={s.durationRow}>
            <Ionicons name="time-outline" size={12} color={c.textMuted} />
            <Text allowFontScaling={false} style={[s.durationText, { color: c.textMuted }]}>
              Perceptible : {layerDuration(layer)}
            </Text>
          </View>
        ) : null}

        <Text style={s.description}>{description}</Text>
      </Animated.View>
    </View>
  );
}

function _layerColor(k: LayerKey, c: Theme['colors']) {
  switch (k) { case 'top': return c.pyramidTop; case 'heart': return c.pyramidHeart; case 'base': return c.pyramidBase; }
}
function _layerSoft(k: LayerKey, c: Theme['colors']) {
  switch (k) { case 'top': return c.pyramidTopSoft; case 'heart': return c.pyramidHeartSoft; case 'base': return c.pyramidBaseSoft; }
}
function _layerInk(k: LayerKey, c: Theme['colors']) {
  switch (k) { case 'top': return c.pyramidTopInk; case 'heart': return c.pyramidHeartInk; case 'base': return c.pyramidBaseInk; }
}

function getStyles(t: Theme, _layer?: LayerKey | null, _c?: Theme['colors']) {
  return {
    backdrop: {
      position: 'absolute' as const,
      inset: 0,
      zIndex: 100,
      justifyContent: 'center' as const,
      alignItems: 'center' as const,
    },
    backdropTouch: {
      ...({ position: 'absolute' as const, inset: 0, backgroundColor: 'rgba(0,0,0,0.4)' } as const),
    },
    card: {
      backgroundColor: t.colors.surface,
      borderRadius: t.radius.card,
      paddingHorizontal: 24,
      paddingTop: 36,
      paddingBottom: 28,
      alignItems: 'center' as const,
      ...t.shadow.card,
    },
    closeBtn: {
      position: 'absolute' as const,
      top: 12,
      right: 12,
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: t.colors.surface2,
      justifyContent: 'center' as const,
      alignItems: 'center' as const,
    },
    emojiCircle: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: t.colors.primarySoft,
      justifyContent: 'center' as const,
      alignItems: 'center' as const,
      marginBottom: 14,
    },
    emojiText: { fontSize: 26 },
    noteName: {
      fontFamily: 'PlayfairDisplay_600SemiBold',
      fontSize: 20,
      color: t.colors.text,
      textAlign: 'center' as const,
      marginBottom: 10,
    },
    contextChip: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: 6,
      marginBottom: 10,
    },
    contextDot: { width: 6, height: 6, borderRadius: 3 },
    contextLabel: { fontFamily: 'Inter_500Medium', fontSize: 11 },
    durationRow: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: 5,
      marginBottom: 12,
    },
    durationText: {
      fontFamily: 'Inter_400Regular',
      fontSize: 12,
      fontVariant: ['tabular-nums'] as import('react-native').FontVariant[],
    },
    description: {
      fontFamily: 'Inter_400Regular',
      fontSize: 14,
      lineHeight: 21,
      color: t.colors.text,
      textAlign: 'center' as const,
    },
  } as const;
}
