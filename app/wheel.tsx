// app/wheel.tsx — Roue chromatique (exploration par couleur)
// Route racine (§5) : le disque SVG (react-native-svg) n'est importé ICI que par
// ce fichier — expo-router n'évalue le module qu'au premier mount de la route,
// donc zéro coût au boot. Le SVG est monté après la transition d'ouverture
// (anti drop de frames low-end).
// ONE-TAP : un commit sur la roue (tap teinte/pastille ou fin de drag) affiche
// les 50 parfums de la teinte SOUS la roue (grille virtualisée, même écran) ;
// l'action « Tout voir » pousse /search?color=<key> (cache partagé déjà chaud →
// rendu instantané). Tap carte → fiche détail (navigation interne de ParfumCard).

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { View, Text, Pressable, ActivityIndicator, FlatList, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Image } from 'expo-image';
import Ionicons from '@react-native-vector-icons/ionicons/static';
import ChromaticWheel from '../src/features/wheel/ChromaticWheel';
import ParfumCard from '../src/components/ParfumCard';
import { useTheme, type Theme } from '../src/theme/ThemeContext';
import { getColorByKey, type ChromaticKey } from '../src/utils/chromatic-wheel';
import { getParfumsByColor } from '../src/services/catalog';
import { hapticsLight } from '../src/services/haptics';
import { useNetwork } from '../src/hooks/useNetwork';
import { formatNumber } from '../src/utils/format-price';
import type { Parfum } from '../src/models';

export default function WheelScreen() {
  const { theme } = useTheme();
  const s = useMemo(() => getStyles(theme), [theme]);
  const { t } = useTranslation('common');
  const router = useRouter();
  const { isOnline } = useNetwork();

  // Disque monté après la transition slide_from_bottom (display list SVG
  // construite hors animation — pattern vérifié audit perf).
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setReady(true), 320);
    return () => clearTimeout(timer);
  }, []);

  // liveKey = teinte traversée pendant le geste (label sous la roue) ;
  // committedKey = teinte posée (résultats affichés sous la roue).
  const [committedKey, setCommittedKey] = useState<ChromaticKey | null>(null);
  const [liveKey, setLiveKey] = useState<ChromaticKey | null>(null);
  const [results, setResults] = useState<Parfum[]>([]);
  const [loading, setLoading] = useState(false);
  const requestIdRef = useRef(0);

  const fetchColor = useCallback((key: ChromaticKey) => {
    const reqId = ++requestIdRef.current;
    setLoading(true);
    getParfumsByColor(key, 50)
      .then((list) => {
        if (reqId !== requestIdRef.current) return;
        setResults(list);
        setLoading(false);
        const urls = list.slice(0, 12).map(p => p.imageUrl).filter((u): u is string => !!u);
        if (urls.length > 0) Image.prefetch(urls, 'memory-disk').catch(() => {});
      })
      .catch(() => {
        if (reqId !== requestIdRef.current) return;
        setResults([]);
        setLoading(false);
      });
  }, []);

  const handleAnchorChange = useCallback((key: ChromaticKey) => {
    setLiveKey(key);
  }, []);

  // One-tap : haptique sélection + fetch + résultats sous la roue (pas de nav).
  const handleCommit = useCallback((key: ChromaticKey) => {
    hapticsLight();
    setLiveKey(null);
    setCommittedKey(key);
    fetchColor(key);
  }, [fetchColor]);

  const handleGestureCancel = useCallback(() => {
    setLiveKey(null);
  }, []);

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  const handleSeeAll = useCallback(() => {
    if (!committedKey) return;
    router.push(`/search?color=${committedKey}`);
  }, [committedKey, router]);

  const renderCard = useCallback(({ item }: { item: Parfum }) => (
    <View style={s.cardWrap}>
      <ParfumCard parfum={item} mode="comfortable" />
    </View>
  ), [s]);

  const committedDef = getColorByKey(committedKey ?? undefined);
  const liveDef = getColorByKey(liveKey ?? undefined);

  const listHeader = useMemo(() => (
    <View>
      {ready ? (
        <ChromaticWheel
          selectedKey={committedKey}
          onAnchorChange={handleAnchorChange}
          onCommit={handleCommit}
          onGestureCancel={handleGestureCancel}
        />
      ) : (
        <View style={s.wheelPlaceholder}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      )}

      {/* Slot à hauteur réservée (zéro layout shift) : prompt au repos,
          label live pendant le geste. */}
      <View style={s.liveSlot}>
        {liveDef ? (
          <>
            <Text style={s.liveLabel}>{liveDef.label}</Text>
            <Text style={s.liveTagline} numberOfLines={1}>{liveDef.tagline}</Text>
          </>
        ) : (
          <Text style={s.prompt} maxFontSizeMultiplier={1.3}>{t('chroma.prompt')}</Text>
        )}
      </View>

      {committedDef && !liveDef && (
        <View style={s.resultsHeader}>
          <View style={{ flex: 1 }}>
            <Text style={s.resultsTitle}>{committedDef.label}</Text>
            <Text style={s.resultsMeta}>
              {loading
                ? t('chroma.loading')
                : t('catalog.parfumCount', { count: results.length, formatted: formatNumber(results.length) })}
            </Text>
          </View>
          {results.length > 0 && (
            <Pressable onPress={handleSeeAll} hitSlop={8} style={s.seeAllBtn} accessibilityRole="link" accessibilityLabel={t('chroma.seeAllA11y')}>
              <Text style={s.seeAllText}>{t('chroma.seeAll')}</Text>
              <Ionicons name="arrow-forward" size={14} color={theme.colors.primary} />
            </Pressable>
          )}
        </View>
      )}
    </View>
  ), [ready, committedKey, committedDef, liveDef, loading, results.length, theme, s, t, handleAnchorChange, handleCommit, handleGestureCancel, handleSeeAll]);

  const listEmpty = useMemo(() => {
    if (loading || !committedKey || liveKey) return null;
    return (
      <Text style={s.emptyText} maxFontSizeMultiplier={1.3}>
        {isOnline ? t('chroma.noResults') : t('chroma.offline')}
      </Text>
    );
  }, [loading, committedKey, liveKey, isOnline, t, s]);

  return (
    <SafeAreaView edges={['top', 'bottom']} style={s.container}>
      <View style={s.header}>
        <Pressable onPress={handleBack} hitSlop={8} style={s.backBtn} accessibilityLabel={t('chroma.backA11y')}>
          <Ionicons name="chevron-down" size={22} color={theme.colors.text} />
        </Pressable>
        <Text style={s.title}>{t('chroma.title')}</Text>
        <View style={s.backBtn} />
      </View>

      <FlatList
        data={results}
        numColumns={2}
        keyExtractor={(p) => p.id}
        renderItem={renderCard}
        columnWrapperStyle={results.length > 0 ? s.resultRow : undefined}
        contentContainerStyle={s.listContent}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={listEmpty}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        windowSize={5}
        initialNumToRender={6}
        maxToRenderPerBatch={8}
      />
    </SafeAreaView>
  );
}

function getStyles(t: Theme) {
  return {
    container: { flex: 1, backgroundColor: t.colors.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    backBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      justifyContent: 'center',
      alignItems: 'center',
    },
    title: {
      fontFamily: 'PlayfairDisplay_700Bold',
      fontSize: 22,
      color: t.colors.text,
    },
    wheelPlaceholder: {
      width: 300,
      height: 300,
      alignSelf: 'center',
      justifyContent: 'center',
      alignItems: 'center',
    },
    liveSlot: {
      minHeight: 52,
      paddingHorizontal: 32,
      paddingTop: 20,
      alignItems: 'center',
      justifyContent: 'flex-start',
    },
    prompt: {
      fontFamily: 'Inter_400Regular',
      fontSize: 14,
      color: t.colors.textMuted,
      textAlign: 'center',
      lineHeight: 21,
    },
    liveLabel: {
      fontFamily: 'PlayfairDisplay_600SemiBold',
      fontSize: 18,
      color: t.colors.text,
    },
    liveTagline: {
      fontFamily: 'Inter_400Regular',
      fontSize: 12,
      color: t.colors.textMuted,
      marginTop: 1,
    },
    resultsHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 4,
      gap: 12,
    },
    resultsTitle: {
      fontFamily: 'PlayfairDisplay_600SemiBold',
      fontSize: 18,
      color: t.colors.text,
    },
    resultsMeta: {
      fontFamily: 'Inter_400Regular',
      fontSize: 12,
      color: t.colors.textMuted,
      marginTop: 1,
      fontVariant: ['tabular-nums'] as import('react-native').FontVariant[],
    },
    seeAllBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingVertical: 8,
      paddingHorizontal: 4,
    },
    seeAllText: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 13,
      color: t.colors.primary,
    },
    emptyText: {
      fontFamily: 'Inter_400Regular',
      fontSize: 13,
      color: t.colors.textMuted,
      textAlign: 'center',
      lineHeight: 20,
      paddingHorizontal: 32,
      paddingTop: 12,
    },
    listContent: { paddingBottom: 24 },
    resultRow: { gap: 8, marginBottom: 8, paddingHorizontal: 16 },
    cardWrap: { flex: 1, maxWidth: '50%' },
  } as const;
}
