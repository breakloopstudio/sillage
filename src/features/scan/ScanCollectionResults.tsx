// src/features/scan/ScanCollectionResults.tsx — Inventaire multi-flacons :
// liste multi-select (vérifiés cochés par défaut) + ajout en lot statut « have ».

import { useMemo, useState, useCallback, useEffect } from 'react';
import { View, Text, FlatList, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown, useReducedMotion } from 'react-native-reanimated';
import Ionicons from '@react-native-vector-icons/ionicons/static';
import { useTranslation } from 'react-i18next';
import { useTheme, type Theme } from '../../theme/ThemeContext';
import { useAuthContext } from '../../contexts/AuthContext';
import { useUserParfum } from '../../hooks/useUserParfum';
import { hapticsLight, hapticsSuccess, hapticsError } from '../../services/haptics';
import { textOn } from '../../utils/contrast';
import { scanChip } from '../../utils/scan-display';
import { defaultSelectedIds, ownedIdSet } from '../../utils/collection-scan';
import type { CollectionMatch } from '../../models';

type Phase = 'select' | 'adding' | 'done' | 'error';

interface Props {
  matches: CollectionMatch[];
  estimatedCount: number;
  onRescan: () => void;
  onReset: () => void;
}

export function ScanCollectionResults({ matches, estimatedCount, onRescan, onReset }: Props) {
  const { theme } = useTheme();
  const s = useMemo(() => getStyles(theme), [theme]);
  const { t } = useTranslation('common');
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();

  const { user, isAuthenticated } = useAuthContext();
  const { items, add } = useUserParfum(user?.uid ?? null);
  const ownedIds = useMemo(() => ownedIdSet(items), [items]);

  // Vérifiés (texte lu, confiance haute) cochés par défaut ; les « Correspondance
  // probable » restent à valider. Les flacons déjà en collection sont exclus.
  const [selected, setSelected] = useState<Set<string>>(() => defaultSelectedIds(matches, ownedIds));
  const [phase, setPhase] = useState<Phase>('select');
  const [addedCount, setAddedCount] = useState(0);

  // La collection vit en temps réel : un flacon ajouté ailleurs sort de la sélection.
  useEffect(() => {
    setSelected((prev) => {
      let changed = false;
      const next = new Set<string>();
      for (const id of prev) {
        if (ownedIds.has(id)) { changed = true; continue; }
        next.add(id);
      }
      return changed ? next : prev;
    });
  }, [ownedIds]);

  const handleToggle = useCallback((id: string) => {
    if (ownedIds.has(id) || phase !== 'select') return;
    hapticsLight();
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, [ownedIds, phase]);

  const handleConfirm = useCallback(async () => {
    // 'error' est relançable (le CTA invite à réessayer) ; seuls 'adding' et 'done' bloquent.
    if (phase === 'adding' || phase === 'done') return;
    if (!isAuthenticated) { router.push('/auth/login'); return; }
    const toAdd = matches.filter((m) => selected.has(m.parfum.id));
    if (toAdd.length === 0) return;
    setPhase('adding');
    try {
      const results = await Promise.allSettled(toAdd.map((m) => add(m.parfum.id, 'have', m.parfum)));
      const ok = results.filter((r) => r.status === 'fulfilled').length;
      if (ok > 0) {
        hapticsSuccess();
        setAddedCount(ok);
        setPhase('done');
      } else {
        hapticsError();
        setPhase('error');
      }
    } catch {
      hapticsError();
      setPhase('error');
    }
  }, [phase, isAuthenticated, matches, selected, add, router]);

  const handleSeeCollection = useCallback(() => {
    router.push('/(tabs)/collection');
  }, [router]);

  const selectedCount = selected.size;
  const identified = matches.length;
  const coverage = estimatedCount > identified
    ? t('scan.collectionCoverage', { count: identified, estimated: estimatedCount })
    : t('scan.collectionIdentified', { count: identified });

  // ── Écran de confirmation (pattern InspireShelfSheet) ──
  if (phase === 'done') {
    return (
      <View style={[s.container, { paddingTop: insets.top + 16 }]}>
        <Animated.View style={s.doneWrap} entering={reduced ? undefined : FadeIn.duration(300)}>
          <View style={[s.doneCircle, { backgroundColor: theme.colors.dealSoft }]}>
            <Ionicons name="checkmark" size={36} color={theme.colors.deal} />
          </View>
          <Text style={s.doneTitle}>{t('scan.collectionDoneTitle')}</Text>
          <Text style={s.doneSubtitle}>{t('scan.collectionDone', { count: addedCount })}</Text>
          <Pressable onPress={handleSeeCollection} style={s.cta} accessibilityRole="button">
            <Ionicons name="flask-outline" size={20} color={textOn(theme.colors.primary)} style={{ marginRight: 8 }} />
            <Text style={s.ctaText}>{t('scan.collectionSeeWardrobe')}</Text>
          </Pressable>
          <Pressable onPress={onRescan} style={s.doneGhost} hitSlop={8} accessibilityRole="button">
            <Text style={s.doneGhostText}>{t('scan.collectionRescan')}</Text>
          </Pressable>
        </Animated.View>
      </View>
    );
  }

  const renderRow = useCallback(({ item, index }: { item: CollectionMatch; index: number }) => {
    const owned = ownedIds.has(item.parfum.id);
    const checked = !owned && selected.has(item.parfum.id);
    const chip = scanChip(item.confidence, { textRead: item.textRead, visualMatch: item.visualMatch });
    const chipColor = chip.tone === 'fair' ? theme.colors.fairInk : theme.colors.dealInk;
    return (
      <Animated.View entering={reduced ? undefined : FadeInDown.delay(index * 45).duration(240)}>
        <Pressable
          onPress={() => handleToggle(item.parfum.id)}
          style={[s.row, owned && s.rowDim]}
          accessibilityRole="checkbox"
          accessibilityState={{ checked, disabled: owned }}
          accessibilityLabel={`${item.parfum.marque} ${item.parfum.nom}`}
        >
          <Ionicons
            name={checked ? 'checkmark-circle' : 'ellipse-outline'}
            size={24}
            color={checked ? theme.colors.primary : theme.colors.textMuted}
            style={s.checkbox}
          />
          {item.parfum.imageUrl ? (
            <Image source={{ uri: item.parfum.imageUrl }} style={s.rowImg} contentFit="contain" transition={200} />
          ) : (
            <View style={[s.rowImg, s.rowImgEmpty]}>
              <Ionicons name="flask-outline" size={18} color={theme.colors.textMuted} />
            </View>
          )}
          <View style={s.rowBody}>
            <Text style={s.rowMarque} numberOfLines={1}>{item.parfum.marque}</Text>
            <Text style={s.rowNom} numberOfLines={1}>{item.parfum.nom}</Text>
            {owned ? (
              <View style={s.ownedChip}>
                <Ionicons name="checkmark-done-outline" size={12} color={theme.colors.textMuted} style={{ marginRight: 4 }} />
                <Text style={s.ownedChipText} allowFontScaling={false}>{t('scan.collectionAlreadyOwned')}</Text>
              </View>
            ) : (
              <View style={[s.chip, { backgroundColor: chip.tone === 'fair' ? theme.colors.fairSoft : theme.colors.dealSoft }]}>
                <Ionicons name={chip.icon as never} size={12} color={chipColor} style={{ marginRight: 4 }} />
                <Text style={[s.chipText, { color: chipColor }]} allowFontScaling={false}>{chip.label}</Text>
              </View>
            )}
          </View>
        </Pressable>
      </Animated.View>
    );
  }, [ownedIds, selected, theme, s, t, reduced, handleToggle]);

  return (
    <View style={[s.container, { paddingTop: insets.top + 16 }]}>
      <View style={s.header}>
        <Pressable onPress={onReset} style={s.closeBtn} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('scan.closeScanA11y')}>
          <Ionicons name="close" size={20} color={theme.colors.textMuted} />
        </Pressable>
        <View style={s.headerText}>
          <Text style={s.title}>{t('scan.collectionTitle')}</Text>
          <Text style={s.coverage}>{coverage}</Text>
        </View>
        <View style={s.closeBtn} />
      </View>

      <FlatList<CollectionMatch>
        data={matches}
        keyExtractor={(m) => m.parfum.id}
        renderItem={renderRow}
        extraData={[selected, ownedIds, theme]}
        style={s.listWrap}
        contentContainerStyle={s.list}
        showsVerticalScrollIndicator={false}
        ListFooterComponent={
          <Pressable onPress={onRescan} style={s.rescanRow} hitSlop={8} accessibilityRole="button">
            <Ionicons name="camera-outline" size={15} color={theme.colors.textMuted} style={{ marginRight: 6 }} />
            <Text style={s.rescanText}>{t('scan.notItRetake')}</Text>
          </Pressable>
        }
      />

      <View style={[s.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
        {phase === 'error' && <Text style={s.errorText}>{t('scan.collectionErrorAdd')}</Text>}
        <Pressable
          onPress={handleConfirm}
          style={[s.cta, (selectedCount === 0 || phase === 'adding') && { opacity: 0.5 }]}
          disabled={selectedCount === 0 || phase === 'adding'}
          accessibilityRole="button"
          accessibilityLabel={t('scan.collectionAddCta', { count: selectedCount })}
        >
          {phase === 'adding' ? (
            <ActivityIndicator color={textOn(theme.colors.primary)} />
          ) : (
            <>
              <Ionicons name="add-circle-outline" size={20} color={textOn(theme.colors.primary)} style={{ marginRight: 8 }} />
              <Text style={s.ctaText}>{t('scan.collectionAddCta', { count: selectedCount })}</Text>
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}

function getStyles(t: Theme) {
  return {
    container: { flex: 1, backgroundColor: t.colors.background },
    // flex: 1 : la liste est l'enfant flexible entre header et barre d'action ;
    // sans lui le FlatList déborde et le CTA sort de l'écran dès ~4 flacons.
    listWrap: { flex: 1 },
    list: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 },

    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 8, gap: 8 },
    headerText: { flex: 1 },
    title: { fontFamily: 'PlayfairDisplay_600SemiBold', fontSize: 22, color: t.colors.text },
    coverage: { fontFamily: 'Inter_400Regular', fontSize: 13, color: t.colors.textMuted, marginTop: 2 },
    closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: t.colors.surface2, borderWidth: StyleSheet.hairlineWidth, borderColor: t.colors.border, justifyContent: 'center', alignItems: 'center' },

    row: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: t.colors.surface,
      borderRadius: t.radius.card,
      padding: 12,
      marginBottom: 8,
      gap: 12,
      minHeight: 76,
      ...t.cardShadow,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border,
    },
    rowDim: { opacity: 0.6 },
    checkbox: { width: 24 },
    rowImg: { width: 44, height: 58, borderRadius: t.radius.sm, backgroundColor: t.colors.surface2 },
    rowImgEmpty: { justifyContent: 'center', alignItems: 'center' },
    rowBody: { flex: 1, gap: 2 },
    rowMarque: { fontFamily: 'Inter_400Regular', fontSize: 10, letterSpacing: 1.2, textTransform: 'uppercase', color: t.colors.textMuted },
    rowNom: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: t.colors.text },
    chip: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, marginTop: 4 },
    chipText: { fontFamily: 'Inter_500Medium', fontSize: 11 },
    ownedChip: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, marginTop: 4, backgroundColor: t.colors.surface2 },
    ownedChipText: { fontFamily: 'Inter_500Medium', fontSize: 11, color: t.colors.textMuted },

    rescanRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 12 },
    rescanText: { fontFamily: 'Inter_500Medium', fontSize: 13, color: t.colors.textMuted },

    bottomBar: { paddingHorizontal: 16, paddingTop: 8, backgroundColor: t.colors.background, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.colors.border },
    cta: {
      flexDirection: 'row',
      backgroundColor: t.colors.primary,
      borderRadius: t.radius.base,
      height: 52,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 24,
      ...t.shadow.button,
    },
    ctaText: { color: textOn(t.colors.primary), fontFamily: 'Inter_600SemiBold', fontSize: 16 },
    errorText: { fontFamily: 'Inter_500Medium', fontSize: 13, color: t.colors.overpriced, textAlign: 'center', marginBottom: 8 },

    doneWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
    doneCircle: { width: 84, height: 84, borderRadius: 42, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
    doneTitle: { fontFamily: 'PlayfairDisplay_700Bold', fontSize: 24, color: t.colors.text, marginBottom: 8, textAlign: 'center' },
    doneSubtitle: { fontFamily: 'Inter_400Regular', fontSize: 14, color: t.colors.textMuted, textAlign: 'center', lineHeight: 21, marginBottom: 28 },
    doneGhost: { marginTop: 16, paddingVertical: 8, paddingHorizontal: 12 },
    doneGhostText: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: t.colors.primary },
  } as const;
}
