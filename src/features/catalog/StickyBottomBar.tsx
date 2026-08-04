// src/features/catalog/StickyBottomBar.tsx — Barre d'action flottante (prix + Enregistrer + CTA, slide-in après la section prix)

import { useMemo, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useAnimatedReaction,
  interpolate,
  Extrapolation,
  runOnJS,
  useReducedMotion,
  type SharedValue,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useTheme, type Theme } from '../../theme/ThemeContext';
import { textOn } from '../../utils/contrast';
import { formatPrice, formatDiscount } from '../../utils/format-price';
import SaveButton from './SaveButton';

interface Props {
  scrollY: SharedValue<number>;
  priceSectionY: SharedValue<number>;
  bestPrice: number | undefined;
  referencePrice: number | undefined;
  saveLabel: string | null;
  purchaseUrl: string | null | undefined;
  onSavePress: () => void;
  onPurchasePress: () => void;
}

export default function StickyBottomBar({
  scrollY, priceSectionY, bestPrice, referencePrice,
  saveLabel, purchaseUrl, onSavePress, onPurchasePress,
}: Props) {
  const { theme } = useTheme();
  const { t } = useTranslation('common');
  const s = useMemo(() => getStyles(theme), [theme]);
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const [barVisible, setBarVisible] = useState(false);

  const hasPrice = bestPrice !== undefined && bestPrice > 0;
  const discountPct =
    referencePrice && bestPrice && referencePrice > 0 && bestPrice < referencePrice
      ? Math.round((1 - bestPrice / referencePrice) * 100)
      : null;

  useAnimatedReaction(
    () => scrollY.value > priceSectionY.value,
    (visible) => {
      runOnJS(setBarVisible)(visible);
    },
    [],
  );

  const barStyle = useAnimatedStyle(() => {
    const shown = scrollY.value > priceSectionY.value;
    if (reduced) {
      return { opacity: shown ? 1 : 0, transform: [{ translateY: 0 }] };
    }
    const progress = interpolate(
      scrollY.value,
      [priceSectionY.value, priceSectionY.value + 40],
      [0, 1],
      Extrapolation.CLAMP,
    );
    return {
      opacity: progress,
      transform: [{ translateY: interpolate(progress, [0, 1], [60, 0]) }],
    };
  });

  return (
    <Animated.View pointerEvents={barVisible ? 'auto' : 'none'} style={[s.root, { paddingBottom: insets.bottom + 12 }, barStyle]}>
      <LinearGradient
        pointerEvents="none"
        colors={['transparent', theme.colors.background]}
        locations={[0, 0.55]}
        style={s.fade}
      />
      <View style={s.inner}>
        {hasPrice ? (
          <View style={s.priceCol}>
            <View style={s.priceRow}>
              <Text style={s.price} numberOfLines={1} allowFontScaling={false}>{formatPrice(bestPrice!)}</Text>
              {discountPct !== null && discountPct > 0 && discountPct <= 95 && (
                <View style={[s.discountBadge, { backgroundColor: theme.colors.deal }]}>
                  <Text style={s.discountText} allowFontScaling={false}>{formatDiscount(discountPct)}</Text>
                </View>
              )}
            </View>
          </View>
        ) : null}

        <SaveButton label={saveLabel} onPress={onSavePress} variant="bar" />

        {purchaseUrl ? (
          <Pressable onPress={onPurchasePress} style={s.cta} hitSlop={{ top: 4, bottom: 4 }} accessibilityRole="button" accessibilityLabel={t('detail.seeOffer')}>
            <Text style={s.ctaText}>{t('detail.seeOffer')}</Text>
          </Pressable>
        ) : null}
      </View>
    </Animated.View>
  );
}

function getStyles(t: Theme) {
  return {
    root: {
      position: 'absolute' as const,
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 20,
    },
    fade: {
      position: 'absolute' as const,
      top: -28,
      bottom: 0,
      left: 0,
      right: 0,
    },
    inner: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: 8,
      marginHorizontal: 12,
      backgroundColor: t.colors.surface,
      borderRadius: t.radius.card,
      paddingHorizontal: 12,
      paddingVertical: 8,
      ...t.shadow.elevated,
    },
    priceCol: {
      flexShrink: 1,
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
      flexShrink: 1,
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
    cta: {
      backgroundColor: t.colors.primary,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderRadius: t.radius.base,
      ...t.shadow.button,
    },
    ctaText: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 14,
      color: textOn(t.colors.primary),
    },
  } as const;
}
