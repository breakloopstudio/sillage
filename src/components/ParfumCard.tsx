// src/components/ParfumCard.tsx — Carte parfum réutilisable (4 modes)
// carousel (rangées horizontales), comfortable (grille 2 col), compactPlus (grille dense), list

import { useMemo, useState, useCallback, memo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useTheme, type Theme } from '../theme/ThemeContext';
import type { Parfum } from '../models';
import { setPendingParfum } from '../services/catalog-bridge';
import { translateNote } from '../utils/translate-note';
import { getFamilyByValue } from '../utils/olfactory-families';
import { genderLabel, genderIcons, communityRatingLabel, type GenderIcon } from '../utils/parfum-labels';
import { textOn } from '../utils/contrast';
import { formatPrice } from '../utils/format-price';
import FavButton from './FavButton';
import Ionicons from '@react-native-vector-icons/ionicons/static';
import { statusChipMeta, type StatusChipId } from '../utils/status-chips';
import { formatVariation } from '../utils/price-alerts';
import type { UserParfumStatus } from '../models/user-parfum.interface';

export type CardMode = 'carousel' | 'comfortable' | 'compactPlus' | 'list';

type CardChip =
  | { kind: 'family'; label: string }
  | { kind: 'neutral'; label: string }
  | { kind: 'note'; value: string }
  | { kind: 'gender'; icons: GenderIcon[] }
  | { kind: 'social'; count: number };

interface Props {
  parfum: Parfum;
  mode?: CardMode;
  onPressOverride?: () => void;
  onLongPress?: () => void;
  status?: UserParfumStatus | null;
  rating?: number | null;
  hidePrice?: boolean;
  /** Preuve sociale communautaire — chip « ♥ n » (gaté ≥3 interne). Passé depuis Communauté uniquement. */
  socialLoves?: number;
  /** Alerte prix active — badge 🔔 + variation depuis l'activation. */
  priceAlert?: { variation: number | null } | null;
}

function getDiscount(p: Parfum): number | null {
  if (typeof p.referencePrice === 'number' && p.referencePrice > 0 && typeof p.bestPrice === 'number') {
    const d = Math.round((1 - p.bestPrice / p.referencePrice) * 100);
    return d >= 10 ? d : null;
  }
  return null;
}

import { priceTier } from '../utils/price-tier';
import { brandColor } from '../utils/brand-color';

function resolveImageUrl(p: Parfum): string | null {
  return p.imageUrl ?? null;
}

function ParfumCard({ parfum, mode = 'comfortable', onPressOverride, onLongPress, status, rating, hidePrice = false, socialLoves, priceAlert = null }: Props) {
  const { theme } = useTheme();
  const s = useMemo(() => getStyles(theme), [theme]);
  const router = useRouter();
  const [imgFailed, setImgFailed] = useState(false);

  const discount = hidePrice ? null : getDiscount(parfum);
  const tier = priceTier(parfum.bestPrice, parfum.referencePrice);
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

  const statusMeta = status != null ? statusChipMeta(status) : null;
  const showRating = typeof rating === 'number' && rating > 0;
  const alertVariation = priceAlert?.variation ?? null;
  const showAlert = priceAlert != null;
  const alertIsDrop = alertVariation != null && alertVariation < 0;

  const familyLabel = getFamilyByValue(parfum.familleOlactive)?.label ?? (parfum.familleOlactive ? translateNote(parfum.familleOlactive) : null);
  const genderVal = genderLabel(parfum.gender);
  const genderIc = genderIcons(parfum.gender);
  const commuRating = communityRatingLabel(parfum);
  const showCommu = commuRating !== null && !showRating;
  const showSocial = typeof socialLoves === 'number' && socialLoves >= 3;

  const baseChips: CardChip[] = [
    showSocial ? { kind: 'social', count: socialLoves as number } : null,
    familyLabel ? { kind: 'family', label: familyLabel } : null,
    showCommu ? { kind: 'note', value: commuRating! } : null,
    genderIc.length > 0 ? { kind: 'gender', icons: genderIc } : null,
  ].filter(Boolean) as CardChip[];

  const renderChip = (c: CardChip, i: number) => {
    if (c.kind === 'family') {
      return (
        <View key={`c${i}`} style={s.tagFamily}>
          <Text style={s.tagFamilyText} allowFontScaling={false}>{c.label}</Text>
        </View>
      );
    }
    if (c.kind === 'note') {
      return (
        <View key={`c${i}`} style={s.tagNote}>
          <Ionicons name="star" size={9} color={theme.colors.textMuted} />
          <Text style={s.tagNoteValue} allowFontScaling={false}>{c.value}</Text>
        </View>
      );
    }
    if (c.kind === 'gender') {
      return (
        <View key={`c${i}`} style={s.tagGender}>
          {c.icons.map((ic, j) => (
            <Ionicons key={j} name={ic} size={11} color={theme.colors.textMuted} />
          ))}
        </View>
      );
    }
    if (c.kind === 'social') {
      return (
        <View key={`c${i}`} style={s.tagSocial}>
          <Ionicons name="heart" size={9} color={theme.colors.favorite} accessible={false} />
          <Text style={s.tagSocialText} allowFontScaling={false}>{c.count}</Text>
        </View>
      );
    }
    return (
      <View key={`c${i}`} style={s.tagNeutral}>
        <Text style={s.tagNeutralText} allowFontScaling={false}>{c.label}</Text>
      </View>
    );
  };

  const renderBadges = () => {
    if (!statusMeta && !showRating && !showAlert) return null;
    const bs = statusMeta ? s.statusColors[statusMeta.id] : null;
    const alertBg = alertIsDrop ? theme.colors.dealSoft : theme.colors.primarySoft;
    const alertInk = alertIsDrop ? theme.colors.dealInk : theme.colors.primaryInk;
    return (
      <View style={s.statusRow}>
        {statusMeta && bs ? (
          <View style={[s.statusBadge, { backgroundColor: bs.bg }]}>
            <Ionicons name={statusMeta.icon as never} size={10} color={bs.color} />
            <Text style={[s.statusBadgeText, { color: bs.color }]} allowFontScaling={false}>{statusMeta.label}</Text>
          </View>
        ) : null}
        {showRating ? (
          <View style={[s.statusBadge, { backgroundColor: theme.colors.secondarySoft }]}>
            <Ionicons name="star" size={10} color={theme.colors.secondaryInk} />
            <Text style={[s.statusBadgeText, { color: theme.colors.secondaryInk }]} allowFontScaling={false}>{rating}</Text>
          </View>
        ) : null}
        {showAlert ? (
          <View style={[s.statusBadge, { backgroundColor: alertBg }]}>
            <Ionicons name="notifications" size={10} color={alertInk} />
            {alertVariation != null ? (
              <Text style={[s.statusBadgeText, { color: alertInk }]} allowFontScaling={false}>{formatVariation(alertVariation)}</Text>
            ) : null}
          </View>
        ) : null}
      </View>
    );
  };

  // ── Mode: carousel (rangées horizontales) ──
  if (mode === 'carousel') {
    const a11yLabelCarousel = [parfum.nom, parfum.marque, familyLabel, genderVal, showSocial ? `aimé par ${socialLoves} nez` : null, showCommu ? `note ${commuRating} sur 5` : null, bestPrice !== null ? formatPrice(bestPrice, { decimals: 0 }) : '', parfum.referencePrice && bestPrice && bestPrice < parfum.referencePrice ? `au lieu de ${formatPrice(parfum.referencePrice, { decimals: 0 })}` : ''].filter(Boolean).join(', ');
    return (
      <Pressable style={s.cardCarousel} onPress={goToDetail} onLongPress={onLongPress} delayLongPress={400} accessible={true} accessibilityLabel={a11yLabelCarousel} accessibilityHint="Appuyez pour voir le détail du parfum" accessibilityRole="button">
        {showImage ? (
          <View style={s.imgWrapCarousel}>
            <LinearGradient colors={gradientColors} style={s.imgBgFull} />
            <Image source={imageSource!} style={s.imgCarousel} contentFit="contain" transition={300} cachePolicy="memory-disk" recyclingKey={parfum.id} onError={handleImgError} />
            {discount !== null && <View style={s.dealBadgeCarousel}><Text style={s.dealBadgeTextCarousel}>{`−${discount} %`}</Text></View>}
            <FavButton parfum={parfum} size="sm" />
          </View>
        ) : (
          <View style={[s.imgPlaceholderCarousel, { backgroundColor: tint }]}>
            <Text style={s.placeholderInitCarousel}>{parfum.marque.charAt(0).toUpperCase()}</Text>
            <FavButton parfum={parfum} size="sm" />
          </View>
        )}
        <View style={s.headerCarousel}>
          <Text style={s.brandCarousel} numberOfLines={1}>{parfum.marque}</Text>
          <Text style={s.titleCarousel} numberOfLines={2} ellipsizeMode="tail" maxFontSizeMultiplier={1.3}>{parfum.nom}</Text>
        </View>
        {baseChips.length > 0 ? (
          <View style={s.tagsCarousel}>{baseChips.map(renderChip)}</View>
        ) : null}
        {!hidePrice ? (<View style={s.priceRowCarousel}>
          {tier && <View style={[s.priceDotSmall, { backgroundColor: theme.colors[tier] }]} />}
          {bestPrice !== null ? (
            <>
              <Text style={s.priceCarousel}>{formatPrice(bestPrice, { decimals: 0 })}</Text>
              {parfum.referencePrice && bestPrice < parfum.referencePrice && (
                <Text style={s.priceRefCarousel}>{formatPrice(parfum.referencePrice, { decimals: 0 })}</Text>
              )}
            </>
          ) : (
            <Text style={s.priceCarouselMuted}>— €</Text>
          )}
        </View>) : null}
      </Pressable>
    );
  }

  // ── Mode: comfortable (grille 2 col, défaut) ──
  if (mode === 'comfortable') {
    const a11yLabel = [parfum.nom, parfum.marque, familyLabel, genderVal, showCommu ? `note ${commuRating} sur 5` : null, bestPrice !== null ? `${formatPrice(bestPrice, { decimals: 0 })}` : '', parfum.referencePrice && bestPrice && bestPrice < parfum.referencePrice ? `au lieu de ${formatPrice(parfum.referencePrice, { decimals: 0 })}` : ''].filter(Boolean).join(', ');
    const chips = baseChips;
    return (
      <Pressable
        style={s.cardComfortable}
        onPress={goToDetail}
        onLongPress={onLongPress}
        delayLongPress={400}
        accessible={true}
        accessibilityLabel={a11yLabel}
        accessibilityHint="Appuyez pour voir le détail du parfum"
        accessibilityRole="button"
      >
        {showImage ? (
          <View style={s.imgWrapComfortable}>
            <LinearGradient colors={gradientColors} style={s.imgBgFull} />
            <Image source={imageSource!} style={s.imgComfortable} contentFit="contain" transition={300} cachePolicy="memory-disk" recyclingKey={parfum.id} onError={handleImgError} />
            {discount !== null && <View style={s.dealBadge}><Text style={s.dealBadgeText}>{`−${discount} %`}</Text></View>}
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
          {renderBadges()}
          {chips.length > 0 ? (
            <View style={s.tags}>{chips.map(renderChip)}</View>
          ) : null}
          {parfum.notesTete?.length > 0 && (
            <Text style={s.notesText} numberOfLines={1}>{parfum.notesTete!.slice(0, 3).map(translateNote).join(' · ')}</Text>
          )}
          {!hidePrice ? (<View style={s.priceRowComfortable}>
            {tier && <View style={[s.priceDot, { backgroundColor: theme.colors[tier] }]} />}
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
          </View>) : null}
        </View>
      </Pressable>
    );
  }

  // ── Mode: compactPlus (grille 2 col dense) ──
  if (mode === 'compactPlus') {
    const a11yLabelCompactPlus = [parfum.nom, parfum.marque, familyLabel, genderVal, showCommu ? `note ${commuRating} sur 5` : null, bestPrice !== null ? `${formatPrice(bestPrice, { decimals: 0 })}` : ''].filter(Boolean).join(', ');
    const chips = baseChips;
    return (
      <Pressable
        style={s.cardCompactPlus}
        onPress={goToDetail}
        onLongPress={onLongPress}
        delayLongPress={400}
        accessible={true}
        accessibilityLabel={a11yLabelCompactPlus}
        accessibilityHint="Appuyez pour voir le détail du parfum"
        accessibilityRole="button"
      >
        {showImage ? (
          <View style={s.imgWrapCompactPlus}>
            <LinearGradient colors={gradientColors} style={s.imgBgFull} />
            <Image source={imageSource!} style={s.imgCompactPlus} contentFit="contain" transition={300} cachePolicy="memory-disk" recyclingKey={parfum.id} onError={handleImgError} />
            {discount !== null && <View style={s.dealBadgeCompactPlus}><Text style={s.dealBadgeTextCompactPlus}>{`−${discount} %`}</Text></View>}
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
          {renderBadges()}
          <View style={s.tagsCompact}>{chips.map(renderChip)}</View>
          {!hidePrice ? (<View style={s.priceRowCompactPlus}>
            {tier && <View style={[s.priceDotSmall, { backgroundColor: theme.colors[tier] }]} />}
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
          </View>) : null}
        </View>
      </Pressable>
    );
  }

  // ── Mode: list ──
  if (mode === 'list') {
    const a11yLabelList = [parfum.nom, parfum.marque, familyLabel, parfum.annee ? String(parfum.annee) : null, genderVal, showSocial ? `aimé par ${socialLoves} nez` : null, showCommu ? `note ${commuRating} sur 5` : null, bestPrice !== null ? `${formatPrice(bestPrice, { decimals: 0 })}` : ''].filter(Boolean).join(', ');
    const chips: CardChip[] = [
      showSocial ? { kind: 'social', count: socialLoves as number } : null,
      familyLabel ? { kind: 'family', label: familyLabel } : null,
      parfum.annee ? { kind: 'neutral', label: String(parfum.annee) } : null,
      genderIc.length > 0 ? { kind: 'gender', icons: genderIc } : null,
      showCommu ? { kind: 'note', value: commuRating! } : null,
    ].filter(Boolean) as CardChip[];
    return (
      <Pressable
        style={s.cardList}
        onPress={goToDetail}
        onLongPress={onLongPress}
        delayLongPress={400}
        accessible={true}
        accessibilityLabel={a11yLabelList}
        accessibilityHint="Appuyez pour voir le détail du parfum"
        accessibilityRole="button"
      >
        {showImage ? (
          <View style={s.imgWrapList}>
            <LinearGradient colors={gradientColors} style={s.imgBgFull} />
            <Image source={imageSource!} style={s.imgList} contentFit="contain" transition={300} cachePolicy="memory-disk" recyclingKey={parfum.id} onError={handleImgError} />
          </View>
        ) : (
          <View style={[s.imgPlaceholderList, { backgroundColor: tint }]}>
            <Text style={s.placeholderInitList}>{parfum.marque.charAt(0).toUpperCase()}</Text>
          </View>
        )}
        <View style={s.bodyList}>
          <Text style={s.brandList} numberOfLines={1}>{parfum.marque}</Text>
          <Text style={s.titleList} numberOfLines={1} ellipsizeMode="tail" maxFontSizeMultiplier={1.3}>{parfum.nom}</Text>
          {renderBadges()}
          {chips.length > 0 ? (
            <View style={s.tagsList}>{chips.map(renderChip)}</View>
          ) : null}
        </View>
        <View style={s.trailingList}>
          <FavButton parfum={parfum} inline />
          {!hidePrice ? (<View style={s.priceColList}>
            <View style={s.priceRowList}>
              {tier && <View style={[s.priceDotSmall, { backgroundColor: theme.colors[tier] }]} />}
              {bestPrice !== null ? (
                <Text style={s.priceList} maxFontSizeMultiplier={1.3}>{formatPrice(bestPrice, { decimals: 0 })}</Text>
              ) : (
                <Text style={s.priceListMuted}>— €</Text>
              )}
            </View>
            {parfum.referencePrice && bestPrice && bestPrice < parfum.referencePrice && (
              <Text style={s.priceRefList}>{formatPrice(parfum.referencePrice, { decimals: 0 })}</Text>
            )}
          </View>) : null}
        </View>
      </Pressable>
    );
  }

  return null;
}

function arePropsEqual(prev: Props, next: Props): boolean {
  return (
    prev.parfum.id === next.parfum.id &&
    prev.parfum.nom === next.parfum.nom &&
    prev.parfum.marque === next.parfum.marque &&
    prev.parfum.imageUrl === next.parfum.imageUrl &&
    prev.parfum.bestPrice === next.parfum.bestPrice &&
    prev.parfum.referencePrice === next.parfum.referencePrice &&
    prev.parfum.familleOlactive === next.parfum.familleOlactive &&
    prev.parfum.annee === next.parfum.annee &&
    prev.parfum.gender === next.parfum.gender &&
    prev.parfum.ratingScore === next.parfum.ratingScore &&
    prev.mode === next.mode &&
    prev.status === next.status &&
    prev.rating === next.rating &&
    prev.hidePrice === next.hidePrice &&
    prev.socialLoves === next.socialLoves &&
    (prev.priceAlert?.variation ?? null) === (next.priceAlert?.variation ?? null)
  );
}

export default memo(ParfumCard, arePropsEqual);

function getStyles(t: Theme) {
  return {
    // ── Shared ──
    imgBgFull: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
    tagFamily: { backgroundColor: t.colors.primarySoft, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
    tagFamilyText: { fontSize: 10, fontFamily: 'Inter_500Medium', color: t.colors.primaryInk },
    tagNeutral: { backgroundColor: t.colors.surface2, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
    tagNeutralText: { fontSize: 10, fontFamily: 'Inter_500Medium', color: t.colors.textMuted },
    tagNote: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: t.colors.surface2, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
    tagNoteValue: { fontSize: 10, fontFamily: 'Inter_600SemiBold', color: t.colors.text, fontVariant: ['tabular-nums'] as import('react-native').FontVariant[] },
    tagSocial: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: t.colors.favoriteSoft, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
    tagSocialText: { fontSize: 10, fontFamily: 'Inter_600SemiBold', color: t.colors.favorite, fontVariant: ['tabular-nums'] as import('react-native').FontVariant[] },
    tagGender: { flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: t.colors.surface2, paddingHorizontal: 7, paddingVertical: 4, borderRadius: 20 },
    priceDot: { width: 8, height: 8, borderRadius: 4, marginRight: 4 },
    priceDotSmall: { width: 7, height: 7, borderRadius: 3.5, marginRight: 4 },

    // ── Status / rating badges (body) ──
    statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginBottom: 4 },
    statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
    statusBadgeText: { fontSize: 10, fontFamily: 'Inter_600SemiBold' },
    statusColors: {
      to_try: { bg: t.colors.fairSoft, color: t.colors.fairInk },
      have: { bg: t.colors.dealSoft, color: t.colors.dealInk },
      had: { bg: t.colors.surface2, color: t.colors.textMuted },
    } as Record<StatusChipId, { bg: string; color: string }>,

    // ── Carousel (horizontal rows) ──
    cardCarousel: {
      width: 140, borderRadius: t.radius.card, backgroundColor: t.colors.surface,
      overflow: 'hidden', ...t.shadow.card, marginBottom: 2,
    },
    imgWrapCarousel: { position: 'relative', height: 186, overflow: 'hidden', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.colors.border },
    imgCarousel: { width: '100%', height: '100%', backgroundColor: t.colors.surface },
    imgPlaceholderCarousel: { position: 'relative', width: '100%', height: 186, justifyContent: 'center', alignItems: 'center' },
    placeholderInitCarousel: { fontSize: 48, fontFamily: 'Inter_700Bold', color: '#FFFFFF', opacity: 0.5 },
    dealBadgeCarousel: { position: 'absolute', top: 8, left: 8, backgroundColor: t.colors.deal, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6 },
    dealBadgeTextCarousel: { color: textOn(t.colors.deal), fontFamily: 'Inter_600SemiBold', fontSize: 10 },
    headerCarousel: { padding: 10, paddingBottom: 2 },
    brandCarousel: { fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, color: t.colors.textMuted, fontFamily: 'Inter_400Regular' },
    titleCarousel: { fontFamily: 'PlayfairDisplay_600SemiBold', fontSize: 14, color: t.colors.text, lineHeight: 18 },
    tagsCarousel: { flexDirection: 'row', gap: 4, flexWrap: 'wrap', paddingHorizontal: 10, marginTop: 4, marginBottom: 2 },
    priceRowCarousel: { flexDirection: 'row', alignItems: 'baseline', paddingHorizontal: 10, paddingBottom: 10, gap: 4 },
    priceCarousel: { fontFamily: 'Inter_700Bold', fontSize: 14, color: t.colors.text },
    priceRefCarousel: { fontFamily: 'Inter_400Regular', fontSize: 11, color: t.colors.textMuted, textDecorationLine: 'line-through' },
    priceCarouselMuted: { fontFamily: 'Inter_400Regular', fontSize: 14, color: t.colors.textMuted },

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
    trailingList: { flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'center', gap: 8, flexShrink: 0 },
    priceRowList: { flexDirection: 'row', alignItems: 'baseline' },
    priceList: { fontFamily: 'Inter_700Bold', fontSize: 16, color: t.colors.text },
    priceListMuted: { fontFamily: 'Inter_400Regular', fontSize: 16, color: t.colors.textMuted },
    priceRefList: { fontFamily: 'Inter_400Regular', fontSize: 11, color: t.colors.textMuted, textDecorationLine: 'line-through', marginTop: 2 },

  } as const;
}
