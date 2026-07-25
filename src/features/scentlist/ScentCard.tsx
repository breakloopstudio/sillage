// src/features/scentlist/ScentCard.tsx — Carte journal pour le carnet d'essais

import { useMemo } from 'react';
import { View, Text, Pressable } from 'react-native';
import Ionicons from '@react-native-vector-icons/ionicons/static';
import { useTheme, type Theme } from '../../theme/ThemeContext';
import { formatPrice } from '../../utils/format-price';
import type { UserScentItem, ScentVerdict } from '../../models';

const VERDICT_META: Record<ScentVerdict, { label: string; token: string }> = {
  love:    { label: 'Coup de cœur', token: 'secondary' },
  like:    { label: 'J\'aime',       token: 'deal' },
  meh:     { label: 'Mitigé',        token: 'fair' },
  dislike: { label: 'Pas pour moi',  token: 'primary' },
};

function formatDate(d: unknown): string {
  if (d instanceof Date) {
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  }
  const date = (d as { toDate?: () => Date })?.toDate?.();
  if (date instanceof Date) {
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  }
  return '';
}

interface Props {
  item: UserScentItem;
  onPress: () => void;
  onLongPress: () => void;
  onTryPress?: () => void;
}

export default function ScentCard({ item, onPress, onLongPress, onTryPress }: Props) {
  const { theme } = useTheme();
  const s = useMemo(() => getStyles(theme), [theme]);
  const isToTry = item.status === 'to_try';
  const verdictMeta = item.verdict ? VERDICT_META[item.verdict] : null;
  const hasPrice = typeof item.bestPrice === 'number' && item.bestPrice > 0;
  const discountPct = item.referencePrice && item.bestPrice && item.referencePrice > 0 && item.bestPrice < item.referencePrice
    ? Math.round((1 - item.bestPrice / item.referencePrice) * 100) : null;
  const hasNotes = typeof item.notes === 'string' && item.notes.trim().length > 0;

  return (
    <Pressable
      style={({ pressed }) => [s.card, pressed && s.cardPressed]}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={400}
    >
      <View style={s.row}>
        <View style={s.imgWrap}>
          {item.imageUrl ? (
            <View style={s.imgPlaceholder} />
          ) : (
            <View style={[s.imgPlaceholder, { backgroundColor: theme.colors.surface2, justifyContent: 'center', alignItems: 'center' }]}>
              <Ionicons name="eyedrop-outline" size={24} color={theme.colors.textMuted} />
            </View>
          )}
        </View>

        <View style={s.body}>
          <Text style={s.brand} numberOfLines={1}>{item.marque ?? ''}</Text>
          <Text style={s.name} numberOfLines={1}>{item.nom ?? ''}</Text>

          <View style={s.chipRow}>
            {item.familleOlactive ? (
              <View style={[s.familyChip, { backgroundColor: theme.colors.primarySoft }]}>
                <Text style={[s.familyChipText, { color: theme.colors.primaryInk }]} allowFontScaling={false}>{item.familleOlactive}</Text>
              </View>
            ) : null}
            {hasPrice ? (
              <Text style={s.price} allowFontScaling={false}>{formatPrice(item.bestPrice!, { decimals: 0 })}</Text>
            ) : null}
            {hasPrice && discountPct !== null && discountPct > 0 ? (
              <View style={[s.discountBadge, { backgroundColor: theme.colors.deal }]}>
                <Text style={s.discountText} allowFontScaling={false}>-{discountPct}%</Text>
              </View>
            ) : null}
          </View>

          {!isToTry && (
            <View style={s.triedRow}>
              {verdictMeta && (
                <View style={s.verdictChip}>
                  <View style={[s.verdictDot, { backgroundColor: (theme.colors as Record<string, string>)[verdictMeta.token] }]} />
                  <Text style={s.verdictLabel} allowFontScaling={false}>{verdictMeta.label}</Text>
                </View>
              )}
              {item.rating !== null && !Number.isNaN(item.rating) && (
                <View style={s.starsRow}>
                  {[1, 2, 3, 4, 5].map(n => (
                    <Ionicons
                      key={n}
                      name={item.rating! >= n ? 'star' : item.rating! >= n - 0.5 ? 'star-half' : 'star-outline'}
                      size={10}
                      color={item.rating! >= n || item.rating! >= n - 0.5 ? theme.colors.secondary : theme.colors.textMuted}
                    />
                  ))}
                </View>
              )}
              {item.triedAt ? (
                <Text style={s.triedDate} allowFontScaling={false}>· {formatDate(item.triedAt)}</Text>
              ) : null}
            </View>
          )}

          {hasNotes && !isToTry && (
            <View style={[s.notesBlock, { borderLeftColor: theme.colors.border }]}>
              <Text style={s.notesText} numberOfLines={2}>{item.notes}</Text>
            </View>
          )}
        </View>

        {isToTry && onTryPress ? (
          <Pressable
            style={[s.tryBtn, { backgroundColor: theme.colors.primarySoft }]}
            onPress={onTryPress}
            hitSlop={8}
          >
            <Ionicons name="checkmark" size={18} color={theme.colors.primary} />
          </Pressable>
        ) : null}
      </View>
    </Pressable>
  );
}

function getStyles(t: Theme) {
  return {
    card: {
      backgroundColor: t.colors.surface,
      borderRadius: t.radius.card,
      padding: 12,
      marginHorizontal: t.spacing.md,
      marginBottom: 8,
      ...t.shadow.card,
    },
    cardPressed: {
      opacity: 0.9,
    },
    row: {
      flexDirection: 'row',
      gap: 12,
    },
    imgWrap: {
      width: 64,
      height: 84,
      borderRadius: t.radius.base,
      overflow: 'hidden',
    },
    imgPlaceholder: {
      flex: 1,
      backgroundColor: t.colors.surface2,
    },
    body: {
      flex: 1,
      gap: 3,
    },
    brand: {
      fontFamily: 'Inter_400Regular',
      fontSize: 10,
      color: t.colors.textMuted,
      letterSpacing: 1.5,
    },
    name: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 14,
      color: t.colors.text,
    },
    chipRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      flexWrap: 'wrap',
    },
    familyChip: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 10,
    },
    familyChipText: {
      fontFamily: 'Inter_500Medium',
      fontSize: 11,
    },
    price: {
      fontFamily: 'Inter_800ExtraBold',
      fontSize: 13,
      color: t.colors.text,
    },
    discountBadge: {
      paddingHorizontal: 5,
      paddingVertical: 2,
      borderRadius: 6,
    },
    discountText: {
      fontFamily: 'Inter_700Bold',
      fontSize: 10,
      color: '#FFFFFF',
    },
    tryBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      justifyContent: 'center',
      alignItems: 'center',
      alignSelf: 'center',
    },
    triedRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 4,
    },
    verdictChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    verdictDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    verdictLabel: {
      fontFamily: 'Inter_500Medium',
      fontSize: 11,
      color: t.colors.textMuted,
    },
    starsRow: {
      flexDirection: 'row',
      gap: 2,
      alignItems: 'center',
    },
    triedDate: {
      fontFamily: 'Inter_400Regular',
      fontSize: 11,
      color: t.colors.textMuted,
    },
    notesBlock: {
      borderLeftWidth: 2,
      paddingLeft: 10,
      marginTop: 6,
    },
    notesText: {
      fontFamily: 'Inter_400Regular',
      fontSize: 13,
      color: t.colors.textMuted,
      lineHeight: 18,
    },
  } as const;
}
