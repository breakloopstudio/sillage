// app/(tabs)/favorites.tsx — Moodboard olfactif : favoris en grille 3 densités

import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, Animated, Easing, LayoutAnimation, TextInput, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Reanimated, { useAnimatedScrollHandler, type SharedValue } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import Ionicons from '@react-native-vector-icons/ionicons/static';
import { useAuthContext } from '../../contexts/AuthContext';
import { useFavoris } from '../../hooks/useFavoris';
import { getParfumById } from '../../services/catalog';
import { moveToCollection, moveToScentList } from '../../services/user-data';
import { addToWardrobe } from '../../services/wardrobe';
import { setPendingParfum } from '../../services/catalog-bridge';
import { useTheme, type Theme } from '../../theme/ThemeContext';
import { useDensityPreference, GRID_MODES } from '../../hooks/useDensityPreference';
import type { CardMode } from '../../components/ParfumCard';
import EmptyState from '../../components/EmptyState';
import AuthGate from '../../components/AuthGate';
import ActionSheet, { type ActionItem } from '../../components/ActionSheet';
import ParfumCard from '../../components/ParfumCard';
import type { UserFavori } from '../../models/user-favori.interface';
import type { Parfum } from '../../models';
import FilterSheet from '../../components/FilterSheet';
import { SEASON_META } from '../../utils/season';
import {
  EMPTY_FAVORI_FILTERS,
  countActiveFilters,
  buildActiveChips,
  removeActiveChip,
  matchesFavoriFilters,
  favoriMatchesSearch,
  type FavoritesFilters,
} from '../../utils/favori-filters';

interface Props {
  scrollY?: SharedValue<number>;
}

function favoriToCardItem(f: UserFavori): Parfum {
  return {
    id: f.parfumId,
    nom: f.nom ?? '',
    marque: f.marque ?? '',
    imageUrl: f.imageUrl ?? null,
    familleOlactive: f.familleOlactive ?? '',
    bestPrice: f.bestPrice ?? undefined,
    referencePrice: f.referencePrice ?? undefined,
    annee: f.annee ?? undefined,
  } as Parfum;
}

export default function FavoritesPage({ scrollY }: Props) {
  const { theme, resolvedMode } = useTheme();
  const s = useMemo(() => getStyles(theme), [theme]);
  const { user, authReady, isAuthenticated } = useAuthContext();
  const router = useRouter();
  const uid = user?.uid ?? null;
  const { favoris, loading, removeFavori } = useFavoris(uid);
  const keyboardAppearance = resolvedMode === 'dark' ? 'dark' : 'light';
  const { density: gridDensity, setDensity: setGridDensity } = useDensityPreference();

  const scrollHandler = useAnimatedScrollHandler((e) => {
    if (scrollY) scrollY.value = e.contentOffset.y;
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<FavoritesFilters>(EMPTY_FAVORI_FILTERS);
  const [sortMode, setSortMode] = useState<'recent' | 'az' | 'za' | 'price'>('recent');
  const [refreshing, setRefreshing] = useState(false);
  const [selectedItem, setSelectedItem] = useState<UserFavori | null>(null);
  const [showFilterSheet, setShowFilterSheet] = useState(false);

  const animatedValues = useRef<Map<string, Animated.Value>>(new Map());
  const prevFilterKey = useRef<string | null>(null);
  const hasAnimated = useRef(false);

  const hasBestPrice = useMemo(() => favoris.some(f => typeof f.bestPrice === 'number'), [favoris]);

  const activeFilterCount = useMemo(() => countActiveFilters(filters), [filters]);

  const handleOpenFilterSheet = useCallback(() => setShowFilterSheet(true), []);
  const handleCloseFilterSheet = useCallback(() => setShowFilterSheet(false), []);
  const handleFiltersChange = useCallback((next: FavoritesFilters) => setFilters(next), []);
  const handleResetFilters = useCallback(() => setFilters(EMPTY_FAVORI_FILTERS), []);

  const filtered = useMemo(() => {
    let result = favoris.filter(f => matchesFavoriFilters(f, filters));
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(f => favoriMatchesSearch(f, q));
    }
    result.sort((a, b) => {
      switch (sortMode) {
        case 'az': return (a.nom ?? '').localeCompare(b.nom ?? '');
        case 'za': return (b.nom ?? '').localeCompare(a.nom ?? '');
        case 'price': {
          const pa = a.bestPrice ?? Infinity;
          const pb = b.bestPrice ?? Infinity;
          return pa - pb;
        }
        default: {
          const da = a.addedAt instanceof Date ? a.addedAt.getTime() : 0;
          const db = b.addedAt instanceof Date ? b.addedAt.getTime() : 0;
          return db - da;
        }
      }
    });
    return result;
  }, [favoris, filters, searchQuery, sortMode]);

  const showFilterBar = favoris.length > 5;

  const getSortCycle = useMemo(() => {
    const base: { key: typeof sortMode; label: string }[] = [
      { key: 'recent', label: 'Récents' },
      { key: 'az', label: 'A–Z' },
      { key: 'za', label: 'Z–A' },
    ];
    if (hasBestPrice) base.push({ key: 'price', label: 'Moins chers' });
    return base;
  }, [hasBestPrice]);

  const cycleSort = () => {
    const idx = getSortCycle.findIndex(o => o.key === sortMode);
    const next = getSortCycle[(idx + 1) % getSortCycle.length];
    setSortMode(next.key);
  };

  const currentSortLabel = getSortCycle.find(o => o.key === sortMode)?.label ?? 'Tri';

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 800);
  };

  const filterKey = `${JSON.stringify(filters)}|${searchQuery}|${sortMode}`;

  useEffect(() => {
    const needsAnim = (!hasAnimated.current || prevFilterKey.current !== filterKey) && filtered.length >= 4;
    if (!needsAnim) {
      prevFilterKey.current = filterKey;
      return;
    }
    hasAnimated.current = true;
    prevFilterKey.current = filterKey;

    animatedValues.current = new Map();
    filtered.forEach((item, i) => {
      const val = new Animated.Value(0);
      animatedValues.current.set(item.id, val);
      Animated.timing(val, {
        toValue: 1,
        duration: 250,
        delay: i * 60,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    });
  }, [filterKey, filtered.length]);

  const activeChips = useMemo(() => buildActiveChips(filters), [filters]);

  const goToDetail = async (parfumId: string) => {
    try {
      const p = await getParfumById(parfumId);
      if (p) setPendingParfum(p);
    } catch (e: unknown) { console.warn('[favorites] getParfumById failed:', (e as Error)?.message ?? String(e)); }
    router.push(`/catalog/${parfumId}`);
  };

  const showContextMenu = (item: UserFavori) => {
    setSelectedItem(item);
  };

  const sheetActions: ActionItem[] = useMemo(() => {
    if (!selectedItem || !uid) return [];
    const item = selectedItem;
    return [
      {
        icon: 'eye-outline',
        label: 'Voir le détail',
        onPress: () => { setSelectedItem(null); goToDetail(item.parfumId); },
      },
      {
        icon: 'shirt-outline',
        label: 'Ajouter à ma parfumerie',
        onPress: () => {
          setSelectedItem(null);
          addToWardrobe(uid, item.parfumId, 'have', item.nom ?? undefined, item.marque ?? undefined, item.imageUrl ?? undefined).catch(() => {});
        },
      },
      {
        icon: 'swap-horizontal-outline',
        label: 'Déplacer vers Parfumerie',
        onPress: () => {
          setSelectedItem(null);
          moveToCollection(uid, 'favoris', item.id, item.parfumId, item.nom ?? null, item.marque ?? null, item.imageUrl ?? null).catch(() => {});
        },
      },
      {
        icon: 'eyedrop-outline',
        label: 'Déplacer vers le carnet',
        onPress: () => {
          setSelectedItem(null);
          moveToScentList(uid, 'favoris', item.id, item.parfumId, item.nom ?? null, item.marque ?? null, item.imageUrl ?? null, item.familleOlactive ?? null).catch(() => {});
        },
      },
      {
        icon: 'trash-outline',
        label: 'Retirer des favoris',
        destructive: true,
        onPress: () => {
          setSelectedItem(null);
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          removeFavori(item.id).catch(() => {});
        },
      },
    ];
  }, [selectedItem, uid]);

  const gridNumCols = gridDensity === 'list' ? 1 : 2;
  const gridKey = `${gridNumCols}col-${resolvedMode}`;

  if (!authReady) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (!isAuthenticated) {
    return (
      <SafeAreaView edges={['bottom']} style={s.container}>
        <AuthGate icon="heart-outline" description="Accède à tes favoris." />
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView edges={['bottom']} style={s.container}>
        <View style={s.headerBar}>
          <Text style={s.title}>Favoris</Text>
        </View>
        <ActivityIndicator style={s.loadingSpinner} color={theme.colors.primary} />
      </SafeAreaView>
    );
  }

  if (favoris.length === 0) {
    return (
      <SafeAreaView edges={['bottom']} style={s.container}>
        <Reanimated.FlatList
          data={[]}
          renderItem={() => null}
          ListHeaderComponent={
            <View>
              <View style={s.headerBar}>
                <Text style={s.title}>Favoris</Text>
              </View>
              <EmptyState variant="favoris" onAction={() => router.push('/(tabs)')} />
            </View>
          }
          onScroll={scrollHandler}
          scrollEventThrottle={16}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.colors.primary} />
          }
          contentContainerStyle={{ flexGrow: 1 }}
        />
      </SafeAreaView>
    );
  }

  const ListHeader = (
    <View>
      <View style={s.headerBar}>
        <Text style={s.title}>Favoris{'\u00A0'}·{'\u00A0'}{favoris.length}</Text>
      </View>
      
      {showFilterBar && (
        <View style={s.filterContainer}>
          <View style={s.searchRow}>
            <View style={s.searchWrap}>
              <Ionicons name="search-outline" size={16} color={theme.colors.textMuted} />
              <TextInput
                style={s.searchInput}
                placeholder="Nom, marque ou note..."
                placeholderTextColor={theme.colors.textMuted}
                value={searchQuery}
                onChangeText={setSearchQuery}
                keyboardAppearance={keyboardAppearance}
              />
            </View>
            <Pressable style={s.sortBtn} onPress={cycleSort} hitSlop={8}>
              <Ionicons name="swap-vertical-outline" size={16} color={theme.colors.primary} />
              <Text style={s.sortLabel}>{currentSortLabel}</Text>
            </Pressable>
          </View>

          <View style={s.controlsRow}>
            <Pressable style={s.familyBtn} onPress={handleOpenFilterSheet}>
              <Ionicons name="options-outline" size={16} color={activeFilterCount > 0 ? theme.colors.primary : theme.colors.textMuted} />
              <Text style={[s.familyBtnText, activeFilterCount > 0 ? s.familyBtnTextActive : undefined]}>
                Filtres
              </Text>
              {activeFilterCount > 0 && (
                <View style={s.filtersBadge}>
                  <Text style={s.filtersBadgeText} allowFontScaling={false}>{activeFilterCount}</Text>
                </View>
              )}
            </Pressable>

            <View style={{ flex: 1 }} />

            {GRID_MODES.map(m => (
              <Pressable
                key={m.key}
                style={[s.segmentBtn, gridDensity === m.key && s.segmentBtnActive]}
                onPress={() => setGridDensity(m.key)}
              >
                <Text style={[s.segmentBtnText, gridDensity === m.key && s.segmentBtnTextActive]}>
                  {m.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {activeChips.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.activeChipsRow}
            >
              {activeChips.map(chip => {
                const isSeason = !!chip.season;
                const seasonToken = isSeason ? SEASON_META[chip.season!].token : null;
                const bg = isSeason && seasonToken ? (theme.colors as Record<string, string>)[`${seasonToken}Soft`] : theme.colors.primarySoft;
                const ink = isSeason && seasonToken ? (theme.colors as Record<string, string>)[seasonToken] : theme.colors.primaryInk;
                return (
                  <Pressable
                    key={chip.key}
                    style={[s.dismissChip, { backgroundColor: bg }]}
                    onPress={() => setFilters((prev: FavoritesFilters) => removeActiveChip(prev, chip))}
                  >
                    {chip.icon && <Ionicons name={chip.icon as never} size={14} color={ink} />}
                    <Text style={[s.dismissChipText, { color: ink }]} allowFontScaling={false}>{chip.label}</Text>
                    <Ionicons name="close-circle" size={14} color={ink} />
                  </Pressable>
                );
              })}
            </ScrollView>
          )}
        </View>
      )}

      {filtered.length === 0 && (activeFilterCount > 0 || searchQuery.trim().length > 0) && (
        <View style={s.emptyFilter}>
          <Ionicons name="funnel-outline" size={28} color={theme.colors.textMuted} />
          <Text style={s.emptyFilterText}>
            {activeFilterCount > 0 ? 'Aucun favori ne correspond à ces filtres' : `Aucun résultat pour « ${searchQuery.trim()} »`}
          </Text>
          <Pressable style={s.emptyResetBtn} onPress={() => { setFilters(EMPTY_FAVORI_FILTERS); setSearchQuery(''); }}>
            <Text style={s.emptyResetBtnText}>Réinitialiser</Text>
          </Pressable>
        </View>
      )}
    </View>
  );

  const renderItem = ({ item }: { item: UserFavori }) => {
    const cardData = favoriToCardItem(item);
    const animVal = animatedValues.current.get(item.id);
    const opacity = animVal ?? 1;

    return (
      <Animated.View style={[gridDensity === 'list' ? s.listItemWrap : s.gridItemWrap, { opacity }]}>
        <Pressable onLongPress={() => showContextMenu(item)} delayLongPress={400} style={{ flex: 1 }}>
          <ParfumCard
            parfum={cardData}
            mode={gridDensity}
            onPressOverride={() => goToDetail(item.parfumId)}
          />
        </Pressable>
      </Animated.View>
    );
  };

  return (
    <>
      <SafeAreaView edges={['bottom']} style={s.container}>
        <Reanimated.FlatList
          key={gridKey}
          data={filtered}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          extraData={`${gridDensity}|${resolvedMode}`}
          numColumns={gridNumCols}
          columnWrapperStyle={gridNumCols === 2 ? s.row : undefined}
          contentContainerStyle={s.content}
          ListHeaderComponent={ListHeader}
          showsVerticalScrollIndicator={false}
          onScroll={scrollHandler}
          scrollEventThrottle={16}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.colors.primary} />
          }
          windowSize={5}
          maxToRenderPerBatch={10}
        />
      </SafeAreaView>
      <ActionSheet
        visible={selectedItem !== null}
        title={selectedItem?.nom ?? undefined}
        actions={sheetActions}
        onClose={() => setSelectedItem(null)}
      />
      <FilterSheet
        visible={showFilterSheet}
        items={favoris}
        filters={filters}
        resultCount={filtered.length}
        onFiltersChange={handleFiltersChange}
        onReset={handleResetFilters}
        onClose={handleCloseFilterSheet}
      />
    </>
  );
}

function getStyles(t: Theme) {
  return {
    container: { flex: 1, backgroundColor: t.colors.background },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
    headerBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
    title: { fontFamily: 'PlayfairDisplay_700Bold', fontSize: 28, color: t.colors.text, flex: 1 },
    filterContainer: {
      paddingHorizontal: 12,
      paddingBottom: 4,
    },
    searchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 8,
    },
    searchWrap: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: t.colors.surface2,
      borderRadius: 20,
      paddingHorizontal: 12,
      height: 38,
      gap: 8,
    },
    searchInput: {
      flex: 1,
      fontFamily: 'Inter_400Regular',
      fontSize: 14,
      color: t.colors.text,
    },
    sortBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
      paddingHorizontal: 8,
      paddingVertical: 6,
    },
    sortLabel: {
      fontFamily: 'Inter_500Medium',
      fontSize: 12,
      color: t.colors.primary,
    },
    controlsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 4,
    },
    familyBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: t.colors.surface,
      borderWidth: 1,
      borderColor: t.colors.border,
      minHeight: 44,
    },
    familyBtnText: {
      fontFamily: 'Inter_500Medium',
      fontSize: 12,
      color: t.colors.textMuted,
    },
    familyBtnTextActive: {
      color: t.colors.primary,
      fontFamily: 'Inter_600SemiBold',
    },
    dismissChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 7,
      borderRadius: 20,
      backgroundColor: t.colors.primarySoft,
    },
    dismissChipText: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 12,
      color: t.colors.primaryInk,
    },
    segmentBtn: {
      paddingHorizontal: 11,
      paddingVertical: 8,
      borderRadius: 6,
      backgroundColor: t.colors.surface2,
      minHeight: 44,
      justifyContent: 'center',
    },
    segmentBtnActive: {
      backgroundColor: t.colors.surface,
      ...t.shadow.card,
    },
    segmentBtnText: {
      fontFamily: 'Inter_500Medium',
      fontSize: 11,
      color: t.colors.textMuted,
    },
    segmentBtnTextActive: {
      fontFamily: 'Inter_600SemiBold',
      color: t.colors.text,
    },
    emptyFilter: {
      paddingVertical: 24,
      alignItems: 'center',
    },
    emptyFilterText: {
      fontFamily: 'Inter_400Regular',
      fontSize: 14,
      color: t.colors.textMuted,
      marginTop: 8,
      textAlign: 'center' as const,
    },
    emptyResetBtn: {
      marginTop: 12,
      borderWidth: 1.5 as number,
      borderColor: t.colors.primary,
      borderRadius: t.radius.base,
      paddingVertical: 10,
      paddingHorizontal: 20,
      minHeight: 44,
    },
    emptyResetBtnText: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 13,
      color: t.colors.primary,
    },
    filtersBadge: {
      width: 16,
      height: 16,
      borderRadius: 8,
      backgroundColor: t.colors.primary,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
    },
    filtersBadgeText: {
      fontFamily: 'Inter_700Bold',
      fontSize: 10,
      color: '#FFFFFF',
    },
    activeChipsRow: {
      gap: 8,
      paddingVertical: 6,
      paddingHorizontal: 4,
    },
    row: {
      gap: 8,
      marginBottom: 8,
    },
    content: {
      paddingHorizontal: 16,
      paddingBottom: 88,
    },
    gridItemWrap: { flex: 1 },
    listItemWrap: { marginBottom: 8 },
    loadingSpinner: { marginTop: 24 },
  } as const;
}
