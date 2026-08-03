// app/perfumer/[name].tsx — Créations d'un nez (signature dorée de la fiche détail)

import { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, Pressable, ActivityIndicator, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Ionicons from '@react-native-vector-icons/ionicons/static';
import { getParfumsByPerfumer } from '../../src/services/catalog';
import { setPendingParfum } from '../../src/services/catalog-bridge';
import { hapticsLight } from '../../src/services/haptics';
import { useTheme, type Theme } from '../../src/theme/ThemeContext';
import { useDensityPreference, GRID_MODES } from '../../src/hooks/useDensityPreference';
import ParfumCard from '../../src/components/ParfumCard';
import type { Parfum } from '../../src/models';

const MAX_RESULTS = 50;

export default function PerfumerPage() {
  const rawName = useLocalSearchParams<{ name: string }>().name;
  const name = Array.isArray(rawName) ? rawName[0] : rawName;
  const router = useRouter();
  const { theme, resolvedMode } = useTheme();
  const s = useMemo(() => getStyles(theme), [theme]);
  const { density: gridDensity, setDensity: setGridDensity } = useDensityPreference();

  const [parfums, setParfums] = useState<Parfum[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!name) { setLoading(false); setError(true); return; }
    let mounted = true;
    getParfumsByPerfumer(name)
      .then(results => { if (mounted) { setParfums(results); setLoading(false); } })
      .catch(() => { if (mounted) { setError(true); setLoading(false); } });
    return () => { mounted = false; };
  }, [name]);

  const handleParfumPress = useCallback((p: Parfum) => {
    setPendingParfum(p);
    router.push(`/catalog/${p.id}`);
  }, [router]);

  const renderItem = useCallback(({ item }: { item: Parfum }) => (
    <View style={gridDensity === 'list' ? s.listItemWrap : s.gridItemWrap}>
      <ParfumCard parfum={item} mode={gridDensity} onPressOverride={() => handleParfumPress(item)} />
    </View>
  ), [gridDensity, s, handleParfumPress]);

  const gridNumCols = gridDensity === 'list' ? 1 : 2;
  const gridKey = `${gridNumCols}col`;
  const countLabel = `${parfums.length >= MAX_RESULTS ? `${MAX_RESULTS}+` : parfums.length} création${parfums.length > 1 ? 's' : ''}`;

  return (
    <SafeAreaView edges={['top', 'bottom']} style={s.container}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel="Retour" style={s.backBtn}>
          <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
        </Pressable>
        <View style={s.headerBody}>
          <Text style={s.overline}>Le nez</Text>
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
          <Ionicons name="finger-print-outline" size={48} color={theme.colors.textMuted} />
          <Text style={s.emptyTitle}>Aucune création</Text>
          <Text style={s.emptyDesc} maxFontSizeMultiplier={1.3}>Aucun parfum du catalogue n'est signé par ce nez.</Text>
        </View>
      ) : (
        <FlatList
          key={gridKey}
          data={parfums}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          extraData={`${gridDensity}|${resolvedMode}`}
          numColumns={gridNumCols}
          columnWrapperStyle={gridNumCols === 2 ? s.row : undefined}
          contentContainerStyle={s.content}
          ListHeaderComponent={
            <View style={s.controlsRow}>
              <Text style={s.count}>{countLabel}</Text>
              <View style={s.segmentWrap}>
                {GRID_MODES.map(m => (
                  <Pressable
                    key={m.key}
                    style={[s.segmentBtn, gridDensity === m.key && s.segmentBtnActive]}
                    onPress={() => { hapticsLight(); setGridDensity(m.key); }}
                  >
                    <Text style={[s.segmentBtnText, gridDensity === m.key && s.segmentBtnTextActive]}>{m.label}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          }
          showsVerticalScrollIndicator={false}
          windowSize={5}
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
    controlsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: t.spacing.md, paddingBottom: t.spacing.base },
    count: { fontFamily: 'Inter_400Regular', fontSize: 12, color: t.colors.textMuted },
    segmentWrap: { flexDirection: 'row', backgroundColor: t.colors.surface2, borderRadius: t.radius.sm, padding: 3, gap: 1 },
    segmentBtn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 6, minHeight: 44, justifyContent: 'center' },
    segmentBtnActive: { backgroundColor: t.colors.surface, ...t.shadow.card },
    segmentBtnText: { fontFamily: 'Inter_500Medium', fontSize: 12, color: t.colors.textMuted },
    segmentBtnTextActive: { fontFamily: 'Inter_600SemiBold', color: t.colors.text },
    row: { gap: 10, paddingHorizontal: t.spacing.md, marginBottom: 10 },
    content: { paddingBottom: t.spacing.xl },
    gridItemWrap: { flex: 1 },
    listItemWrap: { paddingHorizontal: t.spacing.md, marginBottom: 8 },
    emptyTitle: { fontFamily: 'PlayfairDisplay_600SemiBold', fontSize: 18, color: t.colors.text, marginTop: 8 },
    emptyDesc: { fontFamily: 'Inter_400Regular', fontSize: 14, color: t.colors.textMuted, textAlign: 'center', maxWidth: 280 },
  } as const;
}
