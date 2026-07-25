// src/features/catalog/StickyBottomBar.tsx — Barre d'action flottante (prix + actions, slide-in après la section prix)

import { useMemo } from 'react';
import { View, Text, Pressable } from 'react-native';
import Animated, {
  useAnimatedStyle,
  interpolate,
  Extrapolation,
  type SharedValue,
} from 'react-native-reanimated';
import Ionicons from '@react-native-vector-icons/ionicons/static';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, type Theme } from '../../theme/ThemeContext';
import { textOn } from '../../utils/contrast';
import { ownershipLabel } from '../../utils/ownership';
import type { WardrobeItem } from '../../models/wardrobe.interface';

interface Props {
  scrollY: SharedValue<number>;
  priceSectionY: SharedValue<number>;
  bestPrice: number | undefined;
  referencePrice: number | undefined;
  isFav: boolean;
  wardrobeItem: WardrobeItem | null;
  inScentList: boolean;
  purchaseUrl: string | null | undefined;
  onToggleFav: () => void;
  onWardrobePress: () => void;
  onScentPress: () => void;
  onPurchasePress: () => void;
}

export default function StickyBottomBar({
  scrollY, priceSectionY, bestPrice, referencePrice,
  isFav, wardrobeItem, inScentList, purchaseUrl,
  onToggleFav, onWardrobePress, onScentPress, onPurchasePress,
}: Props) {
  const { theme } = useTheme();
  const s = useMemo(() => getStyles(theme), [theme]);
  const insets = useSafeAreaInsets();

  const hasPrice = bestPrice !== undefined && bestPrice > 0;
  const discountPct =
    referencePrice && bestPrice && referencePrice > 0 && bestPrice < referencePrice
      ? Math.round((1 - bestPrice / referencePrice) * 100)
      : null;

  const barStyle = useAnimatedStyle(() => {
    const visible = scrollY.value > priceSectionY.value ? 1 : 0;
    return {
      opacity: interpolate(visible, [0, 1], [0, 1], Extrapolation.CLAMP),
      transform: [
        { translateY: interpolate(visible, [0, 1], [60, 0], Extrapolation.CLAMP) },
      ],
      pointerEvents: visible > 0.1 ? ('auto' as const) : ('none' as const),
    };
  });

  return (
    <Animated.View style={[s.root, { paddingBottom: insets.bottom + 12 }, barStyle]}>
      <View style={s.inner}>
        {/* Prix + réduction */}
        <View style={s.priceCol}>
          {hasPrice ? (
            <>
              <View style={s.priceRow}>
                <Text style={s.price}>{bestPrice!.toFixed(2)} €</Text>
                {discountPct !== null && discountPct > 0 && discountPct <= 95 && (
                  <View style={[s.discountBadge, { backgroundColor: theme.colors.deal }]}>
                    <Text style={s.discountText}>-{discountPct}%</Text>
                  </View>
                )}
              </View>
            </>
          ) : (
            <Text style={s.noPrice}>-- €</Text>
          )}
        </View>

        {/* Actions fav + scent + wardrobe */}
        <View style={s.actions}>
          <Pressable onPress={onToggleFav} style={s.actionBtn} hitSlop={8} accessibilityRole="button" accessibilityLabel={isFav ? 'Retirer des favoris' : 'Ajouter aux favoris'}>
            <Ionicons
              name={isFav ? 'heart' : 'heart-outline'}
              size={22}
              color={isFav ? theme.colors.favorite : theme.colors.textMuted}
            />
          </Pressable>

          <Pressable onPress={onScentPress} style={s.actionBtn} hitSlop={8} accessibilityRole="button" accessibilityLabel={inScentList ? 'Voir dans le carnet' : 'Ajouter au carnet'}>
            <Ionicons
              name={inScentList ? 'eyedrop' : 'eyedrop-outline'}
              size={22}
              color={inScentList ? theme.colors.secondary : theme.colors.textMuted}
            />
          </Pressable>

          <Pressable onPress={onWardrobePress} style={s.actionBtn} hitSlop={8} accessibilityRole="button" accessibilityLabel={wardrobeItem ? 'Modifier dans la parfumerie' : 'Ajouter à la parfumerie'}>
            <Ionicons
              name={wardrobeItem ? 'flask' : 'flask-outline'}
              size={22}
              color={wardrobeItem ? theme.colors.primary : theme.colors.textMuted}
            />
          </Pressable>
        </View>

        {/* CTA */}
        {purchaseUrl ? (
          <Pressable onPress={onPurchasePress} style={s.cta}>
            <Text style={s.ctaText}>Voir l'offre</Text>
          </Pressable>
        ) : (
          <View style={s.ctaPlaceholder} />
        )}
      </View>
    </Animated.View>
  );
}

function getStyles(t: Theme) {
  return {
    root: {
      position: 'absolute' as const,
      bottom: 0,
      left: 12,
      right: 12,
      zIndex: 20,
      paddingTop: 6,
    },
    inner: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: 8,
      backgroundColor: t.colors.surface,
      borderRadius: t.radius.card,
      paddingHorizontal: 12,
      paddingVertical: 8,
      ...t.shadow.elevated,
    },
    priceCol: {
      minWidth: 90,
      justifyContent: 'center' as const,
    },
    priceRow: {
      flexDirection: 'row' as const,
      alignItems: 'baseline' as const,
      gap: 4,
    },
    price: {
      fontFamily: 'Inter_800ExtraBold',
      fontSize: 20,
      color: t.colors.text,
    },
    discountBadge: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 8,
    },
    discountText: {
      fontSize: 11,
      fontFamily: 'Inter_700Bold',
      color: textOn(t.colors.deal),
    },
    noPrice: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 15,
      color: t.colors.textMuted,
    },
    actions: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: 4,
      marginLeft: 4,
    },
    actionBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      justifyContent: 'center' as const,
      alignItems: 'center' as const,
    },
    cta: {
      marginLeft: 'auto' as const,
      backgroundColor: t.colors.primary,
      paddingHorizontal: 18,
      paddingVertical: 10,
      borderRadius: t.radius.base,
      ...t.shadow.button,
    },
    ctaText: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 14,
      color: textOn(t.colors.primary),
    },
    ctaPlaceholder: {
      marginLeft: 'auto' as const,
      width: 100,
    },
  } as const;
}
