// app/(tabs)/history.tsx — Journal olfactif : historique des scans
// ScanHistoryCard wrapper : ParfumCard (scans réussis) + overlay statut

import { useState, useMemo, useCallback, memo } from 'react';
import { View, Text, ScrollView, SectionList, Pressable, ActivityIndicator, Alert, TextInput, RefreshControl } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';
import Ionicons from '@react-native-vector-icons/ionicons/static';
import { useAuthContext } from '../src/contexts/AuthContext';
import { useScans } from '../src/hooks/useScans';
import { getParfumById } from '../src/services/catalog';
import { setPendingParfum } from '../src/services/catalog-bridge';
import { addUserParfum } from '../src/services/user-parfum';
import { addPossession } from '../src/services/possessions';
import { hapticsLight } from '../src/services/haptics';
import { useTheme, type Theme } from '../src/theme/ThemeContext';

import EmptyState from '../src/components/EmptyState';
import ActionSheet from '../src/components/ActionSheet';
import ParfumCard from '../src/components/ParfumCard';
import type { ActionItem } from '../src/components/ActionSheet';
import type { UserScan } from '../src/models/user-scan.interface';
import type { Parfum } from '../src/models';
import { brandColor } from '../src/utils/brand-color';

function getScanDate(d: Date | { toDate: () => Date } | undefined): Date | null {
  if (!d) return null;
  if (d instanceof Date) return d;
  if (typeof (d as Record<string, unknown>).toDate === 'function') return (d as { toDate: () => Date }).toDate();
  return new Date(d as unknown as string);
}

function isToday(d: Date): boolean {
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

function isYesterday(d: Date): boolean {
  const y = new Date();
  y.setDate(y.getDate() - 1);
  return d.getFullYear() === y.getFullYear() && d.getMonth() === y.getMonth() && d.getDate() === y.getDate();
}

function getWeekNumber(d: Date): number {
  const start = new Date(d.getFullYear(), 0, 1);
  return Math.ceil(((d.getTime() - start.getTime()) / 86400000 + start.getDay() + 1) / 7);
}

function isThisWeek(d: Date): boolean {
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && getWeekNumber(d) === getWeekNumber(now);
}

function isThisMonth(d: Date): boolean {
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

const MONTHS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

interface ScanCard { scan: UserScan; repeatCount: number }
interface ScanSection { title: string; data: ScanCard[] }

function groupScansByPeriod(scans: UserScan[]): ScanSection[] {
  const sorted = [...scans].sort((a, b) => {
    const da = getScanDate(a.scannedAt)?.getTime() ?? 0;
    const db = getScanDate(b.scannedAt)?.getTime() ?? 0;
    return db - da;
  });

  const repeatMap = new Map<string, number>();
  for (const s of sorted) {
    if (s.parfumId) repeatMap.set(s.parfumId, (repeatMap.get(s.parfumId) ?? 0) + 1);
  }

  const groups: { label: string; scans: UserScan[] }[] = [];

  for (const scan of sorted) {
    const d = getScanDate(scan.scannedAt);
    if (!d) continue;

    let label: string;
    if (isToday(d)) label = "Aujourd'hui";
    else if (isYesterday(d)) label = 'Hier';
    else if (isThisWeek(d)) label = 'Cette semaine';
    else if (isThisMonth(d)) label = 'Ce mois';
    else label = `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;

    const last = groups[groups.length - 1];
    if (last && last.label === label) {
      last.scans.push(scan);
    } else {
      groups.push({ label, scans: [scan] });
    }
  }

  const consolidated: { label: string; scans: UserScan[] }[] = [];
  for (let i = 0; i < groups.length; i++) {
    const g = groups[i];
    if (g.scans.length === 1 && consolidated.length > 0) {
      consolidated[consolidated.length - 1].scans.push(g.scans[0]);
    } else {
      consolidated.push(g);
    }
  }

  return consolidated.map(g => ({
    title: g.label,
    data: g.scans.map(scan => ({ scan, repeatCount: scan.parfumId ? (repeatMap.get(scan.parfumId) ?? 1) : 1 })),
  }));
}

function getDotColor(status: UserScan['status'], t: Theme): string {
  if (status === 'success') return t.colors.success;
  if (status === 'error') return t.colors.danger;
  return t.colors.textMuted;
}

function formatScanTime(date: Date | null): string {
  if (!date) return '';
  return date.toLocaleString([], { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    .replace(/^./, c => c.toUpperCase());
}

function scanToParfum(scan: UserScan): Parfum {
  return {
    id: scan.parfumId ?? scan.id,
    nom: scan.nom ?? '',
    marque: scan.marque ?? '',
    imageUrl: scan.imageUrl ?? undefined,
    familleOlactive: scan.familleOlactive ?? '',
    bestPrice: scan.bestPrice ?? undefined,
    annee: scan.annee ?? undefined,
  } as Parfum;
}

// ── ScanHistoryCard (wrapper) ──

function ScanHistoryCardBase({
  scan,
  repeatCount,
  onPress,
  onLongPress,
  density,
}: {
  scan: UserScan;
  repeatCount: number;
  onPress: (() => void) | undefined;
  onLongPress: () => void;
  density: 'comfortable' | 'compactPlus' | 'list';
}) {
  const { theme } = useTheme();
  const s = useMemo(() => getCardStyles(theme), [theme]);
  const date = getScanDate(scan.scannedAt);
  const dateStr = formatScanTime(date);
  const dotColor = getDotColor(scan.status, theme);
  const isSuccess = scan.status === 'success' && scan.parfumId;

  // No-result / error : layout compact
  if (!isSuccess) {
    const tint = brandColor(scan.marque ?? '');
    return (
      <Pressable style={s.cardNoResult} onLongPress={onLongPress} delayLongPress={400}>
        <View style={[s.dotBadge, { backgroundColor: dotColor }]} />
        {scan.imageUrl ? (
          <Image source={{ uri: scan.imageUrl }} style={s.image} contentFit="cover" cachePolicy="memory-disk" recyclingKey={scan.id} transition={200} />
        ) : (
          <View style={[s.imagePlaceholder, { backgroundColor: tint }]}>
            <Text style={s.placeholderInit}>{(scan.marque ?? '?').charAt(0).toUpperCase()}</Text>
          </View>
        )}
        <View style={s.infoNoResult}>
          {scan.marque ? <Text style={s.brand} numberOfLines={1}>{scan.marque}</Text> : null}
          <Text style={s.name} numberOfLines={1}>{scan.nom ?? scan.rawText ?? 'Scan sans résultat'}</Text>
          <View style={s.footer}>
            <View style={s.dateRow}>
              <Ionicons name="time-outline" size={12} color={theme.colors.textMuted} />
              <Text style={s.dateText}>{dateStr}</Text>
            </View>
          </View>
        </View>
      </Pressable>
    );
  }

  // Success : ParfumCard avec overlay
  const cardData = scanToParfum(scan);
  return (
    <Pressable onLongPress={onLongPress} delayLongPress={400} onPress={onPress}>
      <View style={s.successWrap}>
        <ParfumCard parfum={cardData} mode={density} />
        <View style={s.overlayRow}>
          <View style={[s.dotBadge, { backgroundColor: dotColor }]} />
          <View style={s.overlayInfo}>
            <View style={s.dateRow}>
              <Ionicons name="time-outline" size={11} color={theme.colors.textMuted} />
              <Text style={s.dateTextSmall}>{dateStr}</Text>
            </View>
          </View>
          {repeatCount > 1 && (
            <View style={s.repeatBadge}>
              <Text style={s.repeatText}>×{repeatCount}</Text>
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
}

const ScanHistoryCard = memo(ScanHistoryCardBase, (prev, next) =>
  prev.scan === next.scan &&
  prev.repeatCount === next.repeatCount &&
  prev.density === next.density
);

// ── Composant principal ──

export default function HistoryPage() {
  const { theme, resolvedMode } = useTheme();
  const s = useMemo(() => getStyles(theme), [theme]);
  const { user, authReady, isAuthenticated } = useAuthContext();
  const router = useRouter();
  const uid = user?.uid ?? null;
  const { scans, loading, removeScan } = useScans(uid);
  const keyboardAppearance = resolvedMode === 'dark' ? 'dark' : 'light';
  const [searchQuery, setSearchQuery] = useState('');
  const [sortNewest, setSortNewest] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedScan, setSelectedScan] = useState<UserScan | null>(null);
  const reduced = useReducedMotion();

  const goToDetail = useCallback(async (parfumId: string) => {
    try {
      const p = await getParfumById(parfumId);
      if (p) setPendingParfum(p);
    } catch (e: unknown) { console.warn('[history] getParfumById failed:', (e as Error)?.message ?? String(e)); }
    router.push(`/catalog/${parfumId}`);
  }, [router]);

  const handleLongPress = useCallback((scan: UserScan) => {
    hapticsLight();
    setSelectedScan(scan);
  }, []);

  const actionSheetActions = useMemo((): ActionItem[] => {
    if (!selectedScan) return [];
    const actions: ActionItem[] = [];

    if (selectedScan.parfumId) {
      actions.push({
        icon: 'eye-outline',
        label: 'Voir le détail',
        onPress: () => { goToDetail(selectedScan.parfumId!); setSelectedScan(null); },
      });
      actions.push({
        icon: 'add-circle-outline',
        label: 'Ajouter à ma parfumerie',
        onPress: () => {
          addPossession(uid!, selectedScan.parfumId!, 'bottle').catch(() => {});
          addUserParfum(uid!, selectedScan.parfumId!, 'have').catch(() => {});
          setSelectedScan(null);
        },
      });
    }

    actions.push({
      icon: 'trash-outline',
      label: 'Supprimer',
      destructive: true,
      onPress: () => {
        setSelectedScan(null);
        Alert.alert('Supprimer', "Supprimer ce scan de l'historique ?", [
          { text: 'Annuler', style: 'cancel' },
          { text: 'Supprimer', style: 'destructive', onPress: () => removeScan(selectedScan.id).catch(() => {}) },
        ]);
      },
    });

    return actions;
  }, [selectedScan, uid, goToDetail, removeScan]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 800);
  }, []);

  const filtered = useMemo(() => {
    let result = [...scans];
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(s =>
        (s.marque ?? '').toLowerCase().includes(q) ||
        (s.nom ?? '').toLowerCase().includes(q)
      );
    }
    result.sort((a, b) => {
      const da = getScanDate(a.scannedAt)?.getTime() ?? 0;
      const db = getScanDate(b.scannedAt)?.getTime() ?? 0;
      return sortNewest ? db - da : da - db;
    });
    return result;
  }, [scans, searchQuery, sortNewest]);

  const sections = useMemo(() => groupScansByPeriod(filtered), [filtered]);

  const hasScanToday = useMemo(() => {
    return scans.some(s => {
      const d = getScanDate(s.scannedAt);
      return d ? isToday(d) : false;
    });
  }, [scans]);

  const renderHistoryItem = useCallback(({ item, index }: { item: ScanCard; index: number }) => (
    <Animated.View
      entering={reduced ? undefined : FadeInDown.delay(Math.min(index, 10) * 40).duration(260)}
      style={s.cardSpacing}
    >
      <ScanHistoryCard
        scan={item.scan}
        repeatCount={item.repeatCount}
        onPress={item.scan.parfumId ? () => goToDetail(item.scan.parfumId!) : undefined}
        onLongPress={() => handleLongPress(item.scan)}
        density="list"
      />
    </Animated.View>
  ), [reduced, s, goToDetail, handleLongPress]);

  const renderSectionHeader = useCallback(({ section }: { section: ScanSection }) => (
    <View style={s.sectionHeader}>
      <Text style={s.sectionTitle}>{section.title}</Text>
    </View>
  ), [s]);

  const showSearch = scans.length > 5;

  if (!authReady) return <View style={s.center}><ActivityIndicator size="large" color={theme.colors.primary} /></View>;

  if (!isAuthenticated) {
    return (
      <SafeAreaView edges={['top', 'bottom']} style={s.container}>
        <View style={s.center}>
          <Ionicons name="lock-closed-outline" size={64} color={theme.colors.textMuted} />
          <Text style={s.authTitle}>Connecte-toi</Text>
          <Text style={s.authDesc}>Accède à ton historique de scans.</Text>
          <Pressable style={s.authBtn} onPress={() => router.push('/auth/login')}>
            <Text style={s.authBtnText}>Se connecter</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (scans.length === 0 && !loading) {
    return (
      <SafeAreaView edges={['top', 'bottom']} style={s.container}>
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
        >
          <View style={s.headerBar}>
            <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel="Retour">
              <Ionicons name="arrow-back" size={22} color={theme.colors.text} />
            </Pressable>
            <Text style={s.title}>Historique</Text>
          </View>
          <EmptyState variant="historique" onAction={() => router.push('/scan')} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  const listHeader = (
    <View>
      <View style={s.headerBar}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel="Retour">
          <Ionicons name="arrow-back" size={22} color={theme.colors.text} />
        </Pressable>
        <Text style={s.title}>{loading ? 'Historique' : `Historique · ${scans.length}`}</Text>
      </View>

      {!hasScanToday && (
        <Pressable style={s.todayPrompt} onPress={() => router.push('/scan')}>
          <Ionicons name="sunny-outline" size={18} color={theme.colors.primary} />
          <Text style={s.todayPromptText}>Scanner un parfum aujourd'hui ?</Text>
        </Pressable>
      )}

      {showSearch && (
        <View style={s.filterContainer}>
          <View style={s.searchRow}>
            <View style={s.searchWrap}>
              <Ionicons name="search-outline" size={16} color={theme.colors.textMuted} />
              <TextInput
                style={s.searchInput}
                placeholder="Rechercher un scan..."
                placeholderTextColor={theme.colors.textMuted}
                value={searchQuery}
                onChangeText={setSearchQuery}
                keyboardAppearance={keyboardAppearance}
              />
            </View>
            <Pressable style={s.sortBtn} onPress={() => setSortNewest(p => !p)} hitSlop={8}>
              <Ionicons name="swap-vertical-outline" size={16} color={theme.colors.primary} />
              <Text style={s.sortLabel}>{sortNewest ? 'Récents' : 'Anciens'}</Text>
            </Pressable>
          </View>
        </View>
      )}

      {loading && <ActivityIndicator style={{ marginTop: 24 }} color={theme.colors.primary} />}
    </View>
  );

  return (
    <SafeAreaView edges={['top', 'bottom']} style={s.container}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.scan.id}
        renderItem={renderHistoryItem}
        renderSectionHeader={renderSectionHeader}
        ListHeaderComponent={listHeader}
        ListFooterComponent={<View style={s.bottomSpacer} />}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.colors.primary} />
        }
        contentContainerStyle={s.scroll}
        stickySectionHeadersEnabled={false}
        showsVerticalScrollIndicator={false}
        windowSize={5}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
      />

      <ActionSheet
        visible={selectedScan !== null}
        title={selectedScan?.nom ?? undefined}
        actions={actionSheetActions}
        onClose={() => setSelectedScan(null)}
      />
    </SafeAreaView>
  );
}

// ── Styles ──

function getCardStyles(t: Theme) {
  return {
    // Success wrapper
    successWrap: {
      marginHorizontal: 16,
    },
    overlayRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 4,
      paddingTop: 4,
    },
    overlayInfo: {
      flex: 1,
    },
    dotBadge: {
      width: 8,
      height: 8,
      borderRadius: t.radius.full,
    },
    dateRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    dateText: {
      fontFamily: 'Inter_400Regular',
      fontSize: 11,
      color: t.colors.textMuted,
    },
    dateTextSmall: {
      fontFamily: 'Inter_400Regular',
      fontSize: 10,
      color: t.colors.textMuted,
    },
    repeatBadge: {
      backgroundColor: t.colors.primarySoft,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 10,
    },
    repeatText: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 11,
      color: t.colors.primaryInk,
    },

    // No-result card
    cardNoResult: {
      flexDirection: 'row',
      backgroundColor: t.colors.surface,
      borderRadius: t.radius.card,
      marginHorizontal: 16,
      padding: 12,
      gap: 12,
      overflow: 'hidden' as const,
      ...t.shadow.card,
    },
    image: {
      width: 56,
      height: 70,
      borderRadius: t.radius.sm,
      backgroundColor: t.colors.surface2,
    },
    imagePlaceholder: {
      width: 56,
      height: 70,
      borderRadius: t.radius.sm,
      justifyContent: 'center',
      alignItems: 'center',
    },
    placeholderInit: {
      fontFamily: 'Inter_700Bold',
      fontSize: 22,
      color: '#FFFFFF',
      opacity: 0.5,
    },
    infoNoResult: {
      flex: 1,
      gap: 2,
      justifyContent: 'center',
    },
    brand: {
      fontFamily: 'Inter_400Regular',
      fontSize: 11,
      textTransform: 'uppercase',
      letterSpacing: 1.5,
      color: t.colors.textMuted,
    },
    name: {
      fontFamily: 'PlayfairDisplay_600SemiBold',
      fontSize: 15,
      color: t.colors.text,
      flexShrink: 1,
    },
    footer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 4,
    },
  } as const;
}

function getStyles(t: Theme) {
  return {
    container: { flex: 1, backgroundColor: t.colors.background },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
    scroll: { paddingBottom: 88 },
    cardSpacing: { marginBottom: 8 },
    headerBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
    title: { fontFamily: 'PlayfairDisplay_700Bold', fontSize: 28, color: t.colors.text, flex: 1 },
    authTitle: { fontFamily: 'PlayfairDisplay_600SemiBold', fontSize: 20, color: t.colors.text, marginTop: 12 },
    authDesc: { fontFamily: 'Inter_400Regular', fontSize: 14, color: t.colors.textMuted, textAlign: 'center', lineHeight: 20, marginTop: 6 },
    authBtn: {
      marginTop: 20,
      borderWidth: 1.5,
      borderColor: t.colors.primary,
      borderRadius: t.radius.base,
      paddingHorizontal: 32,
      paddingVertical: 12,
    },
    authBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: t.colors.primary },
    todayPrompt: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: t.colors.primarySoft,
      borderRadius: t.radius.base,
      marginHorizontal: 16,
      marginBottom: 8,
      paddingVertical: 10,
      paddingHorizontal: 14,
      gap: 8,
    },
    todayPromptText: { fontFamily: 'Inter_500Medium', fontSize: 13, color: t.colors.primaryInk },
    filterContainer: { paddingHorizontal: 12, paddingBottom: 8 },
    searchRow: {
      flexDirection: 'row', alignItems: 'center',
      marginBottom: 8, gap: 8,
    },
    searchWrap: {
      flex: 1, flexDirection: 'row', alignItems: 'center',
      backgroundColor: t.colors.surface2, borderRadius: 20,
      paddingHorizontal: 12, height: 36, gap: 8,
    },
    searchInput: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 13, color: t.colors.text },
    sortBtn: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 6, paddingVertical: 6 },
    sortLabel: { fontFamily: 'Inter_500Medium', fontSize: 11, color: t.colors.primary },
    sectionHeader: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 6 },
    sectionTitle: { fontFamily: 'PlayfairDisplay_600SemiBold', fontSize: 17, color: t.colors.text },
    bottomSpacer: { height: 40 },
  } as const;
}
