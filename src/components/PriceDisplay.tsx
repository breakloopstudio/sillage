// src/components/PriceDisplay.tsx — Prix animé avec badge d'économie contextuel

import { useEffect, useMemo } from 'react';
import { View, Text, type ViewStyle } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { useTheme, type Theme } from '../theme/ThemeContext';
import { textOn } from '../utils/contrast';
import { formatPrice } from '../utils/format-price';
import { priceTier } from '../utils/price-tier';

type PriceValue = 'deal' | 'fair' | 'overpriced' | 'unknown';

interface Props {
  bestPrice: number;
  referencePrice?: number;
  priceValue?: PriceValue;
  large?: boolean;
  animated?: boolean;
  style?: ViewStyle;
}

export default function PriceDisplay({
  bestPrice,
  referencePrice,
  priceValue,
  large = false,
  animated = true,
  style,
}: Props) {
  const { theme } = useTheme();
  const s = useMemo(() => getStyles(theme), [theme]);
  const val: PriceValue = priceValue ?? (priceTier(bestPrice, referencePrice) ?? 'unknown');
  const color = priceColor(val, theme);
  const bg = priceBg(val, theme);
  const pct = referencePrice && referencePrice > 0
    ? Math.round((1 - bestPrice / referencePrice) * 100)
    : null;

  const scale = useSharedValue(animated ? 0.5 : 1);
  const opacity = useSharedValue(animated ? 0 : 1);

  useEffect(() => {
    if (!animated) return;
    scale.value = withSpring(1, { stiffness: 200, damping: 10 });
    opacity.value = withSpring(1, { stiffness: 200, damping: 10 });
  }, [bestPrice]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[s.container, { backgroundColor: bg }, style, animatedStyle]}>
      <View style={s.priceRow}>
        <Text style={[s.bestPrice, { color }, large && s.bestPriceLarge]}>
          {formatPrice(bestPrice)}
        </Text>
        {referencePrice && referencePrice > 0 && bestPrice < referencePrice && (
          <Text style={s.refPrice}>{formatPrice(referencePrice)}</Text>
        )}
        {pct !== null && pct > 0 && pct <= 95 && (
          <View style={[s.discountBadge, { backgroundColor: color }]}>
            <Text style={[s.discountText, { color: textOn(color) }]}>-{pct}%</Text>
          </View>
        )}
      </View>
      {valueLabel(val) && (
        <Text style={[s.valueLabel, { color: priceInk(val, theme) }]}>{valueLabel(val)}</Text>
      )}
    </Animated.View>
  );
}

function priceColor(v: PriceValue, t: Theme): string {
  if (v === 'deal') return t.colors.deal;
  if (v === 'overpriced') return t.colors.overpriced;
  if (v === 'fair') return t.colors.fair;
  return t.colors.text;
}

function priceBg(v: PriceValue, t: Theme): string {
  if (v === 'deal') return t.colors.dealSoft;
  if (v === 'overpriced') return t.colors.overpricedSoft;
  if (v === 'fair') return t.colors.fairSoft;
  return t.colors.surface2;
}

function priceInk(v: PriceValue, t: Theme): string {
  if (v === 'deal') return t.colors.dealInk;
  if (v === 'overpriced') return t.colors.overpricedInk;
  if (v === 'fair') return t.colors.fairInk;
  return t.colors.text;
}

function valueLabel(v: PriceValue): string | null {
  if (v === 'deal') return 'Bonne affaire';
  if (v === 'overpriced') return 'Trop cher';
  if (v === 'fair') return 'Prix correct';
  return null;
}

function getStyles(t: Theme) {
  return {
    container: {
      borderRadius: t.radius.card,
      padding: 16,
    },
    priceRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: 10,
    },
    bestPrice: {
      fontFamily: 'Inter_700Bold',
      fontSize: 32,
    },
    bestPriceLarge: {
      fontSize: 42,
    },
    refPrice: {
      fontSize: 16,
      color: t.colors.textMuted,
      textDecorationLine: 'line-through',
    },
    discountBadge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 10,
    },
    discountText: {
      fontSize: 13,
      fontFamily: 'Inter_700Bold',
    },
    valueLabel: {
      fontSize: 13,
      fontFamily: 'Inter_600SemiBold',
      marginTop: 6,
    },
  } as const;
}