// src/features/wardrobe/WardrobeCard.tsx — Carte parfumerie native, zones de badges sans chevauchement

import { useMemo, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Image } from 'expo-image';
import Ionicons from '@react-native-vector-icons/ionicons/static';
import { ownershipLabel } from '../../utils/ownership';
import { useTheme, type Theme } from '../../theme/ThemeContext';
import { textOn } from '../../utils/contrast';
import type { WardrobeItem } from '../../models/wardrobe.interface';

const PALETTE = ['#5B21B6', '#1E40AF', '#065F46', '#92400E', '#991B1B', '#9D174D', '#3730A3', '#854D0E'];

function brandColor(brand: string): string {
  let hash = 0;
  for (let i = 0; i < brand.length; i++) hash = brand.charCodeAt(i) + ((hash << 5) - hash);
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

interface Props {
  item: WardrobeItem;
  onPress: () => void;
}

export default function WardrobeCard({ item, onPress }: Props) {
  const { theme } = useTheme();
  const s = useMemo(() => getStyles(theme), [theme]);
  const [imgFailed, setImgFailed] = useState(false);
  const hasImage = item.imageUrl && !imgFailed;
  const tint = brandColor(item.marque ?? '');

  const badgeStyle = useMemo(() => {
    const base: Record<string, { bg: string; color: string }> = {
      have: { bg: theme.colors.primary, color: textOn(theme.colors.primary) },
      want: { bg: theme.colors.secondary, color: textOn(theme.colors.secondary) },
      had: { bg: 'rgba(0,0,0,0.55)', color: '#FFFFFF' },
      sample: { bg: theme.colors.deal, color: textOn(theme.colors.deal) },
      decant: { bg: theme.colors.dealSoft, color: theme.colors.deal },
    };
    return base[item.ownership] ?? base.have;
  }, [item.ownership, theme]);

  return (
    <View style={s.wrapper}>
      <Pressable style={s.card} onPress={onPress} accessible accessibilityRole="button">
        <View style={s.imgWrap}>
          {hasImage ? (
            <Image
              source={{ uri: item.imageUrl! }}
              style={s.image}
              contentFit="contain"
              transition={300}
              onError={() => setImgFailed(true)}
            />
          ) : (
            <View style={[s.imgPlaceholder, { backgroundColor: tint }]}>
              <Text style={s.placeholderText}>{(item.marque ?? '?').charAt(0).toUpperCase()}</Text>
            </View>
          )}

          {item.isSignature && (
            <View style={s.sigBadge}>
              <Ionicons name="star" size={10} color={theme.colors.secondary} />
            </View>
          )}

          <View style={[s.ownershipBadge, { backgroundColor: badgeStyle.bg }]}>
            <Text allowFontScaling={false} style={[s.ownershipText, { color: badgeStyle.color }]}>
              {ownershipLabel(item.ownership)}
            </Text>
          </View>

          {item.rating !== null && item.rating > 0 && (
            <View style={s.ratingBadge}>
              <Ionicons name="star" size={10} color="#FFFFFF" />
              <Text allowFontScaling={false} style={s.ratingText}>{item.rating}</Text>
            </View>
          )}
        </View>

        <View style={s.body}>
          <View style={s.marqueRow}>
            <Text style={s.brand} numberOfLines={1}>{(item.marque ?? '').substring(0, 20)}</Text>
            {item.notes && item.notes.trim().length > 0 && (
              <Ionicons name="document-text" size={11} color={theme.colors.textMuted} />
            )}
          </View>
          <Text style={s.name} numberOfLines={2} ellipsizeMode="tail">{item.nom ?? '—'}</Text>
        </View>
      </Pressable>
    </View>
  );
}

function getStyles(t: Theme) {
  return {
    wrapper: {
      flex: 1,
      maxWidth: '50%',
    },
    card: {
      borderRadius: t.radius.card,
      backgroundColor: t.colors.surface,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: t.colors.border,
      ...t.shadow.card,
    },
    imgWrap: {
      position: 'relative',
      height: 136,
      overflow: 'hidden',
      borderBottomWidth: 0.5,
      borderBottomColor: t.colors.border,
    },
    image: {
      width: '100%',
      height: '100%',
      backgroundColor: t.colors.surface,
    },
    imgPlaceholder: {
      width: '100%',
      height: '100%',
      justifyContent: 'center',
      alignItems: 'center',
    },
    placeholderText: {
      fontSize: 48,
      fontFamily: 'Inter_700Bold',
      color: '#FFFFFF',
      opacity: 0.5,
    },
    sigBadge: {
      position: 'absolute',
      top: 6,
      left: 6,
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: t.colors.secondarySoft,
      justifyContent: 'center',
      alignItems: 'center',
    },
    ownershipBadge: {
      position: 'absolute',
      top: 6,
      right: 6,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 10,
    },
    ownershipText: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 10,
    },
    ratingBadge: {
      position: 'absolute',
      bottom: 8,
      left: 6,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      backgroundColor: 'rgba(0,0,0,0.55)',
      paddingHorizontal: 7,
      paddingVertical: 3,
      borderRadius: 10,
    },
    ratingText: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 10,
      color: '#FFFFFF',
    },
    body: {
      padding: 10,
    },
    marqueRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 3,
    },
    brand: {
      fontSize: 10,
      textTransform: 'uppercase',
      letterSpacing: 1,
      color: t.colors.textMuted,
      fontFamily: 'Inter_400Regular',
      flex: 1,
    },
    name: {
      fontFamily: 'PlayfairDisplay_600SemiBold',
      fontSize: 14,
      color: t.colors.text,
      lineHeight: 18,
    },
  } as const;
}
