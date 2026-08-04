import { useCallback } from 'react';
import { View, Text, Pressable } from 'react-native';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { type Theme } from '../../../theme/ThemeContext';
import { translateNote } from '../../../utils/translate-note';
import { getNoteEmoji } from '../../../utils/note-descriptions';
import { hapticsLight } from '../../../services/haptics';
import { alpha, type LayerKey } from './geometry';

interface LayerDef {
  key: LayerKey;
  label: string;
  notes: string[];
  color: string;
  soft: string;
  ink: string;
}

interface Props {
  layer: LayerDef | null;
  onNotePress: (note: string, layer: LayerKey) => void;
}

export default function NoteCloud({ layer, onNotePress }: Props) {
  const { t } = useTranslation('common');
  const handlePress = useCallback(
    (note: string) => {
      hapticsLight();
      if (layer) onNotePress(note, layer.key);
    },
    [layer, onNotePress],
  );

  const reduced = useReducedMotion();

  if (layer === null) return null;

  if (layer.notes.length === 0) {
    return (
      <View style={sEmpty}>
        <Text style={[sEmptyText, { color: layer.ink }]}>
          {t('pyramid.noNotes', { label: layer.label.toLowerCase() })}
        </Text>
      </View>
    );
  }

  return (
    <View style={sCloud}>
      {layer.notes.map((note, i) => (
        <Animated.View
          key={`${layer.key}-${i}`}
          entering={reduced ? undefined : FadeInDown.delay(Math.min(i, 8) * 35).duration(200)}
        >
          <Pressable
            onPress={() => handlePress(note)}
            hitSlop={{ top: 7, bottom: 7 }}
            accessibilityRole="button"
            accessibilityLabel={t('pyramid.noteA11y', { note: translateNote(note) })}
            style={({ pressed }) => [
              sPetal,
              {
                backgroundColor: layer.soft,
                borderColor: alpha(layer.color, 0.24),
                ...(pressed && { transform: [{ scale: 0.95 }], opacity: 0.8 }),
              } as const,
            ]}
          >
            <Text style={{ fontSize: 13 }}>{getNoteEmoji(note)}</Text>
            <Text maxFontSizeMultiplier={1.3} style={[sPetalText, { color: layer.ink }]}>
              {translateNote(note)}
            </Text>
          </Pressable>
        </Animated.View>
      ))}
    </View>
  );
}

const sCloud = {
  flexDirection: 'row' as const,
  flexWrap: 'wrap' as const,
  gap: 8,
  justifyContent: 'flex-start' as const,
};

const sPetal = {
  flexDirection: 'row' as const,
  alignItems: 'center' as const,
  gap: 6,
  paddingHorizontal: 12,
  paddingVertical: 8,
  borderRadius: 20,
  borderWidth: 1,
};

const sPetalText = {
  fontFamily: 'Inter_500Medium',
  fontSize: 13,
};

const sEmpty = {
  alignItems: 'flex-start' as const,
};

const sEmptyText = {
  fontFamily: 'Inter_400Regular',
  fontSize: 13,
};
