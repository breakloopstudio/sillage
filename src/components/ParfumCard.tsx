// src/components/ParfumCard.tsx — Carte parfum réutilisable (4 modes)
// compact (rangées horizontales), comfortable (grille 2 col), compactPlus (grille dense), list

import { useMemo, useState, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useTheme, type Theme } from '../theme/ThemeContext';
import type { Parfum } from '../models';
import { setPendingParfum } from '../services/catalog-bridge';
import { translateNote } from '../utils/translate-note';
import { textOn } from '../utils/contrast';
import { formatPrice } from '../utils/format-price';
import FavButton from './FavButton';

export type CardMode = 'compact' | 'comfortable' | 'compactPlus' | 'list';

interface Props {
  parfum: Parfum;
  mode?: CardMode;
  onPressOverride?: () => void;
}

function getDiscount(p: Parfum): number | null {
  if (typeof p.referencePrice === 'number' && p.referencePrice > 0 && typeof p.bestPrice === 'number') {
    const d = Math.round((1 - p.bestPrice / p.referencePrice) * 100);
    return d >= 10 ? d : null;
  }
  return null;
}

type PriceTier = 'deal' | 'fair' | 'overpriced' | null;
function getPriceTier(p: Parfum): PriceTier {
  if (typeof p.bestPrice !== 'number' || p.bestPrice <= 0) return null;
  if (typeof p.referencePrice === 'number' && p.referencePrice > 0) {
    const ratio = p.bestPrice / p.referencePrice;
    if (ratio <= 0.8) return 'deal';
    if (ratio >= 1.15) return 'overpriced';
    if (ratio <= 0.95) return 'fair';
  }
  return null;
}

const PALETTE = ['#5B21B6','#1E40AF','#065F46','#92400E','#991B1B','#9D174D','#3730A3','#854D0E'];

function brandColor(brand: string): string {
  let hash = 0;
  for (let i = 0; i < brand.length; i++) hash = brand.charCodeAt(i) + ((hash << 5) - hash);
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

function resolveImageUrl(p: Parfum): string | null {
  return p.imageUrl ?? null;
}

export default function ParfumCard({ parfum, mode = 'comfortable', onPressOverride }: Props) {
  const { theme } = useTheme();
  const s = useMemo(() => getStyles(theme), [theme]);
  const router = useRouter();
  const [imgFailed, setImgFailed] = useState(false);

  const discount = getDiscount(parfum);
  const priceTier = getPriceTier(parfum);
  const bestPrice = parfum.bestPrice ?? null;
  const imageUrl = resolveImageUrl(parfum);
  const hasImage = imageUrl !== null;
  const showImage = hasImage && !imgFailed;
  const tint = brandColor(parfum.marque);
  const imageSource = useMemo(() => (imageUrl ? { uri: imageUrl } : null), [imageUrl]);
  const gradientColors = useMemo(() => [theme.colors.surface, theme.colors.surfaceImgBottom] as const, [theme.colors]);

  const goToDetail = useCallback(() => {
    if (onPressOverride) { onPressOverride(); return; }
    setPendingParfum(parfum);
    router.push(`/catalog/${parfum.id}`);
  }, [onPressOverride, parfum, router]);

  const handleImgError = useCallback(() => setImgFailed(true), []);

  // ── Mode: compact (rangées horizontales) ──
  if (mode === 'compact') {
    const a11yLabelCompact = [parfum.nom, parfum.marque, bestPrice !== null ? formatPrice(bestPrice, { decimals: 0 }) : ''].filter(Boolean).join(', ');
    return (
      <Pressable style={s.cardCompact} onPress={goToDetail} accessible={true} accessibilityLabel={a11yLabelCompact} accessibilityHint="Appuyez pour voir le détail du parfum" accessibilityRole="button">
        {showImage ? (
          <View style={s.imgWrapCompact}>
            <LinearGradient colors={gradientColors} style={s.imgBgFull} />
            <Image source={imageSource!} style={s.imgCompact} contentFit="contain" transition={300} onError={handleImgError} />
            {discount !== null && <View style={s.dealBadgeCompact}><Text style={s.dealBadgeTextCompact}>-{discount}%</Text></View>}
            <FavButton parfum={parfum} size="sm" />
          </View>
        ) : (
          <View style={[s.imgPlaceholderCompact, { backgroundColor: tint }]}>
            <Text style={s.placeholderInitCompact}>{parfum.marque.charAt(0).toUpperCase()}</Text>
            <FavButton parfum={parfum} size="sm" />
          </View>
        )}
        <View style={s.headerCompact}>
          <Text style={s.brandCompact} numberOfLines={1}>{parfum.marque}</Text>
          <Text style={s.titleCompact} numberOfLines={2} ellipsizeMode="tail">{parfum.nom}</Text>
        </View>
        <View style={s.priceRowCompact}>
          {priceTier && <View style={[s.priceDotSmall, { backgroundColor: theme.colors[priceTier] }]} />}
          {bestPrice !== null ? (
            <>
              <Text style={s.priceCompact}>{formatPrice(bestPrice, { decimals: 0 })}</Text>
              {parfum.referencePrice && bestPrice < parfum.referencePrice && (
                <Text style={s.priceRefCompact}>{formatPrice(parfum.referencePrice, { decimals: 0 })}</Text>
              )}
            </>
          ) : (
            <Text style={s.priceCompactMuted}>— €</Text>
          )}
        </View>
      </Pressable>
    );
  }

  // ── Mode: comfortable (grille 2 col, défaut) ──
  if (mode === 'comfortable') {
    const a11yLabel = [parfum.nom, parfum.marque, bestPrice !== null ? `${formatPrice(bestPrice, { decimals: 0 })}` : '', parfum.referencePrice && bestPrice && bestPrice < parfum.referencePrice ? `au lieu de ${formatPrice(parfum.referencePrice, { decimals: 0 })}` : ''].filter(Boolean).join(', ');
    return (
      <Pressable
        style={s.cardComfortable}
        onPress={goToDetail}
        accessible={true}
        accessibilityLabel={a11yLabel}
        accessibilityHint="Appuyez pour voir le détail du parfum"
        accessibilityRole="button"
      >
        {showImage ? (
          <View style={s.imgWrapComfortable}>
            <LinearGradient colors={gradientColors} style={s.imgBgFull} />
            <Image source={imageSource!} style={s.imgComfortable} contentFit="contain" transition={300} onError={handleImgError} />
            {discount !== null && <View style={s.dealBadge}><Text style={s.dealBadgeText}>-{discount}%</Text></View>}
            <FavButton parfum={parfum} size="sm" />
          </View>
        ) : (
          <View style={[s.imgPlaceholderComfortable, { backgroundColor: tint }]}>
            <Text style={s.placeholderInitComfortable}>{parfum.marque.charAt(0).toUpperCase()}</Text>
            <FavButton parfum={parfum} size="sm" />
          </View>
        )}
        <View style={s.bodyComfortable}>
          <Text style={s.brandComfortable} numberOfLines={1}>{parfum.marque}</Text>
          <Text style={s.titleComfortable} numberOfLines={2} ellipsizeMode="tail" maxFontSizeMultiplier={1.3}>{parfum.nom}</Text>
          {parfum.familleOlactive || parfum.annee ? (
            <View style={s.tags}>
              {parfum.familleOlactive ? (
                <View style={s.tagFamily}><Text style={s.tagFamilyText}>{translateNote(parfum.familleOlactive)}</Text></View>
              ) : null}
              {parfum.annee ? (
                <View style={s.tagYear}><Text style={s.tagYearText}>{parfum.annee}</Text></View>
              ) : null}
            </View>
          ) : null}
          {parfum.notesTete?.length > 0 && (
            <Text style={s.notesText} numberOfLines={1}>{parfum.notesTete!.slice(0, 3).map(translateNote).join(' · ')}</Text>
          )}
          <View style={s.priceRowComfortable}>
            {priceTier && <View style={[s.priceDot, { backgroundColor: theme.colors[priceTier] }]} />}
            {bestPrice !== null ? (
              <>
                <Text style={s.priceComfortable} maxFontSizeMultiplier={1.3}>{formatPrice(bestPrice, { decimals: 0 })}</Text>
                {parfum.referencePrice && bestPrice < parfum.referencePrice && (
                  <Text style={s.priceRefComfortable}>{formatPrice(parfum.referencePrice, { decimals: 0 })}</Text>
                )}
              </>
            ) : (
              <Text style={s.priceComfortableMuted}>— €</Text>
            )}
          </View>
        </View>
      </Pressable>
    );
  }

  // ── Mode: compactPlus (grille 2 col dense) ──
  if (mode === 'compactPlus') {
    const a11yLabelCompact = [parfum.nom, parfum.marque, bestPrice !== null ? `${formatPrice(bestPrice, { decimals: 0 })}` : ''].filter(Boolean).join(', ');
    return (
      <Pressable
        style={s.cardCompactPlus}
        onPress={goToDetail}
        accessible={true}
        accessibilityLabel={a11yLabelCompact}
        accessibilityHint="Appuyez pour voir le détail du parfum"
        accessibilityRole="button"
      >
        {showImage ? (
          <View style={s.imgWrapCompactPlus}>
            <LinearGradient colors={gradientColors} style={s.imgBgFull} />
            <Image source={imageSource!} style={s.imgCompactPlus} contentFit="contain" transition={300} onError={handleImgError} />
            {discount !== null && <View style={s.dealBadgeCompactPlus}><Text style={s.dealBadgeTextCompactPlus}>-{discount}%</Text></View>}
            <FavButton parfum={parfum} size="sm" />
          </View>
        ) : (
          <View style={[s.imgPlaceholderCompactPlus, { backgroundColor: tint }]}>
            <Text style={s.placeholderInitCompactPlus}>{parfum.marque.charAt(0).toUpperCase()}</Text>
            <FavButton parfum={parfum} size="sm" />
          </View>
        )}
        <View style={s.bodyCompactPlus}>
          <Text style={s.brandCompactPlus} numberOfLines={1}>{parfum.marque}</Text>
          <Text style={s.titleCompactPlus} numberOfLines={1} ellipsizeMode="tail" maxFontSizeMultiplier={1.3}>{parfum.nom}</Text>
          {parfum.familleOlactive ? (
            <View style={s.tagsCompact}>
              <View style={s.tagFamily}><Text style={s.tagFamilyText}>{translateNote(parfum.familleOlactive)}</Text></View>
            </View>
          ) : (
            <View style={s.tagsCompact} />
          )}
          <View style={s.priceRowCompactPlus}>
            {priceTier && <View style={[s.priceDotSmall, { backgroundColor: theme.colors[priceTier] }]} />}
            {bestPrice !== null ? (
              <>
                <Text style={s.priceCompactPlus} maxFontSizeMultiplier={1.3}>{formatPrice(bestPrice, { decimals: 0 })}</Text>
                {parfum.referencePrice && bestPrice < parfum.referencePrice && (
                  <Text style={s.priceRefCompactPlus}>{formatPrice(parfum.referencePrice, { decimals: 0 })}</Text>
                )}
              </>
            ) : (
              <Text style={s.priceCompactPlusMuted}>— €</Text>
            )}
          </View>
        </View>
      </Pressable>
    );
  }

  // ── Mode: list ──
  if (mode === 'list') {
    const a11yLabelList = [parfum.nom, parfum.marque, bestPrice !== null ? `${formatPrice(bestPrice, { decimals: 0 })}` : ''].filter(Boolean).join(', ');
    return (
      <Pressable
        style={s.cardList}
        onPress={goToDetail}
        accessible={true}
        accessibilityLabel={a11yLabelList}
        accessibilityHint="Appuyez pour voir le détail du parfum"
        accessibilityRole="button"
      >
        {showImage ? (
          <View style={s.imgWrapList}>
            <LinearGradient colors={gradientColors} style={s.imgBgFull} />
            <Image source={imageSource!} style={s.imgList} contentFit="contain" transition={300} onError={handleImgError} />
            <FavButton parfum={parfum} size="xs" />
          </View>
        ) : (
          <View style={[s.imgPlaceholderList, { backgroundColor: tint }]}>
            <Text style={s.placeholderInitList}>{parfum.marque.charAt(0).toUpperCase()}</Text>
            <FavButton parfum={parfum} size="xs" />
          </View>
        )}
        <View style={s.bodyList}>
          <Text style={s.brandList} numberOfLines={1}>{parfum.marque}</Text>
          <Text style={s.titleList} numberOfLines={1} ellipsizeMode="tail" maxFontSizeMultiplier={1.3}>{parfum.nom}</Text>
          <View style={s.tagsList}>
            {parfum.familleOlactive ? (
              <View style={s.tagFamily}><Text style={s.tagFamilyText}>{translateNote(parfum.familleOlactive)}</Text></View>
            ) : null}
            {parfum.annee ? (
              <View style={s.tagYear}><Text style={s.tagYearText}>{parfum.annee}</Text></View>
            ) : null}
          </View>
        </View>
        <View style={s.priceColList}>
          <View style={s.priceRowList}>
            {priceTier && <View style={[s.priceDotSmall, { backgroundColor: theme.colors[priceTier] }]} />}
            {bestPrice !== null ? (
              <Text style={s.priceList} maxFontSizeMultiplier={1.3}>{formatPrice(bestPrice, { decimals: 0 })}</Text>
            ) : (
              <Text style={s.priceListMuted}>— €</Text>
            )}
          </View>
          {parfum.referencePrice && bestPrice && bestPrice < parfum.referencePrice && (
            <Text style={s.priceRefList}>{formatPrice(parfum.referencePrice, { decimals: 0 })}</Text>
          )}
        </View>
      </Pressable>
    );
  }

  return null;
}

function getStyles(t: Theme) {
  return {
    // ── Shared ──
    imgBgFull: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
    tagFamily: { backgroundColor: t.colors.primarySoft, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
    tagFamilyText: { fontSize: 10, fontFamily: 'Inter_500Medium', color: t.colors.primaryInk },
    tagYear: { backgroundColor: t.colors.rewardSoft, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
    tagYearText: { fontSize: 10, fontFamily: 'Inter_500Medium', color: t.colors.rewardInk },
    priceDot: { width: 8, height: 8, borderRadius: 4, marginRight: 4 },
    priceDotSmall: { width: 7, height: 7, borderRadius: 3.5, marginRight: 4 },

    // ── Compact (horizontal rows) ──
    cardCompact: {
      width: 140, borderRadius: t.radius.card, backgroundColor: t.colors.surface,
      overflow: 'hidden', ...t.shadow.card, marginBottom: 2,
    },
    imgWrapCompact: { position: 'relative', height: 186, overflow: 'hidden', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.colors.border },
    imgCompact: { width: '100%', height: '100%', backgroundColor: t.colors.surface },
    imgPlaceholderCompact: { position: 'relative', width: '100%', height: 186, justifyContent: 'center', alignItems: 'center' },
    placeholderInitCompact: { fontSize: 48, fontFamily: 'Inter_700Bold', color: '#FFFFFF', opacity: 0.5 },
    dealBadgeCompact: { position: 'absolute', top: 8, left: 8, backgroundColor: t.colors.deal, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6 },
    dealBadgeTextCompact: { color: textOn(t.colors.deal), fontFamily: 'Inter_600SemiBold', fontSize: 10 },
    headerCompact: { padding: 10, paddingBottom: 2 },
    brandCompact: { fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, color: t.colors.textMuted, fontFamily: 'Inter_400Regular' },
    titleCompact: { fontFamily: 'PlayfairDisplay_600SemiBold', fontSize: 14, color: t.colors.text, lineHeight: 18 },
    priceRowCompact: { flexDirection: 'row', alignItems: 'baseline', paddingHorizontal: 10, paddingBottom: 10, gap: 4 },
    priceCompact: { fontFamily: 'Inter_700Bold', fontSize: 14, color: t.colors.text },
    priceRefCompact: { fontFamily: 'Inter_400Regular', fontSize: 11, color: t.colors.textMuted, textDecorationLine: 'line-through' },
    priceCompactMuted: { fontFamily: 'Inter_400Regular', fontSize: 14, color: t.colors.textMuted },

    // ── Comfortable (grid 2 col) ──
    cardComfortable: {
      borderRadius: t.radius.card, backgroundColor: t.colors.surface,
      overflow: 'hidden', borderWidth: 1, borderColor: t.colors.border, ...t.shadow.card,
    },
    imgWrapComfortable: { position: 'relative', aspectRatio: 3/4, overflow: 'hidden', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.colors.border },
    imgComfortable: { width: '100%', height: '100%', backgroundColor: t.colors.surface },
    imgPlaceholderComfortable: { position: 'relative', aspectRatio: 3/4, justifyContent: 'center', alignItems: 'center' },
    placeholderInitComfortable: { fontSize: 56, fontFamily: 'Inter_700Bold', color: '#FFFFFF', opacity: 0.5 },
    dealBadge: { position: 'absolute', top: 8, left: 8, backgroundColor: t.colors.deal, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
    dealBadgeText: { color: textOn(t.colors.deal), fontFamily: 'Inter_600SemiBold', fontSize: 11 },
    bodyComfortable: { padding: 10 },
    brandComfortable: { fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.5, color: t.colors.textMuted, fontFamily: 'Inter_400Regular', marginBottom: 2 },
    titleComfortable: { fontFamily: 'PlayfairDisplay_600SemiBold', fontSize: 16, color: t.colors.text, lineHeight: 19, marginBottom: 6 },
    tags: { flexDirection: 'row', gap: 5, flexWrap: 'wrap', marginBottom: 4 },
    notesText: { fontSize: 11, color: t.colors.textMuted, fontFamily: 'Inter_400Regular', marginBottom: 6 },
    priceRowComfortable: { flexDirection: 'row', alignItems: 'baseline', gap: 0 },
    priceComfortable: { fontFamily: 'Inter_700Bold', fontSize: 17, color: t.colors.text },
    priceRefComfortable: { fontFamily: 'Inter_400Regular', fontSize: 11, color: t.colors.textMuted, textDecorationLine: 'line-through', marginLeft: 4 },
    priceComfortableMuted: { fontFamily: 'Inter_400Regular', fontSize: 17, color: t.colors.textMuted },

    // ── CompactPlus (grid dense) ──
    cardCompactPlus: {
      borderRadius: t.radius.base, backgroundColor: t.colors.surface,
      overflow: 'hidden', borderWidth: 1, borderColor: t.colors.border,
    },
    imgWrapCompactPlus: { position: 'relative', height: 90, overflow: 'hidden', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.colors.border },
    imgCompactPlus: { width: '100%', height: '100%', backgroundColor: t.colors.surface },
    imgPlaceholderCompactPlus: { position: 'relative', width: '100%', height: 90, justifyContent: 'center', alignItems: 'center' },
    placeholderInitCompactPlus: { fontSize: 32, fontFamily: 'Inter_700Bold', color: '#FFFFFF', opacity: 0.5 },
    dealBadgeCompactPlus: { position: 'absolute', top: 4, left: 4, backgroundColor: t.colors.deal, paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4 },
    dealBadgeTextCompactPlus: { color: textOn(t.colors.deal), fontFamily: 'Inter_600SemiBold', fontSize: 9 },
    bodyCompactPlus: { padding: 8 },
    tagsCompact: { flexDirection: 'row', gap: 4, marginBottom: 5, minHeight: 18 },
    brandCompactPlus: { fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.8, color: t.colors.textMuted, fontFamily: 'Inter_400Regular' },
    titleCompactPlus: { fontFamily: 'PlayfairDisplay_600SemiBold', fontSize: 13, color: t.colors.text, lineHeight: 16, marginBottom: 6 },
    priceRowCompactPlus: { flexDirection: 'row', alignItems: 'baseline' },
    priceCompactPlus: { fontFamily: 'Inter_700Bold', fontSize: 14, color: t.colors.text },
    priceRefCompactPlus: { fontFamily: 'Inter_400Regular', fontSize: 10, color: t.colors.textMuted, textDecorationLine: 'line-through', marginLeft: 3 },
    priceCompactPlusMuted: { fontFamily: 'Inter_400Regular', fontSize: 14, color: t.colors.textMuted },

    // ── List ──
    cardList: {
      flexDirection: 'row', alignItems: 'center',
      borderRadius: t.radius.base, backgroundColor: t.colors.surface,
      padding: 10, gap: 12,
      borderWidth: 1, borderColor: t.colors.border, ...t.shadow.card,
    },
    imgWrapList: { width: 56, height: 74, borderRadius: t.radius.sm, overflow: 'hidden' },
    imgList: { width: '100%', height: '100%', backgroundColor: t.colors.surface },
    imgPlaceholderList: { position: 'relative', width: 56, height: 74, borderRadius: t.radius.sm, justifyContent: 'center', alignItems: 'center' },
    placeholderInitList: { fontSize: 24, fontFamily: 'Inter_700Bold', color: '#FFFFFF', opacity: 0.5 },
    bodyList: { flex: 1, minWidth: 0 },
    brandList: { fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, color: t.colors.textMuted, fontFamily: 'Inter_400Regular' },
    titleList: { fontFamily: 'PlayfairDisplay_600SemiBold', fontSize: 15, color: t.colors.text, marginBottom: 4 },
    tagsList: { flexDirection: 'row', gap: 4, flexWrap: 'wrap' },
    priceColList: { alignItems: 'flex-end', flexShrink: 0 },
    priceRowList: { flexDirection: 'row', alignItems: 'baseline' },
    priceList: { fontFamily: 'Inter_700Bold', fontSize: 16, color: t.colors.text },
    priceListMuted: { fontFamily: 'Inter_400Regular', fontSize: 16, color: t.colors.textMuted },
    priceRefList: { fontFamily: 'Inter_400Regular', fontSize: 11, color: t.colors.textMuted, textDecorationLine: 'line-through', marginTop: 2 },

  } as const;
}
