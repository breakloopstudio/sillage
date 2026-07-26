// app/(tabs)/collection.tsx — Parfumerie (garde-robe personnelle)

import { useRef, useState, useMemo, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, Alert, type LayoutChangeEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Ionicons from '@react-native-vector-icons/ionicons/static';
import { useAuthContext } from '../../src/contexts/AuthContext';
import { useUserParfum } from '../../src/hooks/useUserParfum';
import { useShelves } from '../../src/hooks/useShelves';
import { useSotd } from '../../src/hooks/useSotd';
import { useWeather } from '../../src/hooks/useWeather';
import { useNetwork } from '../../src/hooks/useNetwork';

import { scoreWardrobeItemForWeather } from '../../src/utils/weather-scoring';
import { saveWeatherCoords } from '../../src/services/user-data';
import { hapticsLight } from '../../src/services/haptics';
import { useTheme, type Theme } from '../../src/theme/ThemeContext';
import EmptyState from '../../src/components/EmptyState';
import AuthGate from '../../src/components/AuthGate';
import Button from '../../src/components/Button';
import FilterSheet from '../../src/components/FilterSheet';
import SOTDCard from '../../src/features/wardrobe/SOTDCard';
import SOTDPicker from '../../src/features/wardrobe/SOTDPicker';
import FilterBar from '../../src/features/wardrobe/FilterBar';
import WardrobeGrid from '../../src/features/wardrobe/WardrobeGrid';
import WardrobeQuickSheet from '../../src/features/wardrobe/WardrobeQuickSheet';
import ShelfManager from '../../src/features/wardrobe/ShelfManager';
import ScentListEntry from '../../src/features/scentlist/ScentListEntry';
import {
  EMPTY_FAVORI_FILTERS,
  countActiveFilters,
  hasActiveFilters,
  matchesFavoriFilters,
  favoriMatchesSearch,
  type FavoritesFilters,
} from '../../src/utils/favori-filters';
import { useNavigationChrome } from '../../src/features/navigation/NavigationChromeContext';
import type { UserParfum, UserParfumStatus } from '../../src/models/user-parfum.interface';

export default function WardrobePage() {
  const { theme } = useTheme();
  const s = useMemo(() => getStyles(theme), [theme]);
  const { user, authReady, isAuthenticated } = useAuthContext();
  const router = useRouter();
  const uid = user?.uid ?? null;

  const { items: allItems, loading, update, remove } = useUserParfum(uid);
  const items = useMemo(() => allItems.filter(i => i.status === 'have' || i.status === 'had'), [allItems]);
  const { shelves, create: createShelf, update: updateShelf, remove: removeShelf } = useShelves(uid);
  const { sotd, setTodaySotd } = useSotd(uid);
  const { isOnline } = useNetwork();
  const { weather, loading: weatherLoading, coords } = useWeather(isAuthenticated && isOnline);
  const { scrollY } = useNavigationChrome();

  const sotdScore = useMemo(() => {
    if (!weather || !sotd) return null;
    const sotdItem = items.find(i => i.parfumId === sotd.parfumId);
    return sotdItem ? scoreWardrobeItemForWeather(sotdItem, weather) : null;
  }, [items, weather, sotd]);
  const sotdEligible = useMemo(() => items.filter(i => i.status === 'have'), [items]);

  const ownershipCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const item of items) counts[item.status] = (counts[item.status] ?? 0) + 1;
    return counts;
  }, [items]);

  const [searchQuery, setSearchQuery] = useState('');
  const [activeOwnership, setActiveOwnership] = useState<string | null>(null);
  const [activeShelfId, setActiveShelfId] = useState<string | null>(null);
  const [activeSort, setActiveSort] = useState<string>('recent');
  const [attrFilters, setAttrFilters] = useState<FavoritesFilters>(EMPTY_FAVORI_FILTERS);
  const [showAttrSheet, setShowAttrSheet] = useState(false);
  const [quickSheetItem, setQuickSheetItem] = useState<UserParfum | null>(null);
  const [shelfManagerVisible, setShelfManagerVisible] = useState(false);
  const [sotdPickerVisible, setSotdPickerVisible] = useState(false);
  const [sotdCardAnchor, setSotdCardAnchor] = useState<number>(0);
  const sotdCardRef = useRef<View>(null);

  const handleSotdCardLayout = useCallback((e: LayoutChangeEvent) => {
    setSotdCardAnchor(e.nativeEvent.layout.y + e.nativeEvent.layout.height);
  }, []);

  const activeAttrCount = useMemo(() => countActiveFilters(attrFilters), [attrFilters]);
  const handleOpenAttrSheet = useCallback(() => setShowAttrSheet(true), []);
  const handleCloseAttrSheet = useCallback(() => setShowAttrSheet(false), []);
  const handleAttrFiltersChange = useCallback((next: FavoritesFilters) => setAttrFilters(next), []);
  const handleAttrReset = useCallback(() => setAttrFilters(EMPTY_FAVORI_FILTERS), []);
  const handleGlobalReset = useCallback(() => {
    setAttrFilters(EMPTY_FAVORI_FILTERS);
    setSearchQuery('');
    setActiveOwnership(null);
    setActiveShelfId(null);
  }, []);

  const lastWeatherCoords = useRef<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !coords || !uid) return;
    const key = `${coords.lat.toFixed(4)},${coords.lon.toFixed(4)}`;
    if (lastWeatherCoords.current === key) return;
    lastWeatherCoords.current = key;
    saveWeatherCoords(uid, coords.lat, coords.lon).catch(() => {});
  }, [isAuthenticated, coords, uid]);

  const filtered = useMemo(() => {
    let result = [...items];
    if (activeOwnership) result = result.filter(i => i.status === activeOwnership);
    if (activeShelfId) result = result.filter(i => i.shelfIds.includes(activeShelfId));
    result = result.filter(i => matchesFavoriFilters(i, attrFilters));
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(i => favoriMatchesSearch(i, q));
    }
    result.sort((a, b) => {
      switch (activeSort) {
        case 'weather':
          return weather
            ? scoreWardrobeItemForWeather(b, weather) - scoreWardrobeItemForWeather(a, weather)
            : b.addedAt.getTime() - a.addedAt.getTime();
        case 'rating': return (Number.isNaN(b.rating) ? 0 : b.rating ?? 0) - (Number.isNaN(a.rating) ? 0 : a.rating ?? 0);
        case 'az': return (a.nom ?? '').localeCompare(b.nom ?? '');
        case 'za': return (b.nom ?? '').localeCompare(a.nom ?? '');
        default: return b.addedAt.getTime() - a.addedAt.getTime();
      }
    });
    return result;
  }, [items, activeOwnership, activeShelfId, attrFilters, searchQuery, activeSort, weather]);

  const handleQuickOwnership = useCallback((status: UserParfumStatus) => {
    if (!quickSheetItem) return;
    update(quickSheetItem.parfumId, { status }).catch(() => {});
    setQuickSheetItem(prev => prev ? { ...prev, status } : null);
  }, [quickSheetItem, update]);

  const handleQuickRating = useCallback((rating: number) => {
    if (!quickSheetItem) return;
    update(quickSheetItem.parfumId, { rating: rating === 0 ? null : rating }).catch(() => {});
    setQuickSheetItem(prev => prev ? { ...prev, rating: rating === 0 ? null : rating } : null);
  }, [quickSheetItem, update]);

  const handleQuickToggleShelf = useCallback((shelfId: string) => {
    if (!quickSheetItem) return;
    const current = quickSheetItem.shelfIds;
    const next = current.includes(shelfId) ? current.filter(id => id !== shelfId) : [...current, shelfId];
    update(quickSheetItem.parfumId, { shelfIds: next }).catch(() => {});
    setQuickSheetItem(prev => prev ? { ...prev, shelfIds: next } : null);
  }, [quickSheetItem, update]);

  const handleQuickToggleSignature = useCallback(() => {
    if (!quickSheetItem) return;
    const next = !quickSheetItem.isSignature;
    if (next && items.filter(i => i.isSignature).length >= 3) {
      Alert.alert('Limite atteinte', 'Tu as déjà 3 signatures. Retires-en une avant d\'en ajouter.');
      return;
    }
    update(quickSheetItem.parfumId, { isSignature: next }).catch(() => {});
    setQuickSheetItem(prev => prev ? { ...prev, isSignature: next } : null);
  }, [quickSheetItem, update, items]);

  const signatureCount = useMemo(() => items.filter(i => i.isSignature).length, [items]);

  const handleQuickRemove = useCallback(() => {
    if (!quickSheetItem) return;
    Alert.alert('Retirer', 'Retirer ce parfum de la parfumerie ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Retirer', style: 'destructive', onPress: () => { remove(quickSheetItem.parfumId).catch(() => {}); setQuickSheetItem(null); } },
    ]);
  }, [quickSheetItem, remove]);

  const handleEmptyExplore = useCallback(() => router.push('/(tabs)'), [router]);
  const handleEmptyScan = useCallback(() => router.push('/scan'), [router]);
  const handleSotdPress = useCallback(() => { if (sotd) router.push(`/wardrobe/${sotd.parfumId}`); }, [sotd, router]);
  const handleSotdChangePress = useCallback(() => setSotdPickerVisible(true), []);
  const handleScentListPress = useCallback(() => router.push({ pathname: '/(tabs)/selection', params: { segment: 'carnet' } }), [router]);
  const handleManageShelves = useCallback(() => setShelfManagerVisible(true), []);
  const handleCloseQuickSheet = useCallback(() => setQuickSheetItem(null), []);
  const handleViewMore = useCallback(() => {
    const id = quickSheetItem?.parfumId;
    setQuickSheetItem(null);
    if (id) router.push(`/wardrobe/${id}`);
  }, [quickSheetItem, router]);
  const handleCloseShelfManager = useCallback(() => setShelfManagerVisible(false), []);
  const handleCreateShelf = useCallback((name: string, icon?: string, color?: string) => { createShelf(name, icon, color); }, [createShelf]);
  const handleRenameShelf = useCallback((id: string, name: string) => { updateShelf(id, { name }); }, [updateShelf]);
  const handleSotdSelect = useCallback((parfumId: string) => {
    if (parfumId === sotd?.parfumId) {
      setSotdPickerVisible(false);
      return;
    }
    const item = sotdEligible.find(i => i.parfumId === parfumId);
    if (item) {
      hapticsLight();
      setTodaySotd(item).catch(() => {});
    }
    setSotdPickerVisible(false);
  }, [sotd, sotdEligible, setTodaySotd]);
  const handleCloseSotdPicker = useCallback(() => setSotdPickerVisible(false), []);

  if (!authReady) return <View style={s.center}><ActivityIndicator size="large" color={theme.colors.primary} /></View>;

  if (!isAuthenticated) {
    return (
      <SafeAreaView edges={['bottom']} style={s.container}>
        <AuthGate icon="flask-outline" description="Accède à ta parfumerie." />
      </SafeAreaView>
    );
  }

  if (items.length === 0 && !loading) {
    return (
      <SafeAreaView edges={['bottom']} style={s.container}>
        <View style={s.header}>
          <Text style={s.title}>Ma Parfumerie</Text>
        </View>
        <EmptyState variant="wardrobe" onAction={handleEmptyExplore} />
        <View style={s.emptyCtaRow}>
          <Button variant="outline" onPress={handleEmptyScan} icon="camera-outline" style={s.emptyCtaBtn}>
            Scanner un flacon
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['bottom']} style={s.container}>
      <View style={s.header}>
          <Text style={s.title}>Ma Parfumerie · {items.length}</Text>
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

      {allItems.filter(i => i.status === 'to_try' || i.status === 'tried').length > 0 && (
        <ScentListEntry
          toTryCount={allItems.filter(i => i.status === 'to_try').length}
          triedCount={allItems.filter(i => i.status === 'tried').length}
          onPress={handleScentListPress}
        />
      )}

      <FilterBar
        shelves={shelves}
        activeOwnership={activeOwnership}
        activeShelfId={activeShelfId}
        activeSort={activeSort}
        searchQuery={searchQuery}
        ownershipCounts={ownershipCounts}
        onOwnershipChange={setActiveOwnership}
        onShelfChange={setActiveShelfId}
        onSortChange={setActiveSort}
        onSearchChange={setSearchQuery}
        onManageShelves={handleManageShelves}
        attrFilters={attrFilters}
        attrCount={activeAttrCount}
        onOpenAttrSheet={handleOpenAttrSheet}
        onAttrFiltersChange={handleAttrFiltersChange}
      />

      {filtered.length === 0 && items.length > 0 && (activeAttrCount > 0 || searchQuery.trim().length > 0 || activeOwnership || activeShelfId) && (
        <View style={s.emptyFilter}>
          <Ionicons name="funnel-outline" size={28} color={theme.colors.textMuted} />
          <Text style={s.emptyFilterText}>
            {activeAttrCount > 0 ? 'Aucun parfum ne correspond à ces filtres' : `Aucun résultat pour « ${searchQuery.trim()} »`}
          </Text>
          <Pressable style={s.emptyResetBtn} onPress={handleGlobalReset}>
            <Text style={s.emptyResetBtnText}>Réinitialiser</Text>
          </Pressable>
        </View>
      )}

      <WardrobeGrid
        items={filtered}
        loading={loading}
        onItemPress={setQuickSheetItem}
        scrollY={scrollY}
      />

      <WardrobeQuickSheet
        visible={quickSheetItem !== null}
        item={quickSheetItem}
        shelves={shelves}
        signatureCount={signatureCount}
        onClose={handleCloseQuickSheet}
        onStatusChange={handleQuickOwnership}
        onRatingChange={handleQuickRating}
        onToggleShelf={handleQuickToggleShelf}
        onToggleSignature={handleQuickToggleSignature}
        onViewMore={handleViewMore}
        onRemove={handleQuickRemove}
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
        onClose={handleCloseSotdPicker}
      />
      <FilterSheet
        visible={showAttrSheet}
        items={items}
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
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
    title: { fontFamily: 'PlayfairDisplay_700Bold', fontSize: 22, color: t.colors.text, flex: 1 },
    emptyCtaRow: { alignItems: 'center', marginTop: 8 },
    emptyCtaBtn: { minWidth: 200 },
    emptyFilter: {
      paddingVertical: 24,
      alignItems: 'center' as const,
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
  } as const;
}
