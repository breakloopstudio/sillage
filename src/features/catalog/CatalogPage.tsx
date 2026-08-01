// src/features/catalog/CatalogPage.tsx — Catalogue repensé v2
// Structure hybride : capsules marques → rangées éditoriales → grille filtrable
// Suppression des chips famille olfactive — dilution dans des sections nommées

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { View, Text, ActivityIndicator, Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { useAnimatedScrollHandler, type SharedValue } from 'react-native-reanimated';
import { Link, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { useAuthContext } from '../../contexts/AuthContext';
import ParfumCard from '../../components/ParfumCard';
import SectionHeader from '../../components/SectionHeader';
import BrandCapsules from './BrandCapsules';
import CatalogRow from './CatalogRow';
import FamilyAmbianceCards from './FamilyAmbianceCards';
import BrandSheet from './BrandSheet';
import { getPopularParfums, getPersonalizedSuggestions, getTopRatedParfums, getSeasonalParfums, getParfumCount } from '../../services/catalog';
import { useDensityPreference, GRID_MODES } from '../../hooks/useDensityPreference';
import type { CardMode } from '../../components/ParfumCard';
import { useTheme, type Theme } from '../../theme/ThemeContext';
import { textOn } from '../../utils/contrast';
import { currentSeason, SEASON_META } from '../../utils/season';
import type { Parfum } from '../../models';

function seededShuffle<T>(arr: T[], seed: number): T[] {
  const shuffled = [...arr];
  let s = seed;
  for (let i = shuffled.length - 1; i > 0; i--) {
    s = (s * 16807 + 0) % 2147483647;
    const j = s % (i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function getDiscount(p: Parfum): number {
  if (typeof p.referencePrice === 'number' && p.referencePrice > 0 && typeof p.bestPrice === 'number') {
    return Math.round((1 - p.bestPrice / p.referencePrice) * 100);
  }
  return 0;
}

interface Props {
  scrollY?: SharedValue<number>;
}

export default function CatalogPage({ scrollY }: Props) {
  const { theme, resolvedMode } = useTheme();
  const s = useMemo(() => getStyles(theme), [theme]);
  const { user, authReady, isAuthenticated } = useAuthContext();
  const router = useRouter();
  const flatListRef = useRef<Animated.FlatList<Parfum>>(null);

  const scrollHandler = useAnimatedScrollHandler((e) => {
    if (scrollY) scrollY.value = e.contentOffset.y;
  });

  const { density: gridDensity, setDensity: setGridDensity } = useDensityPreference();

  const pendingScrollRef = useRef<number | null>(null);
  const prevGridKeyRef = useRef<string | null>(null);

  const handleDensityChange = useCallback((mode: CardMode) => {
    if (scrollY) pendingScrollRef.current = scrollY.value;
    setGridDensity(mode);
  }, [scrollY, setGridDensity]);

  const [suggestionParfums, setSuggestionParfums] = useState<Parfum[]>([]);
  const [suggestionLabel, setSuggestionLabel] = useState('Parfums populaires');
  const [suggestionLoading, setSuggestionLoading] = useState(true);

  const [bestDeals, setBestDeals] = useState<Parfum[]>([]);
  const [dealsLoading, setDealsLoading] = useState(true);

  const [topRated, setTopRated] = useState<Parfum[]>([]);
  const [topRatedLoading, setTopRatedLoading] = useState(true);

  const [seasonal, setSeasonal] = useState<Parfum[]>([]);
  const [seasonalLoading, setSeasonalLoading] = useState(true);

  const season = useMemo(() => currentSeason(), []);

  const [gridParfums, setGridParfums] = useState<Parfum[]>([]);
  const [gridLoading, setGridLoading] = useState(true);
  const [brandSheetVisible, setBrandSheetVisible] = useState(false);

  const [sharedPool, setSharedPool] = useState<Parfum[]>([]);
  const [sharedLoading, setSharedLoading] = useState(true);
  const [totalCount, setTotalCount] = useState<number | null>(null);

  const today = Math.floor(Date.now() / 86400000);

  // ── Shared pool: 1 seul fetch Firestore pour toutes les rangées ──
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const popular = await getPopularParfums(120);
        if (!cancelled) setSharedPool(popular);
        const urls = popular.map(p => p.imageUrl).filter((u): u is string => !!u).slice(0, 24);
        if (urls.length > 0) Image.prefetch(urls, 'memory-disk').catch(() => {});
      } catch (e) { console.warn('[catalog] getPopularParfums failed:', e); }
      if (!cancelled) setSharedLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    getParfumCount().then(n => { if (!cancelled) setTotalCount(n); });
    return () => { cancelled = true; };
  }, []);

  // ── Suggestions (Pour vous / Populaires) — depuis le pool partagé ──
  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (isAuthenticated && user) {
        try {
          const personalized = await getPersonalizedSuggestions(user.uid, 16);
          if (!cancelled && personalized.length > 0) {
            const exploit = personalized.slice(0, 5);
            const discover = seededShuffle(personalized.slice(5), today).slice(0, 3);
            setSuggestionParfums([...exploit, ...discover]);
            setSuggestionLabel('Pour vous');
            setSuggestionLoading(false);
            return;
          }
        } catch (e: unknown) { console.warn('[catalog] getPersonalizedSuggestions failed:', (e as Error)?.message ?? String(e)); }
      }
      if (sharedPool.length > 0) {
        if (!cancelled) {
          setSuggestionParfums(seededShuffle(sharedPool, today).slice(0, 8));
          setSuggestionLabel('Tendances du moment');
          setSuggestionLoading(false);
        }
      } else if (!sharedLoading) {
        if (!cancelled) { setSuggestionParfums([]); setSuggestionLoading(false); }
      }
    }
    load();
    return () => { cancelled = true; };
  }, [authReady, isAuthenticated, user?.uid, sharedPool, sharedLoading]);

  // ── Meilleures affaires (ratio-based) — depuis le pool partagé ──
  useEffect(() => {
    if (sharedLoading) return;
    const scored = sharedPool
      .filter(p => typeof p.bestPrice === 'number' && typeof p.referencePrice === 'number' && p.bestPrice > 0 && p.referencePrice > 0)
      .map(p => ({ p, ratio: p.bestPrice! / p.referencePrice! }))
      .filter(({ ratio }) => ratio <= 0.85)
      .sort((a, b) => a.ratio - b.ratio);
    setBestDeals(seededShuffle(scored.map(x => x.p), today).slice(0, 8));
    setDealsLoading(false);
  }, [sharedPool, sharedLoading]);

  // ── Grille — depuis le pool partagé ──
  useEffect(() => {
    if (sharedLoading) return;
    setGridParfums(seededShuffle(sharedPool.slice(0, 40), today));
    setGridLoading(false);
  }, [sharedPool, sharedLoading]);

  // ── Les mieux notés (note + plancher de reviews) — fetch dédié ──
  useEffect(() => {
    let cancelled = false;
    getTopRatedParfums(12)
      .then(list => { if (!cancelled) setTopRated(list); })
      .catch((e) => console.warn('[catalog] getTopRatedParfums', e))
      .finally(() => { if (!cancelled) setTopRatedLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // ── Parfaits pour la saison (saison dominante) — fetch dédié ──
  useEffect(() => {
    let cancelled = false;
    getSeasonalParfums(season, 12)
      .then(list => { if (!cancelled) setSeasonal(list); })
      .catch((e) => console.warn('[catalog] getSeasonalParfums', e))
      .finally(() => { if (!cancelled) setSeasonalLoading(false); });
    return () => { cancelled = true; };
  }, [season]);

  // Dédup : un parfum dominant en saison ET bien noté ne doit pas apparaître
  // dans deux rangées adjacentes. La rangée saison garde la priorité.
  const topRatedDisplay = useMemo(() => {
    const seasonalIds = new Set(seasonal.map(p => p.id));
    return topRated.filter(p => !seasonalIds.has(p.id));
  }, [topRated, seasonal]);

  const handleBrandTap = useCallback((brand: string) => {
    router.push(`/brand/${encodeURIComponent(brand)}`);
  }, [router]);

  const handleFamilyTap = useCallback((familyKey: string) => {
    router.push(`/search?family=${encodeURIComponent(familyKey)}`);
  }, [router]);

  const handleViewAllBrands = useCallback(() => {
    setBrandSheetVisible(true);
  }, []);

  const scrollToGrid = useCallback(() => {
    flatListRef.current?.scrollToIndex({ index: 0, animated: true, viewPosition: 0 });
  }, []);

  const renderGridItem = useCallback(({ item }: { item: Parfum }) => (
    <View style={gridDensity === 'list' ? s.listItemWrap : s.gridItemWrap}>
      <ParfumCard parfum={item} mode={gridDensity} />
    </View>
  ), [gridDensity, s]);

  const gridNumCols = gridDensity === 'list' ? 1 : 2;
  const gridKey = `${gridNumCols}col`;

  useEffect(() => {
    if (prevGridKeyRef.current === null) {
      prevGridKeyRef.current = gridKey;
      return;
    }
    if (prevGridKeyRef.current !== gridKey) {
      prevGridKeyRef.current = gridKey;
      const offset = pendingScrollRef.current;
      if (offset != null && offset > 0) {
        pendingScrollRef.current = null;
        requestAnimationFrame(() => {
          flatListRef.current?.scrollToOffset({ offset, animated: false });
        });
      }
    }
  }, [gridKey]);

  const listHeader = useMemo(() => (
    <View>
      {/* Brand capsules */}
      <BrandCapsules
        onViewAll={handleViewAllBrands}
        onBrandTap={handleBrandTap}
      />
      
      {/* Row: Pour vous / Tendances */}
      {!suggestionLoading && suggestionParfums.length > 0 && (
        <CatalogRow
          title={suggestionLabel}
          subtitle="Suggestions basées sur tes goûts"
          actionLabel="Voir tout →"
          onAction={scrollToGrid}
          collapsible
          defaultCollapsed={false}
        >
          {suggestionParfums.map(p => (
            <ParfumCard key={p.id} parfum={p} mode="carousel" />
          ))}
        </CatalogRow>
      )}

      {/* Row: Parfaits pour la saison (saison dominante) */}
      {!seasonalLoading && seasonal.length > 0 && (
        <CatalogRow
          title={`Parfaits pour ${SEASON_META[season].withArticle}`}
          subtitle="Les fragrances qui s'épanouissent en ce moment"
          collapsible
          defaultCollapsed={false}
        >
          {seasonal.map(p => (
            <ParfumCard key={p.id} parfum={p} mode="carousel" />
          ))}
        </CatalogRow>
      )}

      {/* Row: Les mieux notés (preuve sociale) */}
      {!topRatedLoading && topRatedDisplay.length > 0 && (
        <CatalogRow
          title="Les mieux notés"
          subtitle="Plébiscités par la communauté"
          collapsible
          defaultCollapsed={false}
        >
          {topRatedDisplay.map(p => (
            <ParfumCard key={p.id} parfum={p} mode="carousel" />
          ))}
        </CatalogRow>
      )}

      {/* Row: Meilleures affaires */}
      {!dealsLoading && bestDeals.length > 0 && (
        <CatalogRow
          title="Meilleures affaires"
          subtitle="Les meilleurs rapports qualité-prix"
          collapsible
          defaultCollapsed={false}
        >
          {bestDeals.map(p => (
            <ParfumCard key={p.id} parfum={p} mode="carousel" />
          ))}
        </CatalogRow>
      )}

      {/* Row: Explorer par famille (ambiance cards) */}
      <FamilyAmbianceCards onFamilyTap={handleFamilyTap} />

      {/* Grid controls */}
      <View style={s.gridControls}>
        <View style={s.gridControlsRow}>
          <Text style={s.gridCount}>
            {totalCount != null ? `${new Intl.NumberFormat('fr-FR').format(totalCount)} parfums` : '…'}
          </Text>
        </View>
        <View style={s.gridControlsRow}>
          <View style={s.segmentWrap}>
            {GRID_MODES.map(m => (
              <Pressable
                key={m.key}
                style={[s.segmentBtn, gridDensity === m.key && s.segmentBtnActive]}
                onPress={() => handleDensityChange(m.key)}
              >
                <Text style={[s.segmentBtnText, gridDensity === m.key && s.segmentBtnTextActive]}>
                  {m.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>
    </View>
  ), [
    s, suggestionParfums, suggestionLabel, suggestionLoading,
    seasonal, seasonalLoading, topRatedDisplay, topRatedLoading, season,
    bestDeals, dealsLoading, gridDensity,
    handleViewAllBrands, handleBrandTap, handleFamilyTap, scrollToGrid, handleDensityChange,
  ]);

  return (
    <SafeAreaView edges={['bottom']} style={s.container}>
      {authReady && !isAuthenticated && (
        <View style={s.banner}>
          <Text style={s.bannerText}>Connecte-toi pour des suggestions personnalisées</Text>
          <Link href="/auth/login" style={s.bannerLink}>
            <Text style={s.bannerLinkText}>Connexion</Text>
          </Link>
        </View>
      )}

      <View style={s.headerBar}>
        <View style={{ flex: 1 }}>
          <Text style={s.heroTitle}>Sillage</Text>
          <Text style={s.heroSub}>Trouve ton parfum au meilleur prix</Text>
        </View>
      </View>

      {gridLoading ? (
        <View style={s.loadingWrap}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : (
        <Animated.FlatList
          ref={flatListRef}
          key={gridKey}
          data={gridParfums}
          extraData={gridDensity}
          numColumns={gridNumCols}
          keyExtractor={p => p.id}
          renderItem={renderGridItem}
          ListHeaderComponent={listHeader}
          contentContainerStyle={s.gridContent}
          columnWrapperStyle={gridNumCols === 2 ? s.gridRow : undefined}
          showsVerticalScrollIndicator={false}
          onScroll={scrollHandler}
          scrollEventThrottle={16}
        />
      )}

      <BrandSheet
        visible={brandSheetVisible}
        onClose={() => setBrandSheetVisible(false)}
        onSelectBrand={handleBrandTap}
      />
    </SafeAreaView>
  );
}

function getStyles(t: Theme) {
  return {
    container: { flex: 1, backgroundColor: t.colors.background },
    banner: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: t.colors.primarySoft, padding: t.spacing.base, gap: 8,
    },
    bannerText: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 13, color: t.colors.primaryInk },
    bannerLink: {
      backgroundColor: t.colors.primary, paddingHorizontal: 12, paddingVertical: 6,
      borderRadius: t.radius.sm,
    },
    bannerLinkText: { color: textOn(t.colors.primary), fontFamily: 'Inter_600SemiBold', fontSize: 13 },
    headerBar: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: t.spacing.md, paddingTop: 8, paddingBottom: 12,
    },
    heroTitle: { fontFamily: 'PlayfairDisplay_700Bold', fontSize: 28, color: t.colors.text },
    heroSub: { fontFamily: 'Inter_400Regular', fontSize: 14, color: t.colors.textMuted, marginTop: 4 },
    loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },

    gridControls: {
      paddingHorizontal: t.spacing.md,
      paddingTop: t.spacing.md,
      paddingBottom: t.spacing.base,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: t.colors.border,
    },
    gridControlsRow: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      marginBottom: t.spacing.sm,
    },
    gridCount: {
      fontFamily: 'Inter_400Regular', fontSize: 12, color: t.colors.textMuted,
    },
    segmentWrap: {
      flexDirection: 'row',
      backgroundColor: t.colors.surface2,
      borderRadius: t.radius.sm,
      padding: 3,
      gap: 1,
    },
    segmentBtn: {
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 6,
      minHeight: 44,
      justifyContent: 'center',
    },
    segmentBtnActive: {
      backgroundColor: t.colors.surface,
      ...t.shadow.card,
    },
    segmentBtnText: {
      fontFamily: 'Inter_500Medium', fontSize: 12, color: t.colors.textMuted,
    },
    segmentBtnTextActive: {
      fontFamily: 'Inter_600SemiBold', color: t.colors.text,
    },
    gridContent: { paddingBottom: t.spacing.md },
    gridRow: { gap: 10, paddingHorizontal: t.spacing.md, marginBottom: 10 },
    gridItemWrap: { flex: 1 },
    listItemWrap: { paddingHorizontal: t.spacing.md, marginBottom: 8 },
  } as const;
}
