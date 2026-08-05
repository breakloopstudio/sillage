// app/(tabs)/favoris.tsx — Favoris (couche intention : tous les ❤️ + alertes prix)

import { useState, useMemo, useCallback, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, TextInput, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { useAnimatedScrollHandler } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import i18next from 'i18next';
import Ionicons from '@react-native-vector-icons/ionicons/static';
import { useAuthContext } from '../../src/contexts/AuthContext';
import { useFavorisContext } from '../../src/contexts/FavorisContext';
import { useUserParfumContext } from '../../src/contexts/UserParfumContext';
import { usePriceAlertsContext } from '../../src/contexts/PriceAlertsContext';
import { useDensityPreference, GRID_MODES } from '../../src/hooks/useDensityPreference';
import { useFavorisViewPreference, type FavorisView } from '../../src/hooks/useFavorisViewPreference';
import { useNavigationChrome } from '../../src/features/navigation/NavigationChromeContext';
import { useTheme, type Theme } from '../../src/theme/ThemeContext';
import { setPendingParfum } from '../../src/services/catalog-bridge';
import { getParfumsByIds, getParfumById } from '../../src/services/catalog';
import { getLowestObservedPrices } from '../../src/services/user-data';
import { hapticsLight, hapticsError } from '../../src/services/haptics';
import { favoriMatchesSearch } from '../../src/utils/favori-filters';
import { alertVariation, formatVariation, priceAlertState, priceAlertDropAbs, alertProgress, watchSavings } from '../../src/utils/price-alerts';
import { priceTier } from '../../src/utils/price-tier';
import { formatPrice } from '../../src/utils/format-price';
import { formatRelativeShort } from '../../src/utils/relative-date';
import EmptyState from '../../src/components/EmptyState';
import AuthGate from '../../src/components/AuthGate';
import ParfumCard from '../../src/components/ParfumCard';
import FavoriSheet from '../../src/components/FavoriSheet';
import PriceAlertSheet from '../../src/components/PriceAlertSheet';
import ActionSheet, { type ActionItem } from '../../src/components/ActionSheet';
import PermissionPrimer from '../../src/components/PermissionPrimer';
import { usePushPrimer } from '../../src/hooks/usePushPrimer';
import { PERMISSION_PRIMERS } from '../../src/utils/permission-primers';
import type { UserFavori, Parfum } from '../../src/models';
import type { UserParfumStatus } from '../../src/models/user-parfum.interface';

type FavPillId = 'all' | 'untreated';

// Labels résolus à l'affichage via getters i18next (§23) — jamais lus au scope module.
const FAV_PILLS: { id: FavPillId; label: string; icon: string }[] = [
  { id: 'all',       get label() { return i18next.t('favorites.pills.all'); },       icon: 'apps-outline' },
  { id: 'untreated', get label() { return i18next.t('favorites.pills.untreated'); }, icon: 'eye-outline' },
];

const FAV_VIEW_TABS: { key: FavorisView; label: string; icon: string }[] = [
  { key: 'favoris', get label() { return i18next.t('favorites.viewTabs.favoris'); }, icon: 'heart-outline' },
  { key: 'alerts',  get label() { return i18next.t('favorites.viewTabs.alerts'); },  icon: 'notifications-outline' },
];

const DENSITY_ICON: Record<string, string> = {
  comfortable: 'grid-outline',
  compactPlus: 'apps-outline',
  list: 'list-outline',
};

interface DisplayInfo {
  nom: string | null;
  marque: string | null;
  imageUrl: string | null;
  bestPrice?: number;
  referencePrice?: number;
}

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
  initialPrice: number | null;
  referencePrice: number | null;
  variation: number | null;
  lastChecked: Date | null;
}

interface AlertEditTarget {
  parfumId: string;
  nom: string;
  marque: string;
  imageUrl: string | null;
  bestPrice?: number;
  referencePrice?: number;
}

function isReached(r: AlertRow): boolean {
  return priceAlertState(r.targetPrice, r.currentPrice) === 'reached';
}

export default function FavorisPage() {
  const { theme, resolvedMode } = useTheme();
  const s = useMemo(() => getStyles(theme), [theme]);
  const { t } = useTranslation('common');
  const { user, authReady, isAuthenticated } = useAuthContext();
  const router = useRouter();
  const uid = user?.uid ?? null;
  const keyboardAppearance = resolvedMode === 'dark' ? 'dark' : 'light';

  const { favoris, removeFavori } = useFavorisContext();
  const { items, loading: upLoading, add, update, statusByParfumId } = useUserParfumContext();
  const { alerts, byParfumId, setAlert } = usePriceAlertsContext();
  const pushPrimer = usePushPrimer(uid);
  const { density, setDensity } = useDensityPreference();
  const { scrollY, resetDock } = useNavigationChrome();

  const scrollHandler = useAnimatedScrollHandler((e) => { scrollY.value = e.contentOffset.y; });

  const { view: viewPref, setView: setViewPref } = useFavorisViewPreference();
  const effectiveView: FavorisView = viewPref ?? 'favoris';

  const [activePill, setActivePill] = useState<FavPillId>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [reachedOnly, setReachedOnly] = useState(false);
  const [sheetItem, setSheetItem] = useState<UserFavori | null>(null);
  const [alertTarget, setAlertTarget] = useState<AlertEditTarget | null>(null);
  const [alertMenu, setAlertMenu] = useState<AlertRow | null>(null);
  const [lowestMap, setLowestMap] = useState<Map<string, number>>(() => new Map());
  const [catalogFallback, setCatalogFallback] = useState<Map<string, DisplayInfo>>(new Map());

  const displayMap = useMemo<Map<string, DisplayInfo>>(() => {
    const m = new Map<string, DisplayInfo>();
    for (const up of items) m.set(up.parfumId, { nom: up.nom, marque: up.marque, imageUrl: up.imageUrl, bestPrice: up.bestPrice, referencePrice: up.referencePrice });
    for (const f of favoris) m.set(f.parfumId, { nom: f.nom ?? null, marque: f.marque ?? null, imageUrl: f.imageUrl ?? null, bestPrice: f.bestPrice, referencePrice: f.referencePrice });
    return m;
  }, [items, favoris]);

  // Alertes orphelines : un parfum alerté depuis une fiche (ni favori ni en parfumerie)
  // n'est dans aucune source utilisateur. On le résout via le catalogue pour qu'il reste
  // visible (sinon le push « prix atteint » pointerait vers une alerte invisible).
  const orphanIds = useMemo(() => alerts.filter(a => !displayMap.has(a.parfumId)).map(a => a.parfumId), [alerts, displayMap]);
  useEffect(() => {
    let cancelled = false;
    if (orphanIds.length === 0) { setCatalogFallback(new Map()); return; }
    getParfumsByIds(orphanIds).then((list) => {
      if (cancelled) return;
      const m = new Map<string, DisplayInfo>();
      for (const p of list) m.set(p.id, { nom: p.nom, marque: p.marque, imageUrl: p.imageUrl ?? null, bestPrice: p.bestPrice, referencePrice: p.referencePrice });
      setCatalogFallback(m);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [orphanIds]);

  const mergedDisplay = useMemo<Map<string, DisplayInfo>>(() => {
    const m = new Map(catalogFallback);
    displayMap.forEach((v, k) => m.set(k, v));
    return m;
  }, [displayMap, catalogFallback]);

  const alertRows = useMemo<AlertRow[]>(() => {
    const rows: AlertRow[] = [];
    for (const a of alerts) {
      const d = mergedDisplay.get(a.parfumId);
      if (!d) continue;
      const currentPrice = a.lastPrice ?? d.bestPrice ?? null;
      rows.push({
        parfumId: a.parfumId,
        nom: d.nom ?? '',
        marque: d.marque ?? '',
        imageUrl: d.imageUrl ?? null,
        currentPrice,
        targetPrice: a.targetPrice,
        initialPrice: a.initialPrice,
        referencePrice: d.referencePrice ?? null,
        variation: alertVariation(a.initialPrice, currentPrice),
        lastChecked: a.lastChecked,
      });
    }
    return rows.sort((x, y) => {
      const bucket = (r: AlertRow) => {
        if (isReached(r)) return 0;
        const da = priceAlertDropAbs(r.initialPrice, r.currentPrice);
        return da != null && da !== 0 ? 1 : 2;
      };
      const bx = bucket(x);
      const by = bucket(y);
      if (bx !== by) return bx - by;
      if (bx === 1) return (priceAlertDropAbs(x.initialPrice, x.currentPrice) ?? 0) - (priceAlertDropAbs(y.initialPrice, y.currentPrice) ?? 0);
      return (x.variation ?? 0) - (y.variation ?? 0);
    });
  }, [alerts, mergedDisplay]);

  const reachedCount = useMemo(() => alertRows.filter(isReached).length, [alertRows]);

  const alertIdsKey = useMemo(() => alertRows.map(r => r.parfumId).join(','), [alertRows]);
  useEffect(() => {
    let cancelled = false;
    if (!alertIdsKey) { setLowestMap(new Map()); return; }
    getLowestObservedPrices(alertIdsKey.split(',')).then(m => { if (!cancelled) setLowestMap(m); }).catch(() => {});
    return () => { cancelled = true; };
  }, [alertIdsKey]);

  const watchSavingsTotal = useMemo(() => watchSavings(alertRows), [alertRows]);

  const suggestions = useMemo<AlertEditTarget[]>(() => {
    const rows: AlertEditTarget[] = [];
    for (const f of favoris) {
      if (byParfumId.has(f.parfumId) || f.bestPrice == null) continue;
      rows.push({ parfumId: f.parfumId, nom: f.nom ?? '', marque: f.marque ?? '', imageUrl: f.imageUrl ?? null, bestPrice: f.bestPrice, referencePrice: f.referencePrice });
      if (rows.length >= 3) break;
    }
    return rows;
  }, [favoris, byParfumId]);

  const alertRowsFiltered = useMemo(() => {
    let r = alertRows;
    if (reachedOnly && reachedCount > 0) r = r.filter(isReached);
    const q = searchQuery.trim().toLowerCase();
    if (q) r = r.filter(x => x.nom.toLowerCase().includes(q) || x.marque.toLowerCase().includes(q));
    return r;
  }, [alertRows, reachedOnly, reachedCount, searchQuery]);

  const pillCounts = useMemo(() => {
    const counts: Record<FavPillId, number> = { all: favoris.length, untreated: 0 };
    for (const f of favoris) {
      if (!statusByParfumId.has(f.parfumId)) counts.untreated += 1;
    }
    return counts;
  }, [favoris, statusByParfumId]);

  const filtered = useMemo(() => {
    let result = favoris;
    if (activePill === 'untreated') result = result.filter(f => !statusByParfumId.has(f.parfumId));
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(f => favoriMatchesSearch(f, q));
    }
    return result;
  }, [favoris, activePill, statusByParfumId, searchQuery]);

  const handleCardPress = useCallback((f: UserFavori) => {
    setPendingParfum(favoriToCard(f));
    router.push(`/catalog/${f.parfumId}`);
  }, [router]);

  const goToParfum = useCallback(async (parfumId: string) => {
    try {
      const p = await getParfumById(parfumId);
      if (p) setPendingParfum(p);
    } catch (e: unknown) { console.warn('[favoris] getParfumById failed:', (e as Error)?.message ?? String(e)); }
    router.push(`/catalog/${parfumId}`);
  }, [router]);

  const handleLongPress = useCallback((f: UserFavori) => { hapticsLight(); setSheetItem(f); }, []);

  const handleSheetView = useCallback(() => {
    if (sheetItem) handleCardPress(sheetItem);
    setSheetItem(null);
  }, [sheetItem, handleCardPress]);

  const handleSheetAlerte = useCallback(() => {
    if (sheetItem) {
      setAlertTarget({
        parfumId: sheetItem.parfumId,
        nom: sheetItem.nom ?? '',
        marque: sheetItem.marque ?? '',
        imageUrl: sheetItem.imageUrl ?? null,
        bestPrice: sheetItem.bestPrice,
        referencePrice: sheetItem.referencePrice,
      });
    }
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

  const handleAlertSave = useCallback(async (active: boolean, targetPrice: number | null) => {
    if (!alertTarget) { setAlertTarget(null); return; }
    try {
      if (active) {
        const isCreate = !byParfumId.has(alertTarget.parfumId);
        if (isCreate) {
          let currentPrice = alertTarget.bestPrice;
          try {
            const live = (await getParfumById(alertTarget.parfumId))?.bestPrice;
            if (live != null) currentPrice = live;
          } catch { /* fallback sur le prix dénormalisé */ }
          await setAlert(alertTarget.parfumId, true, { targetPrice, currentPrice });
        } else {
          await setAlert(alertTarget.parfumId, true, { targetPrice });
        }
        // Moment de valeur : l'utilisateur vient de créer/activer une alerte →
        // proposer les notifications (jamais de prompt à froid, primer 1 fois).
        void pushPrimer.propose();
      } else {
        await setAlert(alertTarget.parfumId, false);
      }
    } catch { hapticsError(); }
    setAlertTarget(null);
  }, [alertTarget, byParfumId, setAlert, pushPrimer]);

  const handleAlertCardPress = useCallback((row: AlertRow) => {
    setAlertTarget({
      parfumId: row.parfumId,
      nom: row.nom,
      marque: row.marque,
      imageUrl: row.imageUrl,
      bestPrice: row.currentPrice ?? undefined,
      referencePrice: row.referencePrice ?? undefined,
    });
  }, []);

  const handleAlertLongPress = useCallback((row: AlertRow) => {
    hapticsLight();
    setAlertMenu(row);
  }, []);

  const handleAlertMenuView = useCallback(() => {
    if (alertMenu) void goToParfum(alertMenu.parfumId);
    setAlertMenu(null);
  }, [alertMenu, goToParfum]);

  const handleAlertMenuEdit = useCallback(() => {
    if (alertMenu) handleAlertCardPress(alertMenu);
    setAlertMenu(null);
  }, [alertMenu, handleAlertCardPress]);

  const handleAlertMenuDisable = useCallback(() => {
    if (alertMenu) {
      hapticsError();
      setAlert(alertMenu.parfumId, false).catch(() => {});
    }
    setAlertMenu(null);
  }, [alertMenu, setAlert]);

  const alertMenuActions = useMemo<ActionItem[]>(() => [
    { icon: 'eye-outline', label: t('favorites.alertMenu.view'), onPress: handleAlertMenuView },
    { icon: 'create-outline', label: t('favorites.alertMenu.edit'), onPress: handleAlertMenuEdit },
    { icon: 'notifications-off-outline', label: t('favorites.alertMenu.disable'), onPress: handleAlertMenuDisable, destructive: true },
  ], [t, handleAlertMenuView, handleAlertMenuEdit, handleAlertMenuDisable]);

  const handleSuggestPress = useCallback((sg: AlertEditTarget) => { hapticsLight(); setAlertTarget(sg); }, []);

  const renderAlertItem = useCallback(({ item: row }: { item: AlertRow }) => {
    const tier = priceTier(row.currentPrice, row.referencePrice);
    const dropAbs = priceAlertDropAbs(row.initialPrice, row.currentPrice);
    const state = priceAlertState(row.targetPrice, row.currentPrice);
    const progress = alertProgress(row.initialPrice, row.targetPrice, row.currentPrice);
    const lowest = lowestMap.get(row.parfumId) ?? null;
    const chipParts: string[] = [];
    if (row.variation != null) chipParts.push(formatVariation(row.variation));
    if (dropAbs != null && dropAbs !== 0) chipParts.push(dropAbs < 0 ? `−${formatPrice(Math.abs(dropAbs), { decimals: 0 })}` : `+${formatPrice(dropAbs, { decimals: 0 })}`);
    const chipNeg = (row.variation != null && row.variation < 0) || (row.variation == null && dropAbs != null && dropAbs < 0);
    const infoParts: string[] = [];
    if (lowest != null) infoParts.push(t('favorites.alert.lowest', { price: formatPrice(lowest, { decimals: 0 }) }));
    const checked = formatRelativeShort(row.lastChecked);
    if (checked) infoParts.push(t('favorites.alert.checked', { when: checked }));
    const tierLabel = tier === 'deal' ? t('favorites.alert.a11yTierDeal') : tier === 'fair' ? t('favorites.alert.a11yTierFair') : tier === 'overpriced' ? t('favorites.alert.a11yTierOverpriced') : null;
    const stateLabel = state === 'reached' ? t('favorites.alert.a11yStateReached') : state === 'near' ? t('favorites.alert.a11yStateNear') : row.variation != null ? formatVariation(row.variation) : t('favorites.alert.a11yStateWatching');
    const a11y = [
      `${row.marque} ${row.nom}`,
      row.currentPrice != null ? formatPrice(row.currentPrice, { decimals: 0 }) : null,
      tierLabel,
      stateLabel,
      progress != null ? t('favorites.alert.progressA11y', { pct: Math.round(progress * 100) }) : null,
      chipParts.length > 0 ? chipParts.join(' · ') : null,
    ].filter(Boolean).join(', ');
    return (
      <Pressable style={s.alertCard} onPress={() => handleAlertCardPress(row)} onLongPress={() => handleAlertLongPress(row)} accessibilityRole="button" accessibilityLabel={a11y}>
        {row.imageUrl ? (
          <Image source={{ uri: row.imageUrl }} style={s.alertImg} contentFit="contain" transition={200} cachePolicy="memory-disk" recyclingKey={row.parfumId} />
        ) : (
          <View style={[s.alertImg, s.alertImgPlaceholder]}>
            <Ionicons name="flask-outline" size={18} color={theme.colors.textMuted} />
          </View>
        )}
        <View style={s.alertBody}>
          <Text style={s.alertBrand} numberOfLines={1}>{row.marque}</Text>
          <Text style={s.alertName} numberOfLines={2}>{row.nom}</Text>
          {progress != null ? (
            <View style={s.gaugeTrack} accessible={false}>
              {progress > 0 ? <View style={[s.gaugeFill, { width: `${Math.max(4, progress * 100)}%` }]} /> : null}
            </View>
          ) : null}
          {state === 'reached' ? (
            <View style={[s.alertStateChip, { backgroundColor: theme.colors.dealSoft }]}>
              <Ionicons name="checkmark-circle-outline" size={12} color={theme.colors.dealInk} accessible={false} />
              <Text style={[s.alertStateText, { color: theme.colors.dealInk }]} allowFontScaling={false}>{t('favorites.alert.reached')}</Text>
            </View>
          ) : state === 'near' ? (
            <View style={[s.alertStateChip, { backgroundColor: theme.colors.fairSoft }]}>
              <Ionicons name="trending-down-outline" size={12} color={theme.colors.fairInk} accessible={false} />
              <Text style={[s.alertStateText, { color: theme.colors.fairInk }]} allowFontScaling={false}>{t('favorites.alert.near')}</Text>
            </View>
          ) : row.targetPrice != null ? (
            <Text style={s.alertCaption}>{t('favorites.alert.target', { price: formatPrice(row.targetPrice, { decimals: 0 }) })}</Text>
          ) : (
            <Text style={s.alertCaption}>{t('favorites.alert.watching')}</Text>
          )}
          {infoParts.length > 0 ? <Text style={s.alertCaption}>{infoParts.join(' · ')}</Text> : null}
        </View>
        <View style={s.alertTrailing} accessible={false}>
          <View style={s.alertPriceRow}>
            {tier ? <View style={[s.alertPriceDot, { backgroundColor: theme.colors[tier] }]} /> : null}
            {row.currentPrice != null ? <Text style={s.alertPriceMain} allowFontScaling={false}>{formatPrice(row.currentPrice, { decimals: 0 })}</Text> : null}
          </View>
          {row.referencePrice != null && row.referencePrice !== row.currentPrice ? <Text style={s.alertRef} allowFontScaling={false}>{formatPrice(row.referencePrice, { decimals: 0 })}</Text> : null}
          {chipParts.length > 0 ? (
            <View style={[s.alertVarChip, { backgroundColor: chipNeg ? theme.colors.dealSoft : theme.colors.surface2 }]}>
              <Text style={[s.alertVarText, { color: chipNeg ? theme.colors.dealInk : theme.colors.textMuted }]} allowFontScaling={false}>{chipParts.join(' · ')}</Text>
            </View>
          ) : null}
        </View>
      </Pressable>
    );
  }, [s, theme, handleAlertCardPress, handleAlertLongPress, t, lowestMap]);

  const handlePillTap = useCallback((pill: FavPillId) => { hapticsLight(); setActivePill(pill); }, []);
  const handleSelectView = useCallback((v: FavorisView) => { hapticsLight(); setSearchQuery(''); setReachedOnly(false); setViewPref(v); resetDock(); }, [setViewPref, resetDock]);
  const handleToggleReached = useCallback(() => { hapticsLight(); setReachedOnly(v => !v); }, []);
  const handleEmptyExplore = useCallback(() => router.push('/(tabs)'), [router]);

  const gridNumCols = density === 'list' ? 1 : 2;
  const gridKey = `${gridNumCols}col`;

  const renderItem = useCallback(({ item }: { item: UserFavori }) => {
    const status = statusByParfumId.get(item.parfumId) ?? null;
    const alert = byParfumId.get(item.parfumId) ?? null;
    const currentPrice = alert ? (alert.lastPrice ?? item.bestPrice ?? null) : null;
    const variation = alert ? alertVariation(alert.initialPrice, currentPrice) : null;
    const alertState = alert ? priceAlertState(alert.targetPrice, currentPrice) : null;
    return (
      <View style={gridNumCols === 2 ? s.gridItemWrap : s.listItemWrap}>
        <ParfumCard
          parfum={favoriToCard(item)}
          mode={density}
          status={status}
          priceAlert={alert ? { variation, state: alertState } : null}
          onPressOverride={() => handleCardPress(item)}
          onLongPress={() => handleLongPress(item)}
        />
      </View>
    );
  }, [density, gridNumCols, statusByParfumId, byParfumId, handleCardPress, handleLongPress, s]);

  const renderSearchRow = useCallback((placeholder: string) => (
    <View style={s.searchRow}>
      <View style={s.searchWrap}>
        <Ionicons name="search-outline" size={16} color={theme.colors.textMuted} />
        <TextInput
          style={s.searchInput}
          placeholder={placeholder}
          placeholderTextColor={theme.colors.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
          keyboardAppearance={keyboardAppearance}
        />
      </View>
    </View>
  ), [s, theme, searchQuery, keyboardAppearance]);

  if (!authReady) {
    return <View style={s.center}><ActivityIndicator size="large" color={theme.colors.primary} /></View>;
  }

  if (!isAuthenticated) {
    return (
      <SafeAreaView edges={['bottom']} style={s.container}>
        <AuthGate icon="heart-outline" description={t('favorites.authGate')} />
      </SafeAreaView>
    );
  }

  if (upLoading) {
    return (
      <SafeAreaView edges={['bottom']} style={s.container}>
        <View style={s.header}><Text style={s.title}>{t('favorites.title')}</Text></View>
        <ActivityIndicator style={s.loadingSpinner} color={theme.colors.primary} />
      </SafeAreaView>
    );
  }

  const topChrome = (
    <View>
      <View style={s.header}>
        <Text style={s.title}>
          {effectiveView === 'favoris'
            ? t('favorites.titleWithCount', { count: favoris.length })
            : t('favorites.alertsWithCount', { count: alertRows.length })}
        </Text>
      </View>
      <View style={s.segmented}>
        {FAV_VIEW_TABS.map(tab => {
          const active = effectiveView === tab.key;
          return (
            <Pressable
              key={tab.key}
              style={[s.segment, active && s.segmentActive]}
              onPress={() => handleSelectView(tab.key)}
              accessibilityRole="button"
              accessibilityLabel={tab.label}
              accessibilityState={{ selected: active }}
            >
              <Ionicons name={tab.icon as never} size={15} color={active ? theme.colors.primary : theme.colors.textMuted} />
              <Text style={[s.segmentText, active && s.segmentTextActive]} allowFontScaling={false}>{tab.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );

  const reachedLabel = t('favorites.objectifsReached', { count: reachedCount });

  const sheetStatus = sheetItem ? statusByParfumId.get(sheetItem.parfumId) ?? null : null;
  const sheetHasAlert = sheetItem ? byParfumId.has(sheetItem.parfumId) : false;
  const alertExisting = alertTarget ? byParfumId.get(alertTarget.parfumId) ?? null : null;

  return (
    <SafeAreaView edges={['bottom']} style={s.container}>
      {effectiveView === 'favoris' ? (
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
              {topChrome}
              {favoris.length === 0 ? (
                <EmptyState variant="favoris" onAction={handleEmptyExplore} />
              ) : (
                <View>
                  {renderSearchRow(t('favorites.searchPlaceholder'))}

                  <View style={s.toolsRow}>
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
                        {searchQuery.trim() || activePill !== 'all' ? t('favorites.emptyFiltered') : t('favorites.emptyNone')}
                      </Text>
                    </View>
                  ) : null}
                </View>
              )}
            </View>
          }
        />
      ) : (
        <Animated.FlatList
          data={alertRowsFiltered}
          keyExtractor={(row) => row.parfumId}
          contentContainerStyle={s.content}
          showsVerticalScrollIndicator={false}
          onScroll={scrollHandler}
          scrollEventThrottle={16}
          windowSize={5}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          extraData={resolvedMode}
          ListHeaderComponent={
            <View>
              {topChrome}
              {alertRows.length > 0 ? (
                <View style={s.watchCard} accessible accessibilityLabel={t('favorites.watch.a11y', { count: alertRows.length, active: alertRows.length, reached: reachedCount, savings: formatPrice(watchSavingsTotal, { decimals: 0 }) })}>
                  <View style={s.watchCol}>
                    <Text style={s.watchNum} allowFontScaling={false}>{alertRows.length}</Text>
                    <Text style={s.watchLabel} allowFontScaling={false}>{t('favorites.watch.active')}</Text>
                  </View>
                  <View style={s.watchSep} accessible={false} />
                  <View style={s.watchCol}>
                    <Text style={[s.watchNum, { color: theme.colors.deal }]} allowFontScaling={false}>{reachedCount}</Text>
                    <Text style={s.watchLabel} allowFontScaling={false}>{t('favorites.watch.reached')}</Text>
                  </View>
                  <View style={s.watchSep} accessible={false} />
                  <View style={s.watchCol}>
                    <Text style={[s.watchNum, watchSavingsTotal > 0 ? { color: theme.colors.deal } : null]} allowFontScaling={false}>{formatPrice(watchSavingsTotal, { decimals: 0 })}</Text>
                    <Text style={s.watchLabel} allowFontScaling={false}>{t('favorites.watch.savings')}</Text>
                  </View>
                </View>
              ) : null}
              {reachedCount > 0 ? (
                <Pressable
                  style={[s.reachedRow, reachedOnly && s.reachedRowActive]}
                  onPress={handleToggleReached}
                  accessibilityRole="button"
                  accessibilityState={{ selected: reachedOnly }}
                  accessibilityLabel={reachedLabel}
                >
                  <View style={s.reachedRowLeft}>
                    <Ionicons name="checkmark-circle-outline" size={16} color={reachedOnly ? theme.colors.dealInk : theme.colors.deal} accessible={false} />
                    <Text style={[s.reachedRowText, reachedOnly && s.reachedRowTextActive]} allowFontScaling={false}>{reachedLabel}</Text>
                  </View>
                  <Ionicons name={reachedOnly ? 'close-outline' : 'chevron-forward'} size={16} color={theme.colors.textMuted} accessible={false} />
                </Pressable>
              ) : null}
              {alertRows.length > 0 ? renderSearchRow(t('favorites.searchPlaceholderAlerts')) : null}
            </View>
          }
          ListEmptyComponent={
            alertRows.length === 0 ? (
              <EmptyState
                variant="alertes"
                onAction={favoris.length ? () => setViewPref('favoris') : handleEmptyExplore}
                actionLabel={favoris.length ? undefined : t('favorites.exploreCatalog')}
              />
            ) : (
              <View style={s.emptyFilter}>
                <Ionicons name="search-outline" size={28} color={theme.colors.textMuted} />
                <Text style={s.emptyFilterText}>{t('favorites.emptyAlertsFiltered')}</Text>
              </View>
            )
          }
          ListFooterComponent={
            alertRows.length > 0 && suggestions.length > 0 && !reachedOnly && !searchQuery.trim() ? (
              <View>
                <Text style={s.suggestLabel}>{t('favorites.suggestions.title')}</Text>
                {suggestions.map(sg => (
                  <View key={sg.parfumId} style={s.suggestRow}>
                    {sg.imageUrl ? (
                      <Image source={{ uri: sg.imageUrl }} style={s.suggestImg} contentFit="contain" cachePolicy="memory-disk" recyclingKey={sg.parfumId} />
                    ) : (
                      <View style={[s.suggestImg, s.alertImgPlaceholder]}>
                        <Ionicons name="flask-outline" size={14} color={theme.colors.textMuted} accessible={false} />
                      </View>
                    )}
                    <View style={s.suggestBody}>
                      <Text style={s.alertBrand} numberOfLines={1}>{sg.marque}</Text>
                      <Text style={s.suggestName} numberOfLines={1}>{sg.nom}</Text>
                    </View>
                    <Text style={s.alertPrice} allowFontScaling={false}>{formatPrice(sg.bestPrice ?? 0, { decimals: 0 })}</Text>
                    <Pressable style={s.suggestBtn} onPress={() => handleSuggestPress(sg)} accessibilityRole="button" accessibilityLabel={t('favorites.suggestions.ctaA11y', { nom: sg.nom })}>
                      <Ionicons name="notifications-outline" size={18} color={theme.colors.primaryInk} accessible={false} />
                    </Pressable>
                  </View>
                ))}
              </View>
            ) : null
          }
          renderItem={renderAlertItem}
        />
      )}

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

      <ActionSheet
        visible={alertMenu !== null}
        title={alertMenu ? `${alertMenu.marque} ${alertMenu.nom}` : undefined}
        actions={alertMenuActions}
        onClose={() => setAlertMenu(null)}
      />

      <PermissionPrimer
        visible={pushPrimer.visible}
        copy={PERMISSION_PRIMERS.push}
        onAccept={pushPrimer.accept}
        onDecline={pushPrimer.decline}
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

    segmented: { flexDirection: 'row', backgroundColor: t.colors.surface2, borderRadius: 20, padding: 3, marginHorizontal: 16, marginTop: 8, marginBottom: 8 },
    segment: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8, borderRadius: 18 },
    segmentActive: { backgroundColor: t.colors.surface, ...t.shadow.card },
    segmentText: { fontFamily: 'Inter_500Medium', fontSize: 13, color: t.colors.textMuted },
    segmentTextActive: { fontFamily: 'Inter_600SemiBold', color: t.colors.text },

    reachedRow: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      backgroundColor: t.colors.surface, borderRadius: t.radius.card, padding: 12,
      borderWidth: 1, borderColor: t.colors.border, marginBottom: 10, ...t.shadow.card,
    },
    reachedRowActive: { backgroundColor: t.colors.dealSoft, borderColor: t.colors.deal },
    reachedRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    reachedRowText: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: t.colors.deal },
    reachedRowTextActive: { color: t.colors.dealInk },

    alertCard: {
      flexDirection: 'row', alignItems: 'flex-start', gap: 12,
      backgroundColor: t.colors.surface, borderRadius: t.radius.card, padding: 12,
      borderWidth: 1, borderColor: t.colors.border, marginBottom: 10, ...t.shadow.card,
    },
    alertImg: { width: 52, height: 70, borderRadius: t.radius.sm, backgroundColor: t.colors.surface2 },
    alertImgPlaceholder: { justifyContent: 'center', alignItems: 'center' },
    alertBody: { flex: 1, minWidth: 0, gap: 4 },
    alertBrand: { fontFamily: 'Inter_400Regular', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, color: t.colors.textMuted },
    alertName: { fontFamily: 'PlayfairDisplay_600SemiBold', fontSize: 14, color: t.colors.text },
    alertPriceRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    alertPriceDot: { width: 7, height: 7, borderRadius: 4 },
    alertPrice: { fontFamily: 'Inter_700Bold', fontSize: 14, color: t.colors.text, fontVariant: ['tabular-nums'] as import('react-native').FontVariant[] },
    alertRef: { fontFamily: 'Inter_400Regular', fontSize: 11, color: t.colors.textMuted, textDecorationLine: 'line-through', fontVariant: ['tabular-nums'] as import('react-native').FontVariant[] },
    alertTrailing: { alignItems: 'flex-end', flexShrink: 0, gap: 4 },
    alertPriceMain: { fontFamily: 'Inter_700Bold', fontSize: 16, color: t.colors.text, fontVariant: ['tabular-nums'] as import('react-native').FontVariant[] },
    alertVarChip: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10 },
    alertVarText: { fontFamily: 'Inter_700Bold', fontSize: 10, fontVariant: ['tabular-nums'] as import('react-native').FontVariant[] },
    alertStateChip: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
    alertStateText: { fontFamily: 'Inter_600SemiBold', fontSize: 10 },
    alertCaption: { fontFamily: 'Inter_400Regular', fontSize: 11, color: t.colors.textMuted },

    watchCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: t.colors.surface, borderRadius: t.radius.card, paddingVertical: 12, paddingHorizontal: 8, borderWidth: 1, borderColor: t.colors.border, marginBottom: 10, ...t.shadow.card },
    watchCol: { flex: 1, alignItems: 'center', gap: 2 },
    watchSep: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch', backgroundColor: t.colors.border },
    watchNum: { fontFamily: 'Inter_700Bold', fontSize: 20, color: t.colors.text, fontVariant: ['tabular-nums'] as import('react-native').FontVariant[] },
    watchLabel: { fontFamily: 'Inter_400Regular', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, color: t.colors.textMuted },
    gaugeTrack: { height: 4, borderRadius: 2, backgroundColor: t.colors.surface2, overflow: 'hidden' },
    gaugeFill: { height: 4, borderRadius: 2, backgroundColor: t.colors.deal },
    suggestLabel: { fontFamily: 'Inter_500Medium', fontSize: 12, color: t.colors.textMuted, marginTop: 16, marginBottom: 8 },
    suggestRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: t.colors.surface, borderRadius: t.radius.card, padding: 10, borderWidth: 1, borderColor: t.colors.border, marginBottom: 8, ...t.shadow.card },
    suggestImg: { width: 36, height: 48, borderRadius: t.radius.sm, backgroundColor: t.colors.surface2 },
    suggestBody: { flex: 1, minWidth: 0, gap: 2 },
    suggestName: { fontFamily: 'PlayfairDisplay_600SemiBold', fontSize: 13, color: t.colors.text },
    suggestBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: t.colors.primarySoft, alignItems: 'center', justifyContent: 'center' },

    searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, marginTop: 8, marginBottom: 8 },
    searchWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: t.colors.surface2, borderRadius: 20, paddingHorizontal: 12, height: 40, gap: 8 },
    searchInput: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 14, color: t.colors.text },
    densityIconBtn: { width: 40, height: 40, borderRadius: 8, backgroundColor: t.colors.surface2, alignItems: 'center', justifyContent: 'center' },
    densityIconBtnActive: { backgroundColor: t.colors.surface, ...t.shadow.card },
    toolsRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingBottom: 8 },

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
