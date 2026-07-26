// src/features/catalog/DetailHero.tsx — Image hero de la fiche détail (hero pur, cœur favori top-right)

import { useMemo } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Image } from 'expo-image';
import Ionicons from '@react-native-vector-icons/ionicons/static';
import { useTheme, type Theme } from '../../theme/ThemeContext';
import FavButton from '../../components/FavButton';
import type { Parfum } from '../../models';

const PALETTE = ['#5B21B6', '#1E40AF', '#065F46', '#92400E', '#991B1B', '#9D174D', '#3730A3', '#854D0E'];

function brandColor(brand: string): string {
  let hash = 0;
  for (let i = 0; i < brand.length; i++) hash = brand.charCodeAt(i) + ((hash << 5) - hash);
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

interface Props {
  imageUrl: string | null;
  imageUrl2x?: string | null;
  brand: string;
  imgFailed: boolean;
  parfum: Parfum;
  onImageError: () => void;
  onImagePress: () => void;
  onShare?: () => void;
}

export default function DetailHero({ imageUrl, imageUrl2x, brand, imgFailed, parfum, onImageError, onImagePress, onShare }: Props) {
  const { theme } = useTheme();
  const s = useMemo(() => getStyles(theme), [theme]);

  const hasImage = imageUrl && !imgFailed;

  return (
    <View style={s.container}>
      {hasImage ? (
        <Pressable onPress={onImagePress}>
          <Image
            source={{ uri: imageUrl }}
            style={s.image}
            contentFit="contain"
            transition={300}
            onError={onImageError}
          />
          {imageUrl2x ? (
            <Image
              key={imageUrl2x}
              source={{ uri: imageUrl2x }}
              style={s.imageHd}
              contentFit="contain"
              transition={250}
            />
          ) : null}
        </Pressable>
      ) : (
        <View style={[s.placeholder, { backgroundColor: brandColor(brand) }]}>
          <Text style={s.placeholderText}>{brand.charAt(0).toUpperCase()}</Text>
        </View>
      )}

      {hasImage ? (
        <View style={s.topActions}>
          <Pressable onPress={onImagePress} style={s.actionBtn} hitSlop={8} accessibilityLabel="Agrandir l'image">
            <Ionicons name="expand-outline" size={16} color={theme.colors.textMuted} />
          </Pressable>
          {onShare ? (
            <Pressable onPress={onShare} style={s.actionBtn} hitSlop={8} accessibilityLabel="Partager ce parfum">
              <Ionicons name="share-social-outline" size={16} color={theme.colors.textMuted} />
            </Pressable>
          ) : null}
        </View>
      ) : null}

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
    imageHd: { position: 'absolute' as const, top: 0, left: 0, right: 0, bottom: 0 },
    placeholder: { width: '100%', height: 340, justifyContent: 'center' as const, alignItems: 'center' as const },
    placeholderText: { fontSize: 72, fontFamily: 'Inter_700Bold', color: '#FFFFFF', opacity: 0.5 },
    topActions: {
      position: 'absolute' as const,
      bottom: 12,
      right: 12,
      flexDirection: 'row' as const,
      gap: 8,
    },
    actionBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: t.colors.surface,
      justifyContent: 'center' as const,
      alignItems: 'center' as const,
      ...t.shadow.card,
    },
  } as const;
}
