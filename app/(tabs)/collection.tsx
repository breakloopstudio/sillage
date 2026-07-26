// app/(tabs)/collection.tsx — Ma Parfumerie (vue unifiée : favoris + user_parfum)

import { useRef, useState, useMemo, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, TextInput, type LayoutChangeEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { useAnimatedScrollHandler } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import Ionicons from '@react-native-vector-icons/ionicons/static';
import { useAuthContext } from '../../src/contexts/AuthContext';
import { useFavorisContext } from '../../src/contexts/FavorisContext';
import { useUserParfum } from '../../src/hooks/useUserParfum';
import { useShelves } from '../../src/hooks/useShelves';
import { useSotd } from '../../src/hooks/useSotd';
import { useWeather } from '../../src/hooks/useWeather';
import { useNetwork } from '../../src/hooks/useNetwork';
import { useDensityPreference, GRID_MODES } from '../../src/hooks/useDensityPreference';
import { buildMyParfums, filterByPill, pillOfItem, myParfumToCard, MY_PARFUM_PILLS, type MyParfum, type PillId } from '../../src/utils/my-parfums';
import { scoreWardrobeItemForWeather } from '../../src/utils/weather-scoring';
import { saveWeatherCoords } from '../../src/services/user-data';
import { setPendingParfum } from '../../src/services/catalog-bridge';
import { hapticsLight } from '../../src/services/haptics';
import { useTheme, type Theme } from '../../src/theme/ThemeContext';
import { useNavigationChrome } from '../../src/features/navigation/NavigationChromeContext';
import EmptyState from '../../src/components/EmptyState';
import AuthGate from '../../src/components/AuthGate';
import FilterSheet from '../../src/components/FilterSheet';
import StatuerSheet from '../../src/components/StatuerSheet';
import ParfumCard from '../../src/components/ParfumCard';
import SOTDCard from '../../src/features/wardrobe/SOTDCard';
import SOTDPicker from '../../src/features/wardrobe/SOTDPicker';
import ShelfManager from '../../src/features/wardrobe/ShelfManager';
import { SEASON_META } from '../../src/utils/season';
import {
  EMPTY_FAVORI_FILTERS,
  countActiveFilters,
  matchesFavoriFilters,
  favoriMatchesSearch,
  buildActiveChips,
  removeActiveChip,
  type FavoritesFilters,
} from '../../src/utils/favori-filters';
import type { UserParfumStatus } from '../../src/models/user-parfum.interface';

const SORT_OPTIONS: { key: string; label: string }[] = [
  { key: 'recent', label: 'Récents' },
  { key: 'rating', label: 'Mieux notés' },
  { key: 'az', label: 'A–Z' },
  { key: 'za', label: 'Z–A' },
];

const DENSITY_ICON: Record<string, string> = {
  comfortable: 'grid-outline',
  compactPlus: 'apps-outline',
  list: 'list-outline',
};

export default function MaParfumeriePage() {
  const { theme, resolvedMode } = useTheme();
  const s = useMemo(() => getStyles(theme), [theme]);
  const { user, authReady, isAuthenticated } = useAuthContext();
  const router = useRouter();
  const uid = user?.uid ?? null;
  const keyboardAppearance = resolvedMode === 'dark' ? 'dark' : 'light';

  const { favoris, removeFavori } = useFavorisContext();
  const { items, loading, add, update, remove } = useUserParfum(uid);
  const { shelves, create: createShelf, update: updateShelf, remove: removeShelf } = useShelves(uid);
  const { sotd, setTodaySotd } = useSotd(uid);
  const { isOnline } = useNetwork();
  const { weather, loading: weatherLoading, coords } = useWeather(isAuthenticated && isOnline);
  const { scrollY } = useNavigationChrome();
  const { density, setDensity } = useDensityPreference();

  const scrollHandler = useAnimatedScrollHandler((e) => { scrollY.value = e.contentOffset.y; });

  const myParfums = useMemo(() => buildMyParfums(favoris, items), [favoris, items]);

  const [activePill, setActivePill] = useState<PillId>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeShelfId, setActiveShelfId] = useState<string | null>(null);
  const [activeSort, setActiveSort] = useState('recent');
  const [favOnly, setFavOnly] = useState(false);
  const [attrFilters, setAttrFilters] = useState<FavoritesFilters>(EMPTY_FAVORI_FILTERS);
  const [showAttrSheet, setShowAttrSheet] = useState(false);
  const [shelfManagerVisible, setShelfManagerVisible] = useState(false);
  const [sotdPickerVisible, setSotdPickerVisible] = useState(false);
  const [sotdCardAnchor, setSotdCardAnchor] = useState(0);
  const [statuerItem, setStatuerItem] = useState<MyParfum | null>(null);
  const sotdCardRef = useRef<View>(null);

  const sotdEligible = useMemo(() => items.filter(i => i.status === 'have'), [items]);
  const sotdScore = useMemo(() => {
    if (!weather || !sotd) return null;
    const sotdItem = items.find(i => i.parfumId === sotd.parfumId);
    return sotdItem ? scoreWardrobeItemForWeather(sotdItem, weather) : null;
  }, [items, weather, sotd]);

  const lastWeatherCoords = useRef<string | null>(null);
  useEffect(() => {
    if (!isAuthenticated || !coords || !uid) return;
    const key = `${coords.lat.toFixed(4)},${coords.lon.toFixed(4)}`;
    if (lastWeatherCoords.current === key) return;
    lastWeatherCoords.current = key;
    saveWeatherCoords(uid, coords.lat, coords.lon).catch(() => {});
  }, [isAuthenticated, coords, uid]);

  const pillCounts = useMemo(() => {
    const counts: Record<PillId, number> = { all: myParfums.length, to_try: 0, have: 0, had: 0 };
    for (const m of myParfums) counts[pillOfItem(m)] += 1;
    return counts;
  }, [myParfums]);

  const pillFiltered = useMemo(() => filterByPill(myParfums, activePill), [myParfums, activePill]);

  const filtered = useMemo(() => {
    let result = pillFiltered;
    if (activeShelfId) result = result.filter(m => m.shelfIds.includes(activeShelfId));
    if (favOnly) result = result.filter(m => m.isFav);
    result = result.filter(m => matchesFavoriFilters(m, attrFilters));
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(m => favoriMatchesSearch(m, q));
    }
    return [...result].sort((a, b) => {
      switch (activeSort) {
        case 'rating': return (b.rating ?? 0) - (a.rating ?? 0);
        case 'az': return (a.nom ?? '').localeCompare(b.nom ?? '');
        case 'za': return (b.nom ?? '').localeCompare(a.nom ?? '');
        default: return b.addedAt.getTime() - a.addedAt.getTime();
      }
    });
  }, [pillFiltered, activeShelfId, favOnly, attrFilters, searchQuery, activeSort]);

  const activeAttrCount = useMemo(() => countActiveFilters(attrFilters), [attrFilters]);
  const activeChips = useMemo(() => buildActiveChips(attrFilters), [attrFilters]);

  const handleCardPress = useCallback((m: MyParfum) => {
    setPendingParfum(myParfumToCard(m));
    router.push(`/catalog/${m.parfumId}`);
  }, [router]);

  const handleLongPress = useCallback((m: MyParfum) => setStatuerItem(m), []);

  const handleStatuerView = useCallback(() => {
    if (statuerItem) handleCardPress(statuerItem);
    setStatuerItem(null);
  }, [statuerItem, handleCardPress]);

  const handleStatuerStatus = useCallback((status: UserParfumStatus) => {
    if (!statuerItem || !uid) { setStatuerItem(null); return; }
    if (statuerItem.status === null) {
      add(statuerItem.parfumId, status, myParfumToCard(statuerItem)).catch(() => {});
    } else {
      update(statuerItem.parfumId, { status }).catch(() => {});
    }
    setStatuerItem(null);
  }, [statuerItem, uid, add, update]);

  const handleStatuerRemove = useCallback(() => {
    if (!statuerItem) return;
    if (statuerItem.status === null) {
      removeFavori(statuerItem.parfumId);
    } else {
      remove(statuerItem.parfumId).catch(() => {});
    }
    setStatuerItem(null);
  }, [statuerItem, removeFavori, remove]);

  const statuerRemoveLabel = statuerItem !== null && statuerItem.status === null ? 'Retirer des favoris' : 'Retirer de ma parfumerie';

  const handleSotdCardLayout = useCallback((e: LayoutChangeEvent) => {
    setSotdCardAnchor(e.nativeEvent.layout.y + e.nativeEvent.layout.height);
  }, []);
  const handleSotdPress = useCallback(() => { if (sotd) router.push(`/catalog/${sotd.parfumId}`); }, [sotd, router]);
  const handleSotdChangePress = useCallback(() => setSotdPickerVisible(true), []);
  const handleSotdSelect = useCallback((parfumId: string) => {
    if (parfumId === sotd?.parfumId) { setSotdPickerVisible(false); return; }
    const item = sotdEligible.find(i => i.parfumId === parfumId);
    if (item) { hapticsLight(); setTodaySotd(item).catch(() => {}); }
    setSotdPickerVisible(false);
  }, [sotd, sotdEligible, setTodaySotd]);

  const handleManageShelves = useCallback(() => setShelfManagerVisible(true), []);
  const handleCloseShelfManager = useCallback(() => setShelfManagerVisible(false), []);
  const handleCreateShelf = useCallback((name: string, icon?: string, color?: string) => { createShelf(name, icon, color); }, [createShelf]);
  const handleRenameShelf = useCallback((id: string, name: string) => { updateShelf(id, { name }); }, [updateShelf]);

  const handleToggleFavOnly = useCallback(() => { hapticsLight(); setFavOnly(v => !v); }, []);
  const handleOpenAttrSheet = useCallback(() => setShowAttrSheet(true), []);
  const handleCloseAttrSheet = useCallback(() => setShowAttrSheet(false), []);
  const handleAttrFiltersChange = useCallback((next: FavoritesFilters) => setAttrFilters(next), []);
  const handleAttrReset = useCallback(() => setAttrFilters(EMPTY_FAVORI_FILTERS), []);

  const cycleSort = useCallback(() => {
    const idx = SORT_OPTIONS.findIndex(o => o.key === activeSort);
    setActiveSort(SORT_OPTIONS[(idx + 1) % SORT_OPTIONS.length].key);
  }, [activeSort]);
  const currentSortLabel = SORT_OPTIONS.find(o => o.key === activeSort)?.label ?? 'Tri';

  const handlePillTap = useCallback((pill: PillId) => { hapticsLight(); setActivePill(pill); }, []);
  const handleShelfTap = useCallback((id: string) => { hapticsLight(); setActiveShelfId(prev => (prev === id ? null : id)); }, []);
  const handleGlobalReset = useCallback(() => {
    setAttrFilters(EMPTY_FAVORI_FILTERS);
    setSearchQuery('');
    setActiveShelfId(null);
    setFavOnly(false);
  }, []);
  const handleEmptyExplore = useCallback(() => router.push('/(tabs)'), [router]);

  const gridNumCols = density === 'list' ? 1 : 2;
  const gridKey = `${gridNumCols}col-${resolvedMode}`;

  const renderItem = useCallback(({ item }: { item: MyParfum }) => (
    <Pressable
      onLongPress={() => handleLongPress(item)}
      delayLongPress={400}
      style={gridNumCols === 2 ? s.gridItemWrap : s.listItemWrap}
    >
      <ParfumCard
        parfum={myParfumToCard(item)}
        mode={density}
        status={item.status ?? (item.isFav ? 'to_try' : null)}
        rating={item.rating}
        hidePrice
        onPressOverride={() => handleCardPress(item)}
      />
    </Pressable>
  ), [density, gridNumCols, handleCardPress, handleLongPress, s]);

  if (!authReady) {
    return <View style={s.center}><ActivityIndicator size="large" color={theme.colors.primary} /></View>;
  }

  if (!isAuthenticated) {
    return (
      <SafeAreaView edges={['bottom']} style={s.container}>
        <AuthGate icon="flask-outline" description="Accède à ta parfumerie." />
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView edges={['bottom']} style={s.container}>
        <View style={s.header}><Text style={s.title}>Ma Parfumerie</Text></View>
        <ActivityIndicator style={s.loadingSpinner} color={theme.colors.primary} />
      </SafeAreaView>
    );
  }

  if (myParfums.length === 0) {
    return (
      <SafeAreaView edges={['bottom']} style={s.container}>
        <View style={s.header}><Text style={s.title}>Ma Parfumerie</Text></View>
        <EmptyState variant="wardrobe" onAction={handleEmptyExplore} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['bottom']} style={s.container}>
      <Animated.FlatList
        key={gridKey}
        data={filtered}
        keyExtractor={item => item.parfumId}
        renderItem={renderItem}
        numColumns={gridNumCols}
        columnWrapperStyle={gridNumCols === 2 ? s.row : undefined}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        windowSize={5}
        maxToRenderPerBatch={10}
        extraData={resolvedMode}
        ListHeaderComponent={
          <View>
            <View style={s.header}>
              <Text style={s.title}>Ma Parfumerie{'\u00A0'}·{'\u00A0'}{myParfums.length}</Text>
            </View>

            <View ref={sotdCardRef} onLayout={handleSotdCardLayout}>
              <SOTDCard
                sotd={sotd}
                weather={weather}
                weatherLoading={weatherLoading}
                sotdScore={sotdScore}
                onPress={handleSotdPress}
                onChangePress={handleSotdChangePress}
              />
            </View>

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
              <Pressable style={s.toolBtn} onPress={cycleSort} hitSlop={8} accessibilityRole="button" accessibilityLabel="Trier">
                <Ionicons name="swap-vertical-outline" size={16} color={theme.colors.primary} />
                <Text style={s.toolBtnLabel}>{currentSortLabel}</Text>
              </Pressable>
              <Pressable style={s.toolBtn} onPress={handleOpenAttrSheet} hitSlop={8} accessibilityRole="button" accessibilityLabel="Filtres">
                <Ionicons name="options-outline" size={16} color={activeAttrCount > 0 ? theme.colors.primary : theme.colors.textMuted} />
                {activeAttrCount > 0 ? (
                  <View style={s.badge}><Text style={s.badgeText} allowFontScaling={false}>{activeAttrCount}</Text></View>
                ) : null}
              </Pressable>
              <Pressable style={[s.toolBtn, favOnly && s.favBtnActive]} onPress={handleToggleFavOnly} hitSlop={8} accessibilityRole="button" accessibilityLabel="Mes coups de cœur" accessibilityState={{ checked: favOnly }}>
                <Ionicons name={favOnly ? 'heart' : 'heart-outline'} size={16} color={favOnly ? theme.colors.favorite : theme.colors.textMuted} />
              </Pressable>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.pillsRow}>
              {MY_PARFUM_PILLS.map(pill => {
                const active = activePill === pill.id;
                return (
                  <Pressable
                    key={pill.id}
                    style={[s.pill, active && s.pillActive]}
                    onPress={() => handlePillTap(pill.id)}
                    accessibilityRole="button"
                    accessibilityLabel={`${pill.label}, ${pillCounts[pill.id]}`}
                  >
                    <Ionicons name={pill.icon as never} size={14} color={active ? theme.colors.primaryInk : theme.colors.textMuted} />
                    <Text style={[s.pillText, active && s.pillTextActive]} allowFontScaling={false}>{pill.label}</Text>
                    <Text style={[s.pillCount, active && s.pillCountActive]} allowFontScaling={false}>{pillCounts[pill.id]}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.toolsRow}>
              {GRID_MODES.map(m => (
                <Pressable
                  key={m.key}
                  style={[s.densityIconBtn, density === m.key && s.densityIconBtnActive]}
                  onPress={() => setDensity(m.key)}
                  accessibilityRole="button"
                  accessibilityLabel={m.label}
                >
                  <Ionicons name={DENSITY_ICON[m.key] as never} size={18} color={density === m.key ? theme.colors.primary : theme.colors.textMuted} />
                </Pressable>
              ))}
              {shelves.length > 0 ? <View style={s.toolsSep} /> : null}
              {shelves.map(sh => {
                const active = activeShelfId === sh.id;
                return (
                  <Pressable
                    key={sh.id}
                    style={[s.shelfPill, active && s.shelfPillActive]}
                    onPress={() => handleShelfTap(sh.id)}
                    accessibilityRole="button"
                    accessibilityLabel={sh.name}
                  >
                    {sh.icon ? <Ionicons name={sh.icon as never} size={13} color={active ? theme.colors.primaryInk : theme.colors.textMuted} /> : null}
                    <Text style={[s.shelfPillText, active && s.shelfPillTextActive]} allowFontScaling={false}>{sh.name}</Text>
                  </Pressable>
                );
              })}
              <Pressable style={s.manageShelfBtn} onPress={handleManageShelves} hitSlop={6} accessibilityRole="button" accessibilityLabel="Gérer les étagères">
                <Ionicons name="add" size={14} color={theme.colors.textMuted} />
              </Pressable>
            </ScrollView>

            {activeChips.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.activeChipsRow}>
                {activeChips.map(chip => {
                  const isSeason = !!chip.season;
                  const seasonToken = isSeason ? SEASON_META[chip.season!].token : null;
                  const bg = isSeason && seasonToken ? (theme.colors as Record<string, string>)[`${seasonToken}Soft`] : theme.colors.primarySoft;
                  const ink = isSeason && seasonToken ? (theme.colors as Record<string, string>)[seasonToken] : theme.colors.primaryInk;
                  return (
                    <Pressable
                      key={chip.key}
                      style={[s.dismissChip, { backgroundColor: bg }]}
                      onPress={() => setAttrFilters(prev => removeActiveChip(prev, chip))}
                      accessibilityRole="button"
                      accessibilityLabel={`Retirer ${chip.label}`}
                    >
                      {chip.icon ? <Ionicons name={chip.icon as never} size={14} color={ink} /> : null}
                      <Text style={[s.dismissChipText, { color: ink }]} allowFontScaling={false}>{chip.label}</Text>
                      <Ionicons name="close-circle" size={14} color={ink} />
                    </Pressable>
                  );
                })}
              </ScrollView>
            ) : null}

            {filtered.length === 0 ? (
              <View style={s.emptyFilter}>
                <Ionicons name="funnel-outline" size={28} color={theme.colors.textMuted} />
                <Text style={s.emptyFilterText}>
                  {activeAttrCount > 0 || searchQuery.trim() || activeShelfId || favOnly ? 'Aucun parfum ne correspond à ces filtres' : 'Aucun parfum dans cette vue'}
                </Text>
                <Pressable style={s.emptyResetBtn} onPress={handleGlobalReset} accessibilityRole="button" accessibilityLabel="Réinitialiser">
                  <Text style={s.emptyResetBtnText}>Réinitialiser</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        }
      />

      <StatuerSheet
        visible={statuerItem !== null}
        nom={statuerItem?.nom ?? ''}
        marque={statuerItem?.marque ?? ''}
        imageUrl={statuerItem?.imageUrl ?? null}
        status={statuerItem?.status ?? null}
        removeLabel={statuerRemoveLabel}
        onClose={() => setStatuerItem(null)}
        onView={handleStatuerView}
        onSetStatus={handleStatuerStatus}
        onRemove={handleStatuerRemove}
      />

      <ShelfManager
        visible={shelfManagerVisible}
        shelves={shelves}
        orphanCount={items.filter(i => i.shelfIds.length === 0).length}
        onClose={handleCloseShelfManager}
        onCreate={handleCreateShelf}
        onRename={handleRenameShelf}
        onDelete={removeShelf}
      />

      <SOTDPicker
        visible={sotdPickerVisible}
        haveItems={sotdEligible}
        currentSotdId={sotd?.parfumId ?? null}
        anchorTop={sotdCardAnchor}
        weather={weather}
        onSelect={handleSotdSelect}
        onClose={() => setSotdPickerVisible(false)}
      />

      <FilterSheet
        visible={showAttrSheet}
        items={pillFiltered}
        filters={attrFilters}
        resultCount={filtered.length}
        onFiltersChange={handleAttrFiltersChange}
        onReset={handleAttrReset}
        onClose={handleCloseAttrSheet}
      />
    </SafeAreaView>
  );
}

function getStyles(t: Theme) {
  return {
    container: { flex: 1, backgroundColor: t.colors.background },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
    content: { paddingHorizontal: 16, paddingBottom: 88 },
    row: { gap: 8, marginBottom: 8 },
    gridItemWrap: { flex: 1 },
    listItemWrap: { marginBottom: 8 },
    loadingSpinner: { marginTop: 24 },

    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
    title: { fontFamily: 'PlayfairDisplay_700Bold', fontSize: 22, color: t.colors.text, flex: 1 },

    searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, marginTop: 8, marginBottom: 8 },
    searchWrap: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: t.colors.surface2,
      borderRadius: 20,
      paddingHorizontal: 12,
      height: 40,
      gap: 8,
    },
    searchInput: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 14, color: t.colors.text },
    toolBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 9, borderRadius: 20, backgroundColor: t.colors.surface, borderWidth: 1, borderColor: t.colors.border, minHeight: 40 },
    toolBtnLabel: { fontFamily: 'Inter_500Medium', fontSize: 12, color: t.colors.primary },
    favBtnActive: { backgroundColor: t.colors.favoriteSoft, borderColor: t.colors.favorite },
    badge: { minWidth: 16, height: 16, borderRadius: 8, backgroundColor: t.colors.primary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
    badgeText: { fontFamily: 'Inter_700Bold', fontSize: 10, color: '#FFFFFF' },

    pillsRow: { gap: 8, paddingHorizontal: 16, paddingBottom: 8 },
    pill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: t.colors.surface2,
      borderWidth: 1,
      borderColor: 'transparent',
      minHeight: 40,
    },
    pillActive: { backgroundColor: t.colors.primarySoft, borderColor: t.colors.primary },
    pillText: { fontFamily: 'Inter_500Medium', fontSize: 13, color: t.colors.textMuted },
    pillTextActive: { color: t.colors.primaryInk, fontFamily: 'Inter_600SemiBold' },
    pillCount: { fontFamily: 'Inter_700Bold', fontSize: 12, color: t.colors.textMuted },
    pillCountActive: { color: t.colors.primaryInk },

    toolsRow: { gap: 8, paddingHorizontal: 16, paddingBottom: 8, alignItems: 'center' },
    densityIconBtn: { width: 36, height: 36, borderRadius: 8, backgroundColor: t.colors.surface2, alignItems: 'center', justifyContent: 'center' },
    densityIconBtnActive: { backgroundColor: t.colors.surface, ...t.shadow.card },
    toolsSep: { width: 1, height: 20, backgroundColor: t.colors.border },
    shelfPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 11,
      paddingVertical: 7,
      borderRadius: 20,
      backgroundColor: t.colors.surface2,
      borderWidth: 1,
      borderColor: 'transparent',
    },
    shelfPillActive: { backgroundColor: t.colors.primarySoft, borderColor: t.colors.primary },
    shelfPillText: { fontFamily: 'Inter_500Medium', fontSize: 12, color: t.colors.textMuted },
    shelfPillTextActive: { color: t.colors.primaryInk, fontFamily: 'Inter_600SemiBold' },
    manageShelfBtn: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: t.colors.border, justifyContent: 'center', alignItems: 'center' },

    activeChipsRow: { gap: 8, paddingHorizontal: 16, paddingBottom: 8 },
    dismissChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 20 },
    dismissChipText: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },

    emptyFilter: { paddingVertical: 32, alignItems: 'center' },
    emptyFilterText: { fontFamily: 'Inter_400Regular', fontSize: 14, color: t.colors.textMuted, marginTop: 8, textAlign: 'center' },
    emptyResetBtn: { marginTop: 12, borderWidth: 1.5, borderColor: t.colors.primary, borderRadius: t.radius.base, paddingVertical: 10, paddingHorizontal: 20, minHeight: 44 },
    emptyResetBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: t.colors.primary },
  } as const;
}
