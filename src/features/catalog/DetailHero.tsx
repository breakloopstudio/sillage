// src/features/catalog/DetailHero.tsx — Image hero de la fiche détail (hero pur, cœur favori top-right)

import { useMemo } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { useTheme, type Theme } from '../../theme/ThemeContext';
import FavButton from '../../components/FavButton';
import type { Parfum } from '../../models';
import { brandColor } from '../../utils/brand-color';

interface Props {
  imageUrl: string | null;
  brand: string;
  imgFailed: boolean;
  parfum: Parfum;
  onImageError: () => void;
  onImagePress: () => void;
}

export default function DetailHero({ imageUrl, brand, imgFailed, parfum, onImageError, onImagePress }: Props) {
  const { theme } = useTheme();
  const s = useMemo(() => getStyles(theme), [theme]);

  const hasImage = imageUrl && !imgFailed;

  return (
    <View style={s.container}>
      {hasImage ? (
        <Pressable onPress={onImagePress} accessibilityRole="imagebutton" accessibilityLabel="Agrandir l'image">
          <Image
            source={{ uri: imageUrl }}
            style={s.image}
            contentFit="contain"
            transition={300}
            cachePolicy="memory-disk"
            onError={onImageError}
          />
        </Pressable>
      ) : (
        <View style={[s.placeholder, { backgroundColor: brandColor(brand) }]}>
          <Text style={s.placeholderText}>{brand.charAt(0).toUpperCase()}</Text>
        </View>
      )}

      <FavButton parfum={parfum} size="lg" />
    </View>
  );
}

function getStyles(t: Theme) {
  return {
    container: {
      position: 'relative' as const,
      width: '100%',
      height: 340,
      backgroundColor: t.colors.surface,
      borderBottomWidth: 0.5,
      borderBottomColor: t.colors.border,
    },
    image: { width: '100%', height: 340, backgroundColor: t.colors.surface },
    placeholder: { width: '100%', height: 340, justifyContent: 'center' as const, alignItems: 'center' as const },
    placeholderText: { fontSize: 72, fontFamily: 'Inter_700Bold', color: '#FFFFFF', opacity: 0.5 },
  } as const;
}
