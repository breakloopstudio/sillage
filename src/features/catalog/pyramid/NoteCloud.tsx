import { useCallback, useMemo } from 'react';
import { View, Text, Pressable } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
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
  const handlePress = useCallback(
    (note: string) => {
      hapticsLight();
      if (layer) onNotePress(note, layer.key);
    },
    [layer, onNotePress],
  );

  if (layer === null) return null;

  if (layer.notes.length === 0) {
    return (
      <View style={sEmpty}>
        <Text style={[sEmptyText, { color: layer.ink }]}>
          Aucune note de {layer.label.toLowerCase()} renseignée
        </Text>
      </View>
    );
  }

  return (
    <View style={sCloud}>
      {layer.notes.map((note, i) => (
        <Animated.View
          key={`${layer.key}-${i}`}
          entering={FadeInDown.delay(i * 55).duration(220).springify()}
        >
          <Pressable
            onPress={() => handlePress(note)}
            hitSlop={{ top: 4, bottom: 4 }}
            accessibilityRole="button"
            accessibilityLabel={`Note ${translateNote(note)}`}
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
  justifyContent: 'center' as const,
  marginTop: 14,
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
  marginTop: 14,
  alignItems: 'center' as const,
};

const sEmptyText = {
  fontFamily: 'Inter_400Regular',
  fontSize: 13,
  fontStyle: 'italic' as const,
};
