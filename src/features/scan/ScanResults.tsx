// src/features/scan/ScanResults.tsx — Révélation : top match en héros + autres correspondances

import { useMemo } from 'react';
import { View, Text, FlatList, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import Animated, { FadeIn, FadeInDown, useReducedMotion } from 'react-native-reanimated';
import Ionicons from '@react-native-vector-icons/ionicons/static';
import ParfumCard from '../../components/ParfumCard';
import { setPendingParfum } from '../../services/catalog-bridge';
import { useTheme, type Theme } from '../../theme/ThemeContext';
import { textOn } from '../../utils/contrast';
import { formatPrice } from '../../utils/format-price';
import { tintLuminous } from '../../utils/alpha';
import { scanChip, scanReadLine } from '../../utils/scan-display';
import type { Parfum, ScanResult } from '../../models';

interface Props {
  parfums: Parfum[];
  confidence?: 'high' | 'low';
  read?: ScanResult | null;
  onOpenCatalog: () => void;
  onRescan: () => void;
}

export function ScanResults({ parfums, confidence = 'high', read, onOpenCatalog, onRescan }: Props) {
  const { theme, resolvedMode } = useTheme();
  const s = useMemo(() => getStyles(theme), [theme]);
  const router = useRouter();
  const reduced = useReducedMotion();
  const isLow = confidence === 'low';

  const top = parfums[0];
  const rest = useMemo(() => parfums.slice(1), [parfums]);

  // Chip + ligne « Lu/Hypothèse » résolus par l'utilitaire pur (testé).
  const chip = useMemo(() => scanChip(confidence, read), [confidence, read]);
  const readLine = useMemo(() => scanReadLine(read, top), [read, top]);

  const handleParfumPress = (parfum: Parfum) => {
    setPendingParfum(parfum);
    router.dismissTo('/(tabs)');
  };

  if (!top) return null;

  const priceColor =
    top.priceValue === 'deal' ? theme.colors.deal
    : top.priceValue === 'overpriced' ? theme.colors.overpriced
    : top.priceValue === 'fair' ? theme.colors.fair
    : theme.colors.text;
  const hasRef = top.referencePrice != null && top.bestPrice != null && top.referencePrice > top.bestPrice;

  const hero = (
    <Animated.View entering={reduced ? undefined : FadeIn.duration(300)}>
      <Pressable onPress={() => handleParfumPress(top)} accessibilityRole="button" accessibilityLabel={`${top.marque} ${top.nom}`}>
        <View style={s.imgZone}>
          <View style={s.veilWrap}>
            <View style={[s.veilOuter, { backgroundColor: tintLuminous(theme.colors.primary, 'hint', resolvedMode) }]} />
          </View>
          <View style={s.veilWrap}>
            <View style={[s.veilInner, { backgroundColor: tintLuminous(theme.colors.primary, 'veil', resolvedMode) }]} />
          </View>
          {top.imageUrl ? (
            <Image source={{ uri: top.imageUrl }} style={s.heroImg} contentFit="contain" transition={250} />
          ) : (
            <View style={[s.heroImg, s.heroImgEmpty]}>
              <Ionicons name="flask-outline" size={48} color={theme.colors.textMuted} />
            </View>
          )}
        </View>

        <View style={s.heroText}>
          <View style={[s.chip, { backgroundColor: chip.tone === 'fair' ? theme.colors.fairSoft : theme.colors.dealSoft }]}>
            <Ionicons name={chip.icon as never} size={13} color={chip.tone === 'fair' ? theme.colors.fairInk : theme.colors.dealInk} style={{ marginRight: 5 }} />
            <Text style={[s.chipText, { color: chip.tone === 'fair' ? theme.colors.fairInk : theme.colors.dealInk }]}>
              {chip.label}
            </Text>
          </View>
          {readLine ? <Text style={s.readLine}>{readLine.prefix}{readLine.text}</Text> : null}
          <Text style={s.overline}>{top.marque}</Text>
          <Text style={s.heroName}>{top.nom}</Text>
          {top.bestPrice != null && (
            <View style={s.priceRow}>
              <Text style={[s.heroPrice, { color: priceColor }]}>{formatPrice(top.bestPrice, { decimals: 0 })}</Text>
              {hasRef && <Text style={s.refPrice}>{formatPrice(top.referencePrice!, { decimals: 0 })}</Text>}
            </View>
          )}
        </View>
      </Pressable>

      {isLow && (
        <Pressable onPress={onRescan} style={s.retakeBtn} accessibilityRole="button" accessibilityLabel="Reprendre la photo">
          <Ionicons name="camera-outline" size={15} color={theme.colors.textMuted} style={{ marginRight: 6 }} />
          <Text style={s.retakeText}>Ce n'est pas ça ? Reprends la photo</Text>
        </Pressable>
      )}
    </Animated.View>
  );

  const othersHeader = rest.length > 0 && (
    <View style={s.othersHead}>
      <Text style={s.othersLabel}>Autres correspondances</Text>
      <View style={s.othersCount}><Text style={s.othersCountText}>{rest.length}</Text></View>
    </View>
  );

  return (
    <View style={s.container}>
      <FlatList<Parfum>
        data={rest}
        keyExtractor={(p, i) => `${p.id}_${i}`}
        extraData={resolvedMode}
        renderItem={({ item, index }) => (
          <Animated.View entering={reduced ? undefined : FadeInDown.delay(160 + index * 70).duration(260)}>
            <ParfumCard parfum={item} mode="list" onPressOverride={() => handleParfumPress(item)} />
          </Animated.View>
        )}
        ListHeaderComponent={
          <>
            {hero}
            {othersHeader}
          </>
        }
        ListFooterComponent={
          <View style={s.footer}>
            <Pressable style={s.rescanBtn} onPress={onRescan} accessibilityRole="button" accessibilityLabel="Scanner un autre flacon">
              <Ionicons name="scan-outline" size={20} color={textOn(theme.colors.primary)} style={{ marginRight: 8 }} />
              <Text style={s.rescanText}>Scanner un autre flacon</Text>
            </Pressable>
            <Pressable style={s.catalogBtn} onPress={onOpenCatalog} hitSlop={8}>
              <Text style={s.catalogText}>Voir plus dans le catalogue</Text>
            </Pressable>
          </View>
        }
        contentContainerStyle={s.list}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

function getStyles(t: Theme) {
  return {
    container: { flex: 1, backgroundColor: t.colors.background },
    list: { paddingBottom: 8 },

    imgZone: { alignItems: 'center', justifyContent: 'center', paddingTop: 28, paddingBottom: 8 },
    veilWrap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center' },
    veilOuter: { width: 250, height: 250, borderRadius: 125 },
    veilInner: { width: 170, height: 170, borderRadius: 85 },
    heroImg: { width: 210, height: 250 },
    heroImgEmpty: { justifyContent: 'center', alignItems: 'center' },

    heroText: { paddingHorizontal: 24, alignItems: 'flex-start' },
    chip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, marginBottom: 10 },
    chipText: { fontFamily: 'Inter_600SemiBold', fontSize: 11, letterSpacing: 0.3 },
    readLine: { fontFamily: 'Inter_400Regular', fontSize: 11, color: t.colors.textMuted, marginBottom: 6 },
    overline: { fontFamily: 'Inter_400Regular', fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: t.colors.textMuted, marginBottom: 2 },
    heroName: { fontFamily: 'PlayfairDisplay_600SemiBold', fontSize: 26, color: t.colors.text, marginBottom: 6 },
    priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
    heroPrice: { fontFamily: 'Inter_800ExtraBold', fontSize: 22, fontVariant: ['tabular-nums'] as import('react-native').FontVariant[] },
    refPrice: { fontFamily: 'Inter_400Regular', fontSize: 14, color: t.colors.textMuted, textDecorationLine: 'line-through', fontVariant: ['tabular-nums'] as import('react-native').FontVariant[] },

    retakeBtn: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 14, marginHorizontal: 24, paddingVertical: 10, borderRadius: 20, backgroundColor: t.colors.surface2, borderWidth: 1, borderColor: t.colors.border },
    retakeText: { fontFamily: 'Inter_500Medium', fontSize: 13, color: t.colors.textMuted },

    othersHead: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, marginTop: 22, marginBottom: 6 },
    othersLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 13, letterSpacing: 0.8, textTransform: 'uppercase', color: t.colors.textMuted },
    othersCount: { backgroundColor: t.colors.surface2, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 1 },
    othersCountText: { fontFamily: 'Inter_700Bold', fontSize: 11, color: t.colors.textMuted, fontVariant: ['tabular-nums'] as import('react-native').FontVariant[] },

    footer: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 16, gap: 10, alignItems: 'center' },
    rescanBtn: { flexDirection: 'row', backgroundColor: t.colors.primary, borderRadius: t.radius.base, height: 48, paddingHorizontal: 24, justifyContent: 'center', alignItems: 'center', ...t.shadow.button },
    rescanText: { color: textOn(t.colors.primary), fontFamily: 'Inter_600SemiBold', fontSize: 15 },
    catalogBtn: { paddingVertical: 6, paddingHorizontal: 12 },
    catalogText: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: t.colors.primary },
  } as const;
}
