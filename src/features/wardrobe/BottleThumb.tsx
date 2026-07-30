import { useMemo, useCallback } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { useTheme, type Theme } from '../../theme/ThemeContext';
import { brandColor } from '../../utils/brand-color';

export interface BottleThumbItem {
  parfumId: string;
  nom: string | null;
  marque: string | null;
  imageUrl: string | null;
}

interface Props {
  item: BottleThumbItem;
  onPress: () => void;
  onLongPress?: () => void;
  size?: number;
}

export default function BottleThumb({ item, onPress, onLongPress, size = 64 }: Props) {
  const { theme } = useTheme();
  const s = useMemo(() => getStyles(theme, size), [theme, size]);
  const tint = brandColor(item.marque ?? '');
  const source = useMemo(() => (item.imageUrl ? { uri: item.imageUrl } : null), [item.imageUrl]);
  const label = `${item.marque ?? ''} ${item.nom ?? ''}`.trim();
  const handlePress = useCallback(() => onPress(), [onPress]);
  const handleLongPress = useCallback(() => { if (onLongPress) onLongPress(); }, [onLongPress]);

  return (
    <Pressable
      onPress={handlePress}
      onLongPress={onLongPress ? handleLongPress : undefined}
      delayLongPress={400}
      style={s.hit}
      accessibilityRole="button"
      accessibilityLabel={label || 'Parfum'}
    >
      {source ? (
        <Image source={source} style={s.image} contentFit="contain" transition={200} cachePolicy="memory-disk" recyclingKey={item.parfumId} />
      ) : (
        <View style={[s.placeholder, { backgroundColor: tint }]}>
          <Text style={s.initial} allowFontScaling={false}>
            {(item.marque ?? '?').charAt(0).toUpperCase()}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

function getStyles(t: Theme, size: number) {
  const width = Math.round(size * 0.78);
  return {
    hit: {
      width,
      height: size,
      justifyContent: 'flex-end' as const,
      alignItems: 'center' as const,
    },
    image: {
      width,
      height: size,
    },
    placeholder: {
      width,
      height: size,
      borderRadius: t.radius.sm,
      justifyContent: 'flex-end' as const,
      alignItems: 'center' as const,
      paddingBottom: 6,
    },
    initial: {
      fontFamily: 'Inter_700Bold',
      fontSize: Math.round(size * 0.34),
      color: '#FFFFFF',
      opacity: 0.5,
    },
  } as const;
}
