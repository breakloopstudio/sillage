import { useRef, useState, useMemo, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, TextInput, Platform, Share, Alert, Linking, type LayoutChangeEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { useAnimatedScrollHandler, useReducedMotion, LinearTransition } from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import i18next from 'i18next';
import Ionicons from '@react-native-vector-icons/ionicons/static';
import { useAuthContext } from '../../src/contexts/AuthContext';
import { useFavorisContext } from '../../src/contexts/FavorisContext';
import { useUserParfumContext } from '../../src/contexts/UserParfumContext';
import { usePriceAlertsContext } from '../../src/contexts/PriceAlertsContext';
import { useMyProfile } from '../../src/hooks/useMyProfile';
import { useShelvesContext } from '../../src/contexts/ShelvesContext';
import { useShelfItems } from '../../src/hooks/useShelfItems';
import { useSotd } from '../../src/hooks/useSotd';
import { useWeather } from '../../src/hooks/useWeather';
import { useNetwork } from '../../src/hooks/useNetwork';
import { useDensityPreference, GRID_MODES } from '../../src/hooks/useDensityPreference';
import { useParfumerieViewPreference, type ParfumerieView } from '../../src/hooks/useParfumerieViewPreference';
import { scoreWardrobeItemForWeather } from '../../src/utils/weather-scoring';
import { saveWeatherCoords, getUserSettings, updateUserSetting } from '../../src/services/user-data';
import { setPendingParfum } from '../../src/services/catalog-bridge';
import { usePermissionPrimer } from '../../src/hooks/usePermissionPrimer';
import { PERMISSION_PRIMERS } from '../../src/utils/permission-primers';
import PermissionPrimer from '../../src/components/PermissionPrimer';
import { addToShelf, removeFromShelf, pinShelfItem } from '../../src/services/user-parfum';
import { hapticsLight, hapticsError, hapticsSuccess } from '../../src/services/haptics';
import { useTheme, type Theme } from '../../src/theme/ThemeContext';
import { useNavigationChrome } from '../../src/features/navigation/NavigationChromeContext';
import { STATUS_CHIPS, chipForStatus, type StatusChipId } from '../../src/utils/status-chips';
import { alertVariation, priceAlertState } from '../../src/utils/price-alerts';
import { profileShareUrl, parfumShareUrl, shelfShareUrl, normalizePseudo } from '../../src/utils/share';
import {
  groupItemsByShelf,
  orphanItems,
  signatureItems,
  favoriteItems,
  hasShelfMatter,
  type ShelfGroup,
} from '../../src/utils/shelf-grouping';
import EmptyState from '../../src/components/EmptyState';
import InfoPopup from '../../src/components/InfoPopup';
import AuthGate from '../../src/components/AuthGate';
import FilterSheet from '../../src/components/FilterSheet';
import StatuerSheet from '../../src/components/StatuerSheet';
import ActionSheet, { type ActionItem } from '../../src/components/ActionSheet';
import AddToShelfSheet from '../../src/components/AddToShelfSheet';
import PublishShelfGateSheet from '../../src/components/PublishShelfGateSheet';
import ParfumCard from '../../src/components/ParfumCard';
import SOTDCard from '../../src/features/wardrobe/SOTDCard';
import SOTDPicker from '../../src/features/wardrobe/SOTDPicker';
import ShelfManager from '../../src/features/wardrobe/ShelfManager';
import ShelfCard, { type ShelfCardItem } from '../../src/features/wardrobe/ShelfCard';
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
import type { UserParfum, UserParfumStatus, Parfum } from '../../src/models';
import type { Shelf } from '../../src/models/user-parfum.interface';

type ParfPillId = 'all' | StatusChipId;

// Labels résolus à l'affichage via getters i18next (§23) — jamais lus au scope module.
const SORT_OPTIONS = [
  { key: 'recent', get label() { return i18next.t('collection.sortOptions.recent'); } },
  { key: 'rating', get label() { return i18next.t('collection.sortOptions.rating'); } },
  { key: 'az', get label() { return i18next.t('collection.sortOptions.az'); } },
  { key: 'za', get label() { return i18next.t('collection.sortOptions.za'); } },
];

const DENSITY_ICON: Record<string, string> = {
  comfortable: 'grid-outline',
  compactPlus: 'apps-outline',
  list: 'list-outline',
};

const VIEW_TABS: { key: ParfumerieView; label: string; icon: string }[] = [
  { key: 'shelves', get label() { return i18next.t('collection.viewTabs.shelves'); }, icon: 'albums-outline' },
  { key: 'collection', get label() { return i18next.t('collection.viewTabs.collection'); }, icon: 'grid-outline' },
];

const KEY_EXPAND = '@sillage/parfumerie-shelves-expand';

const SIG_ID = '__sig__';
const FAV_ID = '__fav__';
const ORPHAN_ID = '__orphan__';

function userParfumToCard(up: UserParfum): Parfum {
  return {
    id: up.parfumId,
    nom: up.nom ?? '',
    marque: up.marque ?? '',
    imageUrl: up.imageUrl ?? undefined,
    familleOlactive: up.familleOlactive ?? '',
    bestPrice: up.bestPrice,
    referencePrice: up.referencePrice,
  } as Parfum;
}

export default function MaParfumeriePage() {
  const { theme, resolvedMode } = useTheme();
  const s = useMemo(() => getStyles(theme), [theme]);
  const { t } = useTranslation('common');
  const { user, authReady, isAuthenticated } = useAuthContext();
  const router = useRouter();
  const uid = user?.uid ?? null;
  const keyboardAppearance = resolvedMode === 'dark' ? 'dark' : 'light';

  const { favIds } = useFavorisContext();
  const { items, loading, update, remove } = useUserParfumContext();
  const { byParfumId } = usePriceAlertsContext();
  const { profile } = useMyProfile(uid);
  const { shelves, create: createShelf, update: updateShelf, remove: removeShelf, reorder } = useShelvesContext();
  const { byShelf } = useShelfItems(uid);
  const { sotd, streak, setTodaySotd } = useSotd(uid);
  const { isOnline } = useNetwork();
  // Consentement météo (réglage « Suggestions météo ») : gate la météo in-app
  // ET la persistance des coordonnées — jamais de GPS sans opt-in explicite.
  const [weatherConsent, setWeatherConsent] = useState(false);
  const { weather, loading: weatherLoading, coords, requestPermission: requestWeatherPermission, permissionStatus, permissionCanAskAgain } = useWeather(isAuthenticated && isOnline && weatherConsent);
  const locationPrimer = usePermissionPrimer('location');
  const { scrollY, resetDock } = useNavigationChrome();
  const { density, setDensity } = useDensityPreference();
  const { view: viewPref, setView: setViewPref } = useParfumerieViewPreference();

  const scrollHandler = useAnimatedScrollHandler((e) => { scrollY.value = e.contentOffset.y; });
  const reduced = useReducedMotion();

  const [activePill, setActivePill] = useState<ParfPillId>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSort, setActiveSort] = useState('recent');
  const [favOnly, setFavOnly] = useState(false);
  const [attrFilters, setAttrFilters] = useState<FavoritesFilters>(EMPTY_FAVORI_FILTERS);
  const [showAttrSheet, setShowAttrSheet] = useState(false);
  const [shelfManagerVisible, setShelfManagerVisible] = useState(false);
  const [editShelfId, setEditShelfId] = useState<string | null>(null);
  const [sotdPickerVisible, setSotdPickerVisible] = useState(false);
  const [sotdCardAnchor, setSotdCardAnchor] = useState(0);
  const [statuerItem, setStatuerItem] = useState<UserParfum | null>(null);
  const [shelfMenu, setShelfMenu] = useState<Shelf | null>(null);
  const [addToShelfId, setAddToShelfId] = useState<string | null>(null);
  const [publishGateShelfId, setPublishGateShelfId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string> | null>(null);
  const [orphanHelpOpen, setOrphanHelpOpen] = useState(false);
  const statuerItemRef = useRef<UserParfum | null>(null);

  useEffect(() => { statuerItemRef.current = statuerItem; }, [statuerItem]);

  // Relu au focus (les onglets TopTabs restent montés) : un retrait du
  // consentement dans Settings/privacy-center doit être appliqué dès le retour,
  // sans attendre un remontage (fixe la ré-écriture des coords après retrait).
  useFocusEffect(
    useCallback(() => {
      if (!uid) return;
      getUserSettings(uid).then(st => setWeatherConsent(st.weatherNotifs)).catch(() => {});
    }, [uid]),
  );

  useEffect(() => {
    AsyncStorage.getItem(KEY_EXPAND).then((v) => {
      try {
        const arr = v ? JSON.parse(v) : [];
        setExpanded(new Set(Array.isArray(arr) ? (arr as string[]) : []));
      } catch {
        setExpanded(new Set());
      }
    }).catch(() => setExpanded(new Set()));
  }, []);

  useEffect(() => {
    if (!expanded) return;
    AsyncStorage.setItem(KEY_EXPAND, JSON.stringify([...expanded])).catch((e) => console.warn('[parfumerie-expand] persist failed:', e));
  }, [expanded]);

  const sotdEligible = useMemo(() => items.filter(i => i.status === 'have'), [items]);
  const sotdScore = useMemo(() => {
    if (!weather || !sotd) return null;
    const sotdItem = items.find(i => i.parfumId === sotd.parfumId);
    return sotdItem ? scoreWardrobeItemForWeather(sotdItem, weather) : null;
  }, [items, weather, sotd]);

  const lastWeatherCoords = useRef<string | null>(null);
  useEffect(() => {
    if (!isAuthenticated || !weatherConsent || !coords || !uid) return;
    const key = `${coords.lat.toFixed(4)},${coords.lon.toFixed(4)}`;
    if (lastWeatherCoords.current === key) return;
    lastWeatherCoords.current = key;
    saveWeatherCoords(uid, coords.lat, coords.lon).catch(() => {});
  }, [isAuthenticated, weatherConsent, coords, uid]);

  const pillCounts = useMemo(() => {
    const counts: Record<ParfPillId, number> = { all: items.length, to_try: 0, have: 0, had: 0 };
    for (const up of items) counts[chipForStatus(up.status) ?? 'to_try'] += 1;
    return counts;
  }, [items]);

  const pillFiltered = useMemo(() => {
    if (activePill === 'all') return items;
    return items.filter(up => (chipForStatus(up.status) ?? 'to_try') === activePill);
  }, [items, activePill]);

  const filtered = useMemo(() => {
    let result = pillFiltered;
    if (favOnly) result = result.filter(m => favIds.has(m.parfumId));
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
  }, [pillFiltered, favOnly, favIds, attrFilters, searchQuery, activeSort]);

  const activeAttrCount = useMemo(() => countActiveFilters(attrFilters), [attrFilters]);
  const activeChips = useMemo(() => buildActiveChips(attrFilters), [attrFilters]);

  const sigItems = useMemo(() => signatureItems(items), [items]);
  const favItems = useMemo(() => favoriteItems(items, favIds), [items, favIds]);
  const shelfGroups = useMemo(() => groupItemsByShelf(items, shelves), [items, shelves]);
  const orphans = useMemo(() => orphanItems(items), [items]);
  const matter = useMemo(() => hasShelfMatter(shelves, items, favIds), [shelves, items, favIds]);
  const effectiveView: ParfumerieView = viewPref ?? (matter ? 'shelves' : 'collection');

  const addToShelfCandidates = useMemo(
    () => (addToShelfId ? items.filter(i => !i.shelfIds.includes(addToShelfId)) : []),
    [items, addToShelfId],
  );
  const addToShelfName = useMemo(
    () => shelves.find(sh => sh.id === addToShelfId)?.name ?? '',
    [shelves, addToShelfId],
  );
  const publishGateShelfName = useMemo(
    () => shelves.find(sh => sh.id === publishGateShelfId)?.name ?? '',
    [shelves, publishGateShelfId],
  );
  const gateDefaultPseudo = useMemo(() => normalizePseudo(user?.displayName ?? ''), [user]);

  const handleCardPress = useCallback((up: UserParfum) => {
    setPendingParfum(userParfumToCard(up));
    router.push(`/catalog/${up.parfumId}`);
  }, [router]);

  const handleShelfBottle = useCallback((it: ShelfCardItem) => {
    const up = items.find((i) => i.parfumId === it.parfumId);
    if (up) handleCardPress(up);
  }, [items, handleCardPress]);

  const handleShelfBottleLong = useCallback((it: ShelfCardItem) => {
    const up = items.find((i) => i.parfumId === it.parfumId);
    if (up) setStatuerItem(up);
  }, [items]);

  const orderForShelf = useCallback((shelfId: string, group: UserParfum[]): UserParfum[] => {
    const view = byShelf.get(shelfId);
    if (!view) return group;
    const byId = new Map(group.map((i) => [i.parfumId, i]));
    const ordered: UserParfum[] = [];
    for (const pid of view.orderedParfumIds) {
      const it = byId.get(pid);
      if (it) { ordered.push(it); byId.delete(pid); }
    }
    for (const it of byId.values()) ordered.push(it);
    return ordered;
  }, [byShelf]);

  const pinnedShelfIdsForItem = useMemo(() => {
    if (!statuerItem) return [];
    return statuerItem.shelfIds.filter((sid) => byShelf.get(sid)?.pinned.has(statuerItem.parfumId) ?? false);
  }, [statuerItem, byShelf]);

  const shelvesExtraData = useMemo(() => [expanded, byShelf], [expanded, byShelf]);

  const handleTogglePin = useCallback((shelfId: string) => {
    const cur = statuerItemRef.current;
    if (!cur || !uid) return;
    const wasPinned = byShelf.get(shelfId)?.pinned.has(cur.parfumId) ?? false;
    pinShelfItem(uid, shelfId, cur.parfumId, !wasPinned).catch(() => { hapticsError(); });
  }, [uid, byShelf]);

  const handleLongPress = useCallback((up: UserParfum) => setStatuerItem(up), []);

  const handleStatuerView = useCallback(() => {
    if (statuerItem) handleCardPress(statuerItem);
    setStatuerItem(null);
  }, [statuerItem, handleCardPress]);

  const handleStatuerStatus = useCallback((status: UserParfumStatus) => {
    if (!statuerItem) { setStatuerItem(null); return; }
    update(statuerItem.parfumId, { status }).catch(() => { hapticsError(); });
    setStatuerItem(null);
  }, [statuerItem, update]);

  const handleStatuerToggleShelf = useCallback((shelfId: string) => {
    const cur = statuerItemRef.current;
    if (!cur || !uid) return;
    const wasOn = cur.shelfIds.includes(shelfId);
    const next = wasOn ? cur.shelfIds.filter(x => x !== shelfId) : [...cur.shelfIds, shelfId];
    const merged = { ...cur, shelfIds: next };
    statuerItemRef.current = merged;
    setStatuerItem(merged);
    const action = wasOn ? removeFromShelf : addToShelf;
    action(uid, cur.parfumId, shelfId).catch(() => {
      statuerItemRef.current = cur;
      setStatuerItem(cur);
      hapticsError();
    });
  }, [uid]);

  const handleStatuerRemove = useCallback(() => {
    if (statuerItem) remove(statuerItem.parfumId).catch(() => { hapticsError(); });
    setStatuerItem(null);
  }, [statuerItem, remove]);

  const handleSotdCardLayout = useCallback((e: LayoutChangeEvent) => {
    setSotdCardAnchor(e.nativeEvent.layout.y + e.nativeEvent.layout.height);
  }, []);
  const handleSotdPress = useCallback(() => { if (sotd) router.push(`/catalog/${sotd.parfumId}`); }, [sotd, router]);
  const handleSotdChangePress = useCallback(() => setSotdPickerVisible(true), []);
  const handleSotdSelect = useCallback((parfumId: string) => {
    if (parfumId === sotd?.parfumId) { setSotdPickerVisible(false); return; }
    const item = sotdEligible.find(i => i.parfumId === parfumId);
    if (item) { hapticsSuccess(); setTodaySotd(item).catch(() => {}); }
    setSotdPickerVisible(false);
  }, [sotd, sotdEligible, setTodaySotd]);

  // Le geste « activer la météo » pose le consentement app (réglage
  // weatherNotifs) puis demande la permission OS — sinon requestPermission
  // serait bloqué par le gate enabled=false (défaut) et le tap serait mort.
  const enableWeatherAndRequest = useCallback(() => {
    setWeatherConsent(true);
    if (uid) updateUserSetting(uid, 'weatherNotifs', true).catch(() => {});
    void requestWeatherPermission();
  }, [uid, requestWeatherPermission]);

  // Tap sur le segment météo de la SOTD card : si la permission n'est pas
  // encore accordée, passer par le primer (jamais de prompt à froid).
  const handleWeatherEnablePress = useCallback(() => {
    if (weather) return;
    // Refus définitif (l'OS ne re-prompt plus) → porte de sortie réglages.
    // Un refus simple (canAskAgain) repasse par requestPermission qui re-prompt.
    if (permissionStatus === 'denied' && !permissionCanAskAgain) {
      Alert.alert(t('collection.locationDenied.title'), t('collection.locationDenied.message'), [
        { text: t('cancel'), style: 'cancel' },
        { text: t('openSettings'), onPress: () => Linking.openSettings() },
      ]);
      return;
    }
    if (locationPrimer.needsPrimer) {
      locationPrimer.open();
      return;
    }
    enableWeatherAndRequest();
  }, [weather, permissionStatus, permissionCanAskAgain, locationPrimer, enableWeatherAndRequest, t]);

  const handleLocationPrimerAccept = useCallback(() => {
    locationPrimer.accept();
    enableWeatherAndRequest();
  }, [locationPrimer, enableWeatherAndRequest]);

  const handleLocationPrimerDecline = useCallback(() => {
    locationPrimer.decline();
  }, [locationPrimer]);

  const handleOpenShelfManager = useCallback(() => { setEditShelfId(null); setShelfManagerVisible(true); }, []);
  const handleCloseShelfManager = useCallback(() => setShelfManagerVisible(false), []);
  const handleCreateShelf = useCallback((name: string, icon?: string, color?: string, description?: string) => {
    createShelf(name, icon, color, description);
  }, [createShelf]);
  const handleUpdateShelf = useCallback((id: string, data: { name: string; icon: string | null; color: string | null; description: string | null }) => {
    updateShelf(id, data);
  }, [updateShelf]);

  const handleOpenShelfMenu = useCallback((sh: Shelf) => setShelfMenu(sh), []);
  const handleCloseShelfMenu = useCallback(() => setShelfMenu(null), []);
  const handleEditShelf = useCallback(() => {
    if (!shelfMenu) return;
    const id = shelfMenu.id;
    setShelfMenu(null);
    setEditShelfId(id);
    setShelfManagerVisible(true);
  }, [shelfMenu]);
  const handleDeleteShelf = useCallback(() => {
    if (!shelfMenu) return;
    const id = shelfMenu.id;
    const nm = shelfMenu.name;
    setShelfMenu(null);
    Alert.alert(
      t('collection.deleteShelf.title'),
      t('collection.deleteShelf.message', { name: nm }),
      [
        { text: t('cancel'), style: 'cancel' },
        { text: t('collection.deleteShelf.confirm'), style: 'destructive', onPress: () => removeShelf(id).catch(() => hapticsError()) },
      ]
    );
  }, [shelfMenu, removeShelf, t]);

  const handleShareShelf = useCallback(() => {
    if (!shelfMenu || !profile?.pseudo) return;
    const url = shelfShareUrl(profile.pseudo, shelfMenu.id);
    const text = t('collection.shareShelfText', { name: shelfMenu.name });
    setShelfMenu(null);
    if (Platform.OS === 'ios') Share.share({ url, message: text }).catch(() => {});
    else Share.share({ message: `${text} ${url}` }).catch(() => {});
  }, [shelfMenu, profile, t]);

  const handleTogglePublicFromMenu = useCallback(() => {
    if (!shelfMenu) return;
    const id = shelfMenu.id;
    const makePublic = !shelfMenu.isPublic;
    setShelfMenu(null);
    if (makePublic) {
      if (profile?.isPublic) {
        updateShelf(id, { isPublic: true }).catch(() => hapticsError());
      } else {
        setPublishGateShelfId(id);
      }
    } else {
      updateShelf(id, { isPublic: false }).catch(() => hapticsError());
    }
  }, [shelfMenu, profile, updateShelf]);

  const handlePublishFromGate = useCallback(() => {
    if (!publishGateShelfId) return;
    const id = publishGateShelfId;
    setPublishGateShelfId(null);
    updateShelf(id, { isPublic: true }).catch(() => hapticsError());
  }, [publishGateShelfId, updateShelf]);

  const shelfMenuActions = useMemo<ActionItem[]>(() => {
    if (!shelfMenu) return [];
    const acts: ActionItem[] = [
      { icon: 'create-outline', label: t('collection.menu.edit'), onPress: handleEditShelf },
    ];
    if (shelfMenu.isPublic) {
      acts.push({ icon: 'share-social-outline', label: t('collection.menu.share'), onPress: handleShareShelf });
      acts.push({ icon: 'lock-closed-outline', label: t('collection.menu.makePrivate'), onPress: handleTogglePublicFromMenu });
    } else {
      acts.push({ icon: 'globe-outline', label: t('collection.menu.makePublic'), onPress: handleTogglePublicFromMenu });
    }
    acts.push({ icon: 'trash-outline', label: t('collection.menu.delete'), destructive: true, onPress: handleDeleteShelf });
    return acts;
  }, [shelfMenu, handleEditShelf, handleShareShelf, handleTogglePublicFromMenu, handleDeleteShelf, t]);

  const handleOpenAddToShelf = useCallback((id: string) => setAddToShelfId(id), []);
  const handleCloseAddToShelf = useCallback(() => setAddToShelfId(null), []);
  const handleAddToShelf = useCallback(async (parfumId: string): Promise<boolean> => {
    if (!addToShelfId || !uid) return false;
    const it = items.find(i => i.parfumId === parfumId);
    if (!it) return false;
    try {
      await addToShelf(uid, parfumId, addToShelfId);
      return true;
    } catch {
      hapticsError();
      return false;
    }
  }, [items, addToShelfId, uid]);

  const handleToggleExpand = useCallback((id: string) => {
    hapticsLight();
    setExpanded((prev) => {
      const base = prev ?? new Set<string>();
      const next = new Set(base);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const handleOrphanHelp = useCallback(() => {
    hapticsLight();
    setOrphanHelpOpen(true);
  }, []);

  const handleMoveShelf = useCallback((shelfId: string, dir: -1 | 1) => {
    const from = shelfGroups.findIndex((g) => g.shelf.id === shelfId);
    if (from < 0) return;
    const to = from + dir;
    if (to < 0 || to >= shelfGroups.length) return;
    const ids = shelfGroups.map((g) => g.shelf.id);
    [ids[from], ids[to]] = [ids[to], ids[from]];
    hapticsLight();
    reorder(ids.map((id, order) => ({ id, order }))).catch(() => { hapticsError(); });
  }, [shelfGroups, reorder]);

  const handleToggleFavOnly = useCallback(() => { hapticsLight(); setFavOnly(v => !v); }, []);
  const handleSelectView = useCallback((v: ParfumerieView) => { hapticsLight(); setViewPref(v); resetDock(); }, [setViewPref, resetDock]);
  const canShareCollection = !!profile?.isPublic && !!profile?.pseudo;
  const handleShareCollection = useCallback(() => {
    if (!profile?.pseudo) return;
    hapticsLight();
    const url = profileShareUrl(profile.pseudo);
    const text = t('collection.shareText');
    if (Platform.OS === 'ios') Share.share({ url, message: text }).catch(() => {});
    else Share.share({ message: `${text} ${url}` }).catch(() => {});
  }, [profile, t]);
  const handleShareSotd = useCallback(() => {
    if (!sotd) return;
    hapticsLight();
    const url = parfumShareUrl(sotd.parfumId);
    const text = t('shareSotd', { marque: sotd.marque, nom: sotd.nom });
    if (Platform.OS === 'ios') Share.share({ url, message: text }).catch(() => {});
    else Share.share({ message: `${text}\n${url}` }).catch(() => {});
  }, [sotd, t]);
  const handleOpenAttrSheet = useCallback(() => setShowAttrSheet(true), []);
  const handleCloseAttrSheet = useCallback(() => setShowAttrSheet(false), []);
  const handleAttrFiltersChange = useCallback((next: FavoritesFilters) => setAttrFilters(next), []);
  const handleAttrReset = useCallback(() => setAttrFilters(EMPTY_FAVORI_FILTERS), []);

  const parfPills = useMemo(() => [
    { id: 'all' as ParfPillId, label: t('collection.pills.all'), icon: 'apps-outline' },
    ...STATUS_CHIPS.map(c => ({ id: c.id as ParfPillId, label: c.label, icon: c.icon })),
  ], [t]);

  const cycleSort = useCallback(() => {
    const idx = SORT_OPTIONS.findIndex(o => o.key === activeSort);
    setActiveSort(SORT_OPTIONS[(idx + 1) % SORT_OPTIONS.length].key);
  }, [activeSort]);
  const sortFound = SORT_OPTIONS.find(o => o.key === activeSort);
  const currentSortLabel = sortFound ? sortFound.label : t('sort');

  const handlePillTap = useCallback((pill: ParfPillId) => { hapticsLight(); setActivePill(pill); }, []);
  const handleGlobalReset = useCallback(() => {
    setAttrFilters(EMPTY_FAVORI_FILTERS);
    setSearchQuery('');
    setFavOnly(false);
  }, []);
  const handleEmptyExplore = useCallback(() => router.push('/(tabs)'), [router]);

  const gridNumCols = density === 'list' ? 1 : 2;
  const gridKey = `${gridNumCols}col`;

  const renderItem = useCallback(({ item }: { item: UserParfum }) => {
    const alert = byParfumId.get(item.parfumId) ?? null;
    const currentPrice = alert ? (alert.lastPrice ?? item.bestPrice ?? null) : null;
    const variation = alert ? alertVariation(alert.initialPrice, currentPrice) : null;
    const alertState = alert ? priceAlertState(alert.targetPrice, currentPrice) : null;
    return (
      <View style={gridNumCols === 2 ? s.gridItemWrap : s.listItemWrap}>
        <ParfumCard
          parfum={userParfumToCard(item)}
          mode={density}
          status={item.status}
          rating={item.rating}
          hidePrice
          priceAlert={alert ? { variation, state: alertState } : null}
          onPressOverride={() => handleCardPress(item)}
          onLongPress={() => handleLongPress(item)}
        />
      </View>
    );
  }, [density, gridNumCols, byParfumId, handleCardPress, handleLongPress, s]);

  const topChrome = (
    <View>
      <View style={s.header}>
        <Text style={s.title}>{t('collection.titleWithCount', { count: items.length })}</Text>
        {canShareCollection ? (
          <Pressable style={s.shareHeaderBtn} onPress={handleShareCollection} hitSlop={6} accessibilityRole="button" accessibilityLabel={t('collection.shareCollectionA11y')}>
            <Ionicons name="share-social-outline" size={18} color={theme.colors.primary} />
          </Pressable>
        ) : null}
      </View>

      <View style={s.segmented}>
        {VIEW_TABS.map(tab => {
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

      <View onLayout={handleSotdCardLayout}>
        <SOTDCard
          sotd={sotd}
          weather={weather}
          weatherLoading={weatherLoading}
          sotdScore={sotdScore}
          streak={streak}
          onPress={handleSotdPress}
          onChangePress={handleSotdChangePress}
          onShare={handleShareSotd}
          onWeatherEnablePress={handleWeatherEnablePress}
        />
      </View>
    </View>
  );

  const renderShelfGroup = useCallback(({ item, index }: { item: ShelfGroup; index: number }) => (
    <ShelfCard
      name={item.shelf.name}
      icon={item.shelf.icon}
      accent={item.shelf.color}
      tagline={item.shelf.description}
      items={orderForShelf(item.shelf.id, item.items)}
      variant="user"
      isPublic={item.shelf.isPublic}
      expanded={expanded?.has(item.shelf.id) ?? false}
      onToggleExpand={() => handleToggleExpand(item.shelf.id)}
      onPressBottle={handleShelfBottle}
      onLongPressBottle={handleShelfBottleLong}
      onAdd={() => handleOpenAddToShelf(item.shelf.id)}
      onOpenMenu={() => handleOpenShelfMenu(item.shelf)}
      onMoveUp={() => handleMoveShelf(item.shelf.id, -1)}
      onMoveDown={() => handleMoveShelf(item.shelf.id, 1)}
      canMoveUp={index > 0}
      canMoveDown={index < shelfGroups.length - 1}
    />
  ), [orderForShelf, expanded, handleToggleExpand, handleShelfBottle, handleShelfBottleLong, handleOpenAddToShelf, handleOpenShelfMenu, handleMoveShelf, shelfGroups.length]);

  const shelvesHeader = (
    <View>
      <Pressable style={s.newShelfBtn} onPress={handleOpenShelfManager} accessibilityRole="button" accessibilityLabel={t('collection.newShelf')}>
        <Ionicons name="add-circle-outline" size={18} color={theme.colors.primary} />
        <Text style={s.newShelfBtnText}>{t('collection.newShelf')}</Text>
      </Pressable>

      {sigItems.length > 0 ? (
        <ShelfCard
          name={t('collection.shelves.signature.name')}
          icon="star-outline"
          accent={theme.colors.secondary}
          tagline={t('collection.shelves.signature.tagline')}
          items={sigItems}
          variant="system"
          expanded={expanded?.has(SIG_ID) ?? false}
          onToggleExpand={() => handleToggleExpand(SIG_ID)}
          onPressBottle={handleShelfBottle}
          onLongPressBottle={handleShelfBottleLong}
        />
      ) : null}

      {favItems.length > 0 ? (
        <ShelfCard
          name={t('collection.shelves.favorites.name')}
          icon="heart"
          accent={theme.colors.favorite}
          tagline={t('collection.shelves.favorites.tagline')}
          items={favItems}
          variant="system"
          expanded={expanded?.has(FAV_ID) ?? false}
          onToggleExpand={() => handleToggleExpand(FAV_ID)}
          onPressBottle={handleShelfBottle}
          onLongPressBottle={handleShelfBottleLong}
        />
      ) : null}
    </View>
  );

  const shelvesFooter = (
    <View>
      {orphans.length > 0 ? (
        <ShelfCard
          name={t('collection.shelves.orphans.name')}
          icon="help-circle-outline"
          accent={null}
          tagline={t('collection.shelves.orphans.tagline')}
          items={orphans}
          variant="system"
          expanded={expanded?.has(ORPHAN_ID) ?? false}
          onToggleExpand={() => handleToggleExpand(ORPHAN_ID)}
          onPressBottle={handleShelfBottle}
          onLongPressBottle={handleShelfBottleLong}
          onPressEmblem={handleOrphanHelp}
          emblemAccessibilityLabel={t('collection.shelves.orphans.aboutA11y')}
        />
      ) : null}
    </View>
  );

  if (!authReady) {
    return <View style={s.center}><ActivityIndicator size="large" color={theme.colors.primary} /></View>;
  }

  if (!isAuthenticated) {
    return (
      <SafeAreaView edges={['bottom']} style={s.container}>
        <AuthGate icon="flask-outline" description={t('collection.authGate')} />
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView edges={['bottom']} style={s.container}>
        <View style={s.header}><Text style={s.title}>{t('collection.title')}</Text></View>
        <ActivityIndicator style={s.loadingSpinner} color={theme.colors.primary} />
      </SafeAreaView>
    );
  }

  if (items.length === 0) {
    return (
      <SafeAreaView edges={['bottom']} style={s.container}>
        <View style={s.header}><Text style={s.title}>{t('collection.title')}</Text></View>
        <EmptyState variant="wardrobe" onAction={handleEmptyExplore} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['bottom']} style={s.container}>
      {effectiveView === 'collection' ? (
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

              <View style={s.searchRow}>
                <View style={s.searchWrap}>
                  <Ionicons name="search-outline" size={16} color={theme.colors.textMuted} />
                  <TextInput
                    style={s.searchInput}
                    placeholder={t('collection.searchPlaceholder')}
                    placeholderTextColor={theme.colors.textMuted}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    keyboardAppearance={keyboardAppearance}
                  />
                </View>
                <Pressable style={s.toolBtn} onPress={cycleSort} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('collection.sortA11y')}>
                  <Ionicons name="swap-vertical-outline" size={16} color={theme.colors.primary} />
                  <Text style={s.toolBtnLabel}>{currentSortLabel}</Text>
                </Pressable>
                <Pressable style={s.toolBtn} onPress={handleOpenAttrSheet} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('collection.filtersA11y')}>
                  <Ionicons name="options-outline" size={16} color={activeAttrCount > 0 ? theme.colors.primary : theme.colors.textMuted} />
                  {activeAttrCount > 0 ? (
                    <View style={s.badge}><Text style={s.badgeText} allowFontScaling={false}>{activeAttrCount}</Text></View>
                  ) : null}
                </Pressable>
                <Pressable style={[s.toolBtn, favOnly && s.favBtnActive]} onPress={handleToggleFavOnly} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('collection.favOnlyA11y')} accessibilityState={{ checked: favOnly }}>
                  <Ionicons name={favOnly ? 'heart' : 'heart-outline'} size={16} color={favOnly ? theme.colors.favorite : theme.colors.textMuted} />
                </Pressable>
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.pillsRow}>
                {parfPills.map(pill => {
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

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.toolsRow}>
                {GRID_MODES.map(m => (
                  <Pressable
                    key={m.key}
                    style={[s.densityIconBtn, density === m.key && s.densityIconBtnActive]}
                    onPress={() => setDensity(m.key)}
                    hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                    accessibilityRole="button"
                    accessibilityLabel={m.label}
                  >
                    <Ionicons name={DENSITY_ICON[m.key] as never} size={18} color={density === m.key ? theme.colors.primary : theme.colors.textMuted} />
                  </Pressable>
                ))}
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
                        accessibilityLabel={t('collection.removeChipA11y', { label: chip.label })}
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
                    {activeAttrCount > 0 || searchQuery.trim() || favOnly ? t('collection.empty.filtered') : t('collection.empty.view')}
                  </Text>
                  <Pressable style={s.emptyResetBtn} onPress={handleGlobalReset} accessibilityRole="button" accessibilityLabel={t('collection.empty.reset')}>
                    <Text style={s.emptyResetBtnText}>{t('collection.empty.reset')}</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          }
        />
      ) : (
        <Animated.FlatList
          data={shelfGroups}
          keyExtractor={(g) => g.shelf.id}
          renderItem={renderShelfGroup}
          onScroll={scrollHandler}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.content}
          extraData={shelvesExtraData}
          itemLayoutAnimation={reduced ? undefined : LinearTransition}
          ListHeaderComponent={<>{topChrome}{shelvesHeader}</>}
          ListFooterComponent={shelvesFooter}
        />
      )}

      <StatuerSheet
        visible={statuerItem !== null}
        nom={statuerItem?.nom ?? ''}
        marque={statuerItem?.marque ?? ''}
        imageUrl={statuerItem?.imageUrl ?? null}
        status={statuerItem?.status ?? null}
        removeLabel={t('collection.statuerRemove')}
        shelves={shelves}
        shelfIds={statuerItem?.shelfIds ?? []}
        pinnedShelfIds={pinnedShelfIdsForItem}
        onClose={() => setStatuerItem(null)}
        onView={handleStatuerView}
        onSetStatus={handleStatuerStatus}
        onToggleShelf={handleStatuerToggleShelf}
        onTogglePin={handleTogglePin}
        onRemove={handleStatuerRemove}
      />

      <ShelfManager
        visible={shelfManagerVisible}
        shelves={shelves}
        orphanCount={orphans.length}
        editShelfId={editShelfId}
        onClose={handleCloseShelfManager}
        onCreate={handleCreateShelf}
        onUpdate={handleUpdateShelf}
        onReorder={reorder}
        onDelete={(id) => removeShelf(id).catch(() => hapticsError())}
      />

      <ActionSheet
        visible={shelfMenu !== null}
        title={shelfMenu?.name}
        actions={shelfMenuActions}
        onClose={handleCloseShelfMenu}
      />

      <AddToShelfSheet
        visible={addToShelfId !== null}
        shelfName={addToShelfName}
        candidates={addToShelfCandidates}
        onClose={handleCloseAddToShelf}
        onAdd={handleAddToShelf}
      />

      <PublishShelfGateSheet
        visible={publishGateShelfId !== null}
        uid={uid ?? ''}
        photoUrl={user?.photoURL ?? null}
        defaultPseudo={gateDefaultPseudo}
        shelfName={publishGateShelfName}
        onClose={() => setPublishGateShelfId(null)}
        onPublish={handlePublishFromGate}
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

      <InfoPopup
        visible={orphanHelpOpen}
        title={t('collection.shelves.orphans.helpTitle')}
        message={t('collection.shelves.orphans.helpMessage')}
        icon="help-circle-outline"
        onClose={() => setOrphanHelpOpen(false)}
      />

      <PermissionPrimer
        visible={locationPrimer.visible}
        copy={PERMISSION_PRIMERS.location}
        onAccept={handleLocationPrimerAccept}
        onDecline={handleLocationPrimerDecline}
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
    shareHeaderBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: t.colors.surface2, justifyContent: 'center', alignItems: 'center' },

    segmented: { flexDirection: 'row', backgroundColor: t.colors.surface2, borderRadius: 20, padding: 3, marginHorizontal: 16, marginTop: 8, marginBottom: 8 },
    segment: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8, borderRadius: 18 },
    segmentActive: { backgroundColor: t.colors.surface, ...t.shadow.card },
    segmentText: { fontFamily: 'Inter_500Medium', fontSize: 13, color: t.colors.textMuted },
    segmentTextActive: { fontFamily: 'Inter_600SemiBold', color: t.colors.text },

    newShelfBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1.5, borderColor: t.colors.primary, borderRadius: t.radius.base, paddingVertical: 11, marginBottom: 16, minHeight: 44 },
    newShelfBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: t.colors.primary },

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

    activeChipsRow: { gap: 8, paddingHorizontal: 16, paddingBottom: 8 },
    dismissChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 20 },
    dismissChipText: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },

    emptyFilter: { paddingVertical: 32, alignItems: 'center' },
    emptyFilterText: { fontFamily: 'Inter_400Regular', fontSize: 14, color: t.colors.textMuted, marginTop: 8, textAlign: 'center' },
    emptyResetBtn: { marginTop: 12, borderWidth: 1.5, borderColor: t.colors.primary, borderRadius: t.radius.base, paddingVertical: 10, paddingHorizontal: 20, minHeight: 44 },
    emptyResetBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: t.colors.primary },
  } as const;
}
