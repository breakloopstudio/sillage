// app/(tabs)/favoris.tsx — Favoris (couche intention : tous les ❤️ + alertes prix)

import { useState, useMemo, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { useAnimatedScrollHandler } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import Ionicons from '@react-native-vector-icons/ionicons/static';
import { useAuthContext } from '../../src/contexts/AuthContext';
import { useFavorisContext } from '../../src/contexts/FavorisContext';
import { useUserParfumContext } from '../../src/contexts/UserParfumContext';
import { usePriceAlertsContext } from '../../src/contexts/PriceAlertsContext';
import { useDensityPreference, GRID_MODES } from '../../src/hooks/useDensityPreference';
import { useNavigationChrome } from '../../src/features/navigation/NavigationChromeContext';
import { useTheme, type Theme } from '../../src/theme/ThemeContext';
import { setPendingParfum } from '../../src/services/catalog-bridge';
import { hapticsLight, hapticsError } from '../../src/services/haptics';
import { favoriMatchesSearch } from '../../src/utils/favori-filters';
import { alertVariation, formatVariation } from '../../src/utils/price-alerts';
import { formatPrice } from '../../src/utils/format-price';
import EmptyState from '../../src/components/EmptyState';
import AuthGate from '../../src/components/AuthGate';
import ParfumCard from '../../src/components/ParfumCard';
import FavoriSheet from '../../src/components/FavoriSheet';
import PriceAlertSheet from '../../src/components/PriceAlertSheet';
import type { UserFavori, Parfum } from '../../src/models';
import type { UserParfumStatus } from '../../src/models/user-parfum.interface';

type FavPillId = 'all' | 'untreated' | 'alerts';

const FAV_PILLS: { id: FavPillId; label: string; icon: string }[] = [
  { id: 'all',       label: 'Tous',       icon: 'apps-outline' },
  { id: 'untreated', label: 'À traiter',  icon: 'eye-outline' },
  { id: 'alerts',    label: 'Alertes',    icon: 'notifications-outline' },
];

const DENSITY_ICON: Record<string, string> = {
  comfortable: 'grid-outline',
  compactPlus: 'apps-outline',
  list: 'list-outline',
};

function favoriToCard(f: UserFavori): Parfum {
  return {
    id: f.parfumId,
    nom: f.nom ?? '',
    marque: f.marque ?? '',
    imageUrl: f.imageUrl ?? undefined,
    familleOlactive: f.familleOlactive ?? '',
    bestPrice: f.bestPrice,
    referencePrice: f.referencePrice,
    annee: f.annee,
  } as Parfum;
}

interface AlertRow {
  parfumId: string;
  nom: string;
  marque: string;
  imageUrl: string | null;
  currentPrice: number | null;
  targetPrice: number | null;
  variation: number | null;
}

export default function FavorisPage() {
  const { theme, resolvedMode } = useTheme();
  const s = useMemo(() => getStyles(theme), [theme]);
  const { user, authReady, isAuthenticated } = useAuthContext();
  const router = useRouter();
  const uid = user?.uid ?? null;
  const keyboardAppearance = resolvedMode === 'dark' ? 'dark' : 'light';

  const { favoris, removeFavori } = useFavorisContext();
  const { items, loading: upLoading, add, update, statusByParfumId } = useUserParfumContext();
  const { alerts, byParfumId, setAlert } = usePriceAlertsContext();
  const { density, setDensity } = useDensityPreference();
  const { scrollY } = useNavigationChrome();

  const scrollHandler = useAnimatedScrollHandler((e) => { scrollY.value = e.contentOffset.y; });

  const [activePill, setActivePill] = useState<FavPillId>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sheetItem, setSheetItem] = useState<UserFavori | null>(null);
  const [alertTarget, setAlertTarget] = useState<UserFavori | null>(null);

  const displayMap = useMemo(() => {
    const m = new Map<string, { nom: string | null; marque: string | null; imageUrl: string | null; bestPrice?: number }>();
    for (const up of items) m.set(up.parfumId, { nom: up.nom, marque: up.marque, imageUrl: up.imageUrl, bestPrice: up.bestPrice });
    for (const f of favoris) m.set(f.parfumId, { nom: f.nom ?? null, marque: f.marque ?? null, imageUrl: f.imageUrl ?? null, bestPrice: f.bestPrice });
    return m;
  }, [items, favoris]);

  const alertRows = useMemo<AlertRow[]>(() => {
    const rows: AlertRow[] = [];
    for (const a of alerts) {
      const d = displayMap.get(a.parfumId);
      if (!d) continue;
      const currentPrice = a.lastPrice ?? d.bestPrice ?? null;
      rows.push({
        parfumId: a.parfumId,
        nom: d.nom ?? '',
        marque: d.marque ?? '',
        imageUrl: d.imageUrl ?? null,
        currentPrice,
        targetPrice: a.targetPrice,
        variation: alertVariation(a.initialPrice, currentPrice),
      });
    }
    return rows.sort((x, y) => (x.variation ?? 0) - (y.variation ?? 0));
  }, [alerts, displayMap]);

  const pillCounts = useMemo(() => {
    const counts: Record<FavPillId, number> = { all: favoris.length, untreated: 0, alerts: 0 };
    for (const f of favoris) {
      if (!statusByParfumId.has(f.parfumId)) counts.untreated += 1;
      if (byParfumId.has(f.parfumId)) counts.alerts += 1;
    }
    return counts;
  }, [favoris, statusByParfumId, byParfumId]);

  const filtered = useMemo(() => {
    let result = favoris;
    if (activePill === 'untreated') result = result.filter(f => !statusByParfumId.has(f.parfumId));
    else if (activePill === 'alerts') result = result.filter(f => byParfumId.has(f.parfumId));
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(f => favoriMatchesSearch(f, q));
    }
    return result;
  }, [favoris, activePill, statusByParfumId, byParfumId, searchQuery]);

  const handleCardPress = useCallback((f: UserFavori) => {
    setPendingParfum(favoriToCard(f));
    router.push(`/catalog/${f.parfumId}`);
  }, [router]);

  const handleLongPress = useCallback((f: UserFavori) => setSheetItem(f), []);

  const handleSheetView = useCallback(() => {
    if (sheetItem) handleCardPress(sheetItem);
    setSheetItem(null);
  }, [sheetItem, handleCardPress]);

  const handleSheetAlerte = useCallback(() => {
    setAlertTarget(sheetItem);
    setSheetItem(null);
  }, [sheetItem]);

  const handleSheetStatus = useCallback((status: UserParfumStatus) => {
    if (!sheetItem) return;
    if (statusByParfumId.has(sheetItem.parfumId)) {
      update(sheetItem.parfumId, { status }).catch(() => { hapticsError(); });
    } else {
      add(sheetItem.parfumId, status, favoriToCard(sheetItem)).catch(() => { hapticsError(); });
    }
    setSheetItem(null);
  }, [sheetItem, statusByParfumId, add, update]);

  const handleSheetRemove = useCallback(() => {
    if (sheetItem) removeFavori(sheetItem.parfumId);
    setSheetItem(null);
  }, [sheetItem, removeFavori]);

  const handleAlertSave = useCallback((active: boolean, targetPrice: number | null) => {
    if (alertTarget) {
      setAlert(alertTarget.parfumId, active, { targetPrice }).catch(() => { hapticsError(); });
    }
    setAlertTarget(null);
  }, [alertTarget, setAlert]);

  const handleAlertCardPress = useCallback((row: AlertRow) => {
    router.push(`/catalog/${row.parfumId}`);
  }, [router]);

  const handleAlertDisable = useCallback((parfumId: string) => {
    hapticsLight();
    setAlert(parfumId, false).catch(() => { hapticsError(); });
  }, [setAlert]);

  const handlePillTap = useCallback((pill: FavPillId) => { hapticsLight(); setActivePill(pill); }, []);
  const handleEmptyExplore = useCallback(() => router.push('/(tabs)'), [router]);

  const gridNumCols = density === 'list' ? 1 : 2;
  const gridKey = `${gridNumCols}col-${resolvedMode}`;

  const renderItem = useCallback(({ item }: { item: UserFavori }) => {
    const status = statusByParfumId.get(item.parfumId) ?? null;
    const alert = byParfumId.get(item.parfumId) ?? null;
    const variation = alert ? alertVariation(alert.initialPrice, alert.lastPrice ?? item.bestPrice ?? null) : null;
    return (
      <View style={gridNumCols === 2 ? s.gridItemWrap : s.listItemWrap}>
        <ParfumCard
          parfum={favoriToCard(item)}
          mode={density}
          status={status}
          priceAlert={alert ? { variation } : null}
          onPressOverride={() => handleCardPress(item)}
          onLongPress={() => handleLongPress(item)}
        />
      </View>
    );
  }, [density, gridNumCols, statusByParfumId, byParfumId, handleCardPress, handleLongPress, s]);

  if (!authReady) {
    return <View style={s.center}><ActivityIndicator size="large" color={theme.colors.primary} /></View>;
  }

  if (!isAuthenticated) {
    return (
      <SafeAreaView edges={['bottom']} style={s.container}>
        <AuthGate icon="heart-outline" description="Retrouve tes coups de cœur et tes alertes prix." />
      </SafeAreaView>
    );
  }

  if (upLoading) {
    return (
      <SafeAreaView edges={['bottom']} style={s.container}>
        <View style={s.header}><Text style={s.title}>Favoris</Text></View>
        <ActivityIndicator style={s.loadingSpinner} color={theme.colors.primary} />
      </SafeAreaView>
    );
  }

  if (favoris.length === 0) {
    return (
      <SafeAreaView edges={['bottom']} style={s.container}>
        <View style={s.header}><Text style={s.title}>Favoris</Text></View>
        <EmptyState variant="favoris" onAction={handleEmptyExplore} />
      </SafeAreaView>
    );
  }

  const sheetStatus = sheetItem ? statusByParfumId.get(sheetItem.parfumId) ?? null : null;
  const sheetHasAlert = sheetItem ? byParfumId.has(sheetItem.parfumId) : false;
  const alertExisting = alertTarget ? byParfumId.get(alertTarget.parfumId) ?? null : null;

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
              <Text style={s.title}>Favoris{'\u00A0'}·{'\u00A0'}{favoris.length}</Text>
            </View>

            {alertRows.length > 0 ? (
              <View style={s.alertsSection}>
                <View style={s.alertsHeader}>
                  <Ionicons name="notifications" size={15} color={theme.colors.primary} />
                  <Text style={s.alertsTitle}>Tes alertes</Text>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.alertsRow}>
                  {alertRows.map(row => {
                    const isDrop = row.variation != null && row.variation < 0;
                    return (
                      <Pressable key={row.parfumId} style={s.alertCard} onPress={() => handleAlertCardPress(row)} accessibilityRole="button" accessibilityLabel={`${row.marque} ${row.nom}`}>
                        {row.imageUrl ? (
                          <Image source={{ uri: row.imageUrl }} style={s.alertImg} contentFit="contain" transition={200} />
                        ) : (
                          <View style={[s.alertImg, s.alertImgPlaceholder]}>
                            <Ionicons name="flask-outline" size={18} color={theme.colors.textMuted} />
                          </View>
                        )}
                        <View style={s.alertBody}>
                          <Text style={s.alertName} numberOfLines={2}>{row.nom}</Text>
                          <View style={s.alertPriceRow}>
                            {row.currentPrice != null ? <Text style={s.alertPrice}>{formatPrice(row.currentPrice, { decimals: 0 })}</Text> : null}
                            {row.variation != null ? (
                              <View style={[s.alertVarChip, { backgroundColor: isDrop ? theme.colors.dealSoft : theme.colors.surface2 }]}>
                                <Text style={[s.alertVarText, { color: isDrop ? theme.colors.dealInk : theme.colors.textMuted }]} allowFontScaling={false}>{formatVariation(row.variation)}</Text>
                              </View>
                            ) : null}
                          </View>
                          {row.targetPrice != null ? <Text style={s.alertTarget}>Cible {formatPrice(row.targetPrice, { decimals: 0 })}</Text> : null}
                        </View>
                        <Pressable style={s.alertOffBtn} onPress={() => handleAlertDisable(row.parfumId)} hitSlop={6} accessibilityRole="button" accessibilityLabel="Désactiver l\u2019alerte">
                          <Ionicons name="notifications-off-outline" size={16} color={theme.colors.textMuted} />
                        </Pressable>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            ) : null}

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
              {GRID_MODES.map(m => (
                <Pressable
                  key={m.key}
                  style={[s.densityIconBtn, density === m.key && s.densityIconBtnActive]}
                  onPress={() => setDensity(m.key)}
                  hitSlop={{ top: 2, bottom: 2, left: 2, right: 2 }}
                  accessibilityRole="button"
                  accessibilityLabel={m.label}
                >
                  <Ionicons name={DENSITY_ICON[m.key] as never} size={18} color={density === m.key ? theme.colors.primary : theme.colors.textMuted} />
                </Pressable>
              ))}
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.pillsRow}>
              {FAV_PILLS.map(pill => {
                const active = activePill === pill.id;
                return (
                  <Pressable
                    key={pill.id}
                    style={[s.pill, active && s.pillActive]}
                    onPress={() => handlePillTap(pill.id)}
                    hitSlop={{ top: 2, bottom: 2 }}
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

            {filtered.length === 0 ? (
              <View style={s.emptyFilter}>
                <Ionicons name="heart-outline" size={28} color={theme.colors.textMuted} />
                <Text style={s.emptyFilterText}>
                  {searchQuery.trim() || activePill !== 'all' ? 'Aucun parfum ne correspond à cette vue' : 'Aucun favori pour l\u2019instant'}
                </Text>
              </View>
            ) : null}
          </View>
        }
      />

      <FavoriSheet
        visible={sheetItem !== null}
        nom={sheetItem?.nom ?? ''}
        marque={sheetItem?.marque ?? ''}
        imageUrl={sheetItem?.imageUrl ?? null}
        status={sheetStatus}
        hasAlert={sheetHasAlert}
        onClose={() => setSheetItem(null)}
        onView={handleSheetView}
        onAlerte={handleSheetAlerte}
        onSetStatus={handleSheetStatus}
        onRemove={handleSheetRemove}
      />

      <PriceAlertSheet
        visible={alertTarget !== null}
        parfumId={alertTarget?.parfumId ?? ''}
        nom={alertTarget?.nom ?? ''}
        marque={alertTarget?.marque ?? ''}
        imageUrl={alertTarget?.imageUrl ?? null}
        bestPrice={alertTarget?.bestPrice}
        referencePrice={alertTarget?.referencePrice}
        existingAlert={alertExisting}
        onClose={() => setAlertTarget(null)}
        onSave={handleAlertSave}
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

    alertsSection: { paddingTop: 8, paddingBottom: 4 },
    alertsHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingBottom: 8 },
    alertsTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: t.colors.text },
    alertsRow: { gap: 10, paddingHorizontal: 16 },
    alertCard: {
      flexDirection: 'row', alignItems: 'center', gap: 10, width: 240,
      backgroundColor: t.colors.surface, borderRadius: t.radius.card, padding: 10,
      borderWidth: 1, borderColor: t.colors.border, ...t.shadow.card,
    },
    alertImg: { width: 44, height: 58, borderRadius: t.radius.sm, backgroundColor: t.colors.surface2 },
    alertImgPlaceholder: { justifyContent: 'center', alignItems: 'center' },
    alertBody: { flex: 1, minWidth: 0, gap: 3 },
    alertName: { fontFamily: 'PlayfairDisplay_600SemiBold', fontSize: 13, color: t.colors.text },
    alertPriceRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    alertPrice: { fontFamily: 'Inter_700Bold', fontSize: 14, color: t.colors.text, fontVariant: ['tabular-nums'] as import('react-native').FontVariant[] },
    alertVarChip: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10 },
    alertVarText: { fontFamily: 'Inter_700Bold', fontSize: 10 },
    alertTarget: { fontFamily: 'Inter_400Regular', fontSize: 11, color: t.colors.textMuted },
    alertOffBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },

    searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, marginTop: 8, marginBottom: 8 },
    searchWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: t.colors.surface2, borderRadius: 20, paddingHorizontal: 12, height: 40, gap: 8 },
    searchInput: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 14, color: t.colors.text },
    densityIconBtn: { width: 40, height: 40, borderRadius: 8, backgroundColor: t.colors.surface2, alignItems: 'center', justifyContent: 'center' },
    densityIconBtnActive: { backgroundColor: t.colors.surface, ...t.shadow.card },

    pillsRow: { gap: 8, paddingHorizontal: 16, paddingBottom: 8 },
    pill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: t.colors.surface2, borderWidth: 1, borderColor: 'transparent', minHeight: 40 },
    pillActive: { backgroundColor: t.colors.primarySoft, borderColor: t.colors.primary },
    pillText: { fontFamily: 'Inter_500Medium', fontSize: 13, color: t.colors.textMuted },
    pillTextActive: { color: t.colors.primaryInk, fontFamily: 'Inter_600SemiBold' },
    pillCount: { fontFamily: 'Inter_700Bold', fontSize: 12, color: t.colors.textMuted },
    pillCountActive: { color: t.colors.primaryInk },

    emptyFilter: { paddingVertical: 32, alignItems: 'center' },
    emptyFilterText: { fontFamily: 'Inter_400Regular', fontSize: 14, color: t.colors.textMuted, marginTop: 8, textAlign: 'center' },
  } as const;
}
