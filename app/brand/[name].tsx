// app/brand/[name].tsx — Catalogue d'une maison (chip « La maison » de la fiche détail)

import { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, Pressable, ActivityIndicator, FlatList, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Ionicons from '@react-native-vector-icons/ionicons/static';
import { getParfumsByMarque } from '../../src/services/catalog';
import { setPendingParfum } from '../../src/services/catalog-bridge';
import { hapticsLight } from '../../src/services/haptics';
import { useTheme, type Theme } from '../../src/theme/ThemeContext';
import { useDensityPreference, GRID_MODES } from '../../src/hooks/useDensityPreference';
import { OLFACTORY_FAMILIES, getFamilyByValue } from '../../src/utils/olfactory-families';
import ParfumCard from '../../src/components/ParfumCard';
import type { Parfum } from '../../src/models';

const MAX_RESULTS = 1000;

type SortKey = 'pop' | 'priceAsc' | 'priceDesc' | 'new';

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'pop', label: 'Populaires' },
  { key: 'priceAsc', label: 'Prix croissant' },
  { key: 'priceDesc', label: 'Prix décroissant' },
  { key: 'new', label: 'Nouveautés' },
];

const DENSITY_ICON: Record<string, string> = {
  comfortable: 'grid-outline',
  compactPlus: 'apps-outline',
  list: 'list-outline',
};

export default function BrandPage() {
  const rawName = useLocalSearchParams<{ name: string }>().name;
  const name = Array.isArray(rawName) ? rawName[0] : rawName;
  const router = useRouter();
  const { theme, resolvedMode } = useTheme();
  const s = useMemo(() => getStyles(theme), [theme]);
  const { density: gridDensity, setDensity: setGridDensity } = useDensityPreference();

  const [parfums, setParfums] = useState<Parfum[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [activeSort, setActiveSort] = useState<SortKey>('pop');
  const [activeFamily, setActiveFamily] = useState<string | null>(null);

  useEffect(() => {
    if (!name) return;
    let mounted = true;
    getParfumsByMarque(name)
      .then(results => { if (mounted) { setParfums(results); setLoading(false); } })
      .catch(() => { if (mounted) { setError(true); setLoading(false); } });
    return () => { mounted = false; };
  }, [name]);

  const familyCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of parfums) {
      const fam = getFamilyByValue(p.familleOlactive);
      if (fam) counts.set(fam.key, (counts.get(fam.key) ?? 0) + 1);
    }
    return counts;
  }, [parfums]);

  const presentFamilies = useMemo(
    () => OLFACTORY_FAMILIES.filter(f => familyCounts.has(f.key)),
    [familyCounts],
  );

  const displayed = useMemo(() => {
    const filtered = activeFamily
      ? parfums.filter(p => getFamilyByValue(p.familleOlactive)?.key === activeFamily)
      : parfums;
    return [...filtered].sort((a, b) => {
      switch (activeSort) {
        case 'priceAsc': return (a.bestPrice ?? Infinity) - (b.bestPrice ?? Infinity);
        case 'priceDesc': return (b.bestPrice ?? 0) - (a.bestPrice ?? 0);
        case 'new': return (b.annee ?? 0) - (a.annee ?? 0);
        default: return (b.popularityScore ?? 0) - (a.popularityScore ?? 0);
      }
    });
  }, [parfums, activeFamily, activeSort]);

  const handleParfumPress = useCallback((p: Parfum) => {
    setPendingParfum(p);
    router.push(`/catalog/${p.id}`);
  }, [router]);

  const cycleSort = useCallback(() => {
    hapticsLight();
    const idx = SORT_OPTIONS.findIndex(o => o.key === activeSort);
    setActiveSort(SORT_OPTIONS[(idx + 1) % SORT_OPTIONS.length].key);
  }, [activeSort]);

  const handleFamilyTap = useCallback((key: string | null) => {
    hapticsLight();
    setActiveFamily(prev => (prev === key ? null : key));
  }, []);

  const renderItem = useCallback(({ item }: { item: Parfum }) => (
    <View style={gridDensity === 'list' ? s.listItemWrap : s.gridItemWrap}>
      <ParfumCard parfum={item} mode={gridDensity} onPressOverride={() => handleParfumPress(item)} />
    </View>
  ), [gridDensity, s, handleParfumPress]);

  const gridNumCols = gridDensity === 'list' ? 1 : 2;
  const gridKey = `${gridNumCols}col-${resolvedMode}`;
  const currentSortLabel = SORT_OPTIONS.find(o => o.key === activeSort)?.label ?? 'Tri';
  const countLabel = `${displayed.length >= MAX_RESULTS ? `${MAX_RESULTS}+` : displayed.length} parfum${displayed.length > 1 ? 's' : ''}`;
  const colors = theme.colors as Record<string, string>;

  return (
    <SafeAreaView edges={['top', 'bottom']} style={s.container}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel="Retour" style={s.backBtn}>
          <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
        </Pressable>
        <View style={s.headerBody}>
          <Text style={s.overline}>La maison</Text>
          <Text style={s.name} numberOfLines={1}>{name ?? ''}</Text>
        </View>
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator size="large" color={theme.colors.primary} /></View>
      ) : error ? (
        <View style={s.center}>
          <Ionicons name="cloud-offline-outline" size={48} color={theme.colors.textMuted} />
          <Text style={s.emptyTitle}>Chargement impossible</Text>
          <Text style={s.emptyDesc} maxFontSizeMultiplier={1.3}>Vérifie ta connexion et réessaie.</Text>
        </View>
      ) : parfums.length === 0 ? (
        <View style={s.center}>
          <Ionicons name="storefront-outline" size={48} color={theme.colors.textMuted} />
          <Text style={s.emptyTitle}>Aucun parfum</Text>
          <Text style={s.emptyDesc} maxFontSizeMultiplier={1.3}>Aucun parfum du catalogue n'est référencé pour cette maison.</Text>
        </View>
      ) : (
        <FlatList
          key={gridKey}
          data={displayed}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          extraData={`${gridDensity}|${resolvedMode}|${activeSort}|${activeFamily}`}
          numColumns={gridNumCols}
          columnWrapperStyle={gridNumCols === 2 ? s.row : undefined}
          contentContainerStyle={s.content}
          ListHeaderComponent={
            <View>
              <View style={s.controlsRow}>
                <Text style={s.count}>{countLabel}</Text>
                <View style={s.controlsRight}>
                  <Pressable style={s.sortBtn} onPress={cycleSort} hitSlop={8} accessibilityRole="button" accessibilityLabel="Trier">
                    <Ionicons name="swap-vertical-outline" size={16} color={theme.colors.primary} />
                    <Text style={s.sortBtnLabel}>{currentSortLabel}</Text>
                  </Pressable>
                  {GRID_MODES.map(m => (
                    <Pressable
                      key={m.key}
                      style={[s.densityIconBtn, gridDensity === m.key && s.densityIconBtnActive]}
                      onPress={() => { hapticsLight(); setGridDensity(m.key); }}
                      hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                      accessibilityRole="button"
                      accessibilityLabel={m.label}
                    >
                      <Ionicons name={DENSITY_ICON[m.key] as never} size={18} color={gridDensity === m.key ? theme.colors.primary : theme.colors.textMuted} />
                    </Pressable>
                  ))}
                </View>
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.familyRow}>
                <Pressable
                  style={[s.familyChip, activeFamily === null && s.familyChipAllActive]}
                  onPress={() => handleFamilyTap(null)}
                  hitSlop={{ top: 2, bottom: 2 }}
                  accessibilityRole="button"
                  accessibilityLabel="Toutes les familles"
                >
                  <Ionicons name="apps-outline" size={14} color={activeFamily === null ? theme.colors.primaryInk : theme.colors.textMuted} />
                  <Text style={[s.familyChipText, activeFamily === null && s.familyChipTextAllActive]} allowFontScaling={false}>Toutes</Text>
                  <Text style={[s.familyChipCount, activeFamily === null && s.familyChipCountAllActive]} allowFontScaling={false}>{parfums.length}</Text>
                </Pressable>
                {presentFamilies.map(fam => {
                  const active = activeFamily === fam.key;
                  const accent = colors[fam.accent];
                  const accentSoft = colors[fam.accentSoft];
                  return (
                    <Pressable
                      key={fam.key}
                      style={[s.familyChip, active && { backgroundColor: accentSoft, borderColor: accent }]}
                      onPress={() => handleFamilyTap(fam.key)}
                      hitSlop={{ top: 2, bottom: 2 }}
                      accessibilityRole="button"
                      accessibilityLabel={`${fam.label}, ${familyCounts.get(fam.key) ?? 0}`}
                    >
                      <Ionicons name={fam.icon as never} size={14} color={active ? accent : theme.colors.textMuted} />
                      <Text style={[s.familyChipText, active && { color: accent, fontFamily: 'Inter_600SemiBold' }]} allowFontScaling={false}>{fam.label}</Text>
                      <Text style={[s.familyChipCount, active && { color: accent }]} allowFontScaling={false}>{familyCounts.get(fam.key) ?? 0}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          }
          showsVerticalScrollIndicator={false}
          windowSize={5}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
        />
      )}
    </SafeAreaView>
  );
}

function getStyles(t: Theme) {
  return {
    container: { flex: 1, backgroundColor: t.colors.background },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24, gap: 10 },
    header: { flexDirection: 'row', alignItems: 'center', paddingRight: t.spacing.md },
    backBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
    headerBody: { flex: 1, paddingVertical: 6 },
    overline: { fontFamily: 'Inter_400Regular', fontSize: 10, color: t.colors.textMuted, textTransform: 'uppercase', letterSpacing: 1.5 },
    name: { fontFamily: 'PlayfairDisplay_600SemiBold', fontSize: 22, color: t.colors.text, marginTop: 2 },
    controlsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: t.spacing.md, paddingTop: 4, paddingBottom: 8 },
    count: { fontFamily: 'Inter_400Regular', fontSize: 12, color: t.colors.textMuted },
    controlsRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    sortBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 9, borderRadius: 20, backgroundColor: t.colors.surface, borderWidth: 1, borderColor: t.colors.border, minHeight: 36 },
    sortBtnLabel: { fontFamily: 'Inter_500Medium', fontSize: 12, color: t.colors.primary },
    densityIconBtn: { width: 36, height: 36, borderRadius: 8, backgroundColor: t.colors.surface2, alignItems: 'center', justifyContent: 'center' },
    densityIconBtnActive: { backgroundColor: t.colors.surface, ...t.shadow.card },
    familyRow: { gap: 8, paddingHorizontal: t.spacing.md, paddingBottom: 12 },
    familyChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: t.colors.surface2, borderWidth: 1, borderColor: 'transparent', minHeight: 40 },
    familyChipAllActive: { backgroundColor: t.colors.primarySoft, borderColor: t.colors.primary },
    familyChipText: { fontFamily: 'Inter_500Medium', fontSize: 13, color: t.colors.textMuted },
    familyChipTextAllActive: { color: t.colors.primaryInk, fontFamily: 'Inter_600SemiBold' },
    familyChipCount: { fontFamily: 'Inter_700Bold', fontSize: 12, color: t.colors.textMuted },
    familyChipCountAllActive: { color: t.colors.primaryInk },
    row: { gap: 10, paddingHorizontal: t.spacing.md, marginBottom: 10 },
    content: { paddingBottom: t.spacing.xl },
    gridItemWrap: { flex: 1 },
    listItemWrap: { paddingHorizontal: t.spacing.md, marginBottom: 8 },
    emptyTitle: { fontFamily: 'PlayfairDisplay_600SemiBold', fontSize: 18, color: t.colors.text, marginTop: 8 },
    emptyDesc: { fontFamily: 'Inter_400Regular', fontSize: 14, color: t.colors.textMuted, textAlign: 'center', maxWidth: 280 },
  } as const;
}
