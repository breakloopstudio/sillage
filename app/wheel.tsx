// app/wheel.tsx — Roue chromatique (exploration par couleur)
// Route racine (§5) : l'anneau SVG (react-native-svg) n'est importé ICI que par
// ce fichier — expo-router n'évalue le module qu'au premier mount de la route,
// donc zéro coût au boot. Le SVG est monté après la transition d'ouverture
// (anti drop de frames low-end). Sélection → fetch au commit (le dwell time
// absorbe la latence) → /search?color= lit le même cache mémoire (rendu instantané).

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Image } from 'expo-image';
import Ionicons from '@react-native-vector-icons/ionicons/static';
import ChromaticWheel from '../src/features/wheel/ChromaticWheel';
import Button from '../src/components/Button';
import { useTheme, type Theme } from '../src/theme/ThemeContext';
import { getColorByKey, chromaSwatch, type ChromaticKey } from '../src/utils/chromatic-wheel';
import { getParfumsByColor } from '../src/services/catalog';
import { hapticsLight } from '../src/services/haptics';
import { useNetwork } from '../src/hooks/useNetwork';
import { formatNumber } from '../src/utils/format-price';
import type { Parfum } from '../src/models';

export default function WheelScreen() {
  const { theme, resolvedMode } = useTheme();
  const s = useMemo(() => getStyles(theme), [theme]);
  const { t } = useTranslation('common');
  const router = useRouter();
  const { isOnline } = useNetwork();

  // Anneau monté après la transition slide_from_bottom (display list SVG lourde
  // construite hors animation — pattern vérifié audit perf).
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setReady(true), 320);
    return () => clearTimeout(timer);
  }, []);

  // committedKey = dernière teinte POSÉE (fetch + CTA + flacons) ;
  // liveKey = ancre traversée pendant le geste (affichage transitoire).
  // La distinction évite la désynchronisation preview/résultats quand un geste
  // se termine sans commit (relâché dans le disque central).
  const [committedKey, setCommittedKey] = useState<ChromaticKey | null>(null);
  const [liveKey, setLiveKey] = useState<ChromaticKey | null>(null);
  const [results, setResults] = useState<Parfum[]>([]);
  const [loading, setLoading] = useState(false);
  const requestIdRef = useRef(0);
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const fetchColor = useCallback((key: ChromaticKey) => {
    const reqId = ++requestIdRef.current;
    setLoading(true);
    getParfumsByColor(key, 50)
      .then((list) => {
        if (!mountedRef.current || reqId !== requestIdRef.current) return;
        setResults(list);
        setLoading(false);
        const urls = list.slice(0, 12).map(p => p.imageUrl).filter((u): u is string => !!u);
        if (urls.length > 0) Image.prefetch(urls, 'memory-disk').catch(() => {});
      })
      .catch(() => {
        if (!mountedRef.current || reqId !== requestIdRef.current) return;
        setResults([]);
        setLoading(false);
      });
  }, []);

  // Franchissement d'ancre pendant le geste : affichage live, pas de fetch.
  const handleAnchorChange = useCallback((key: ChromaticKey) => {
    setLiveKey(key);
  }, []);

  // Commit (fin de geste / tap) : haptique sélection + fetch de la teinte posée.
  const handleCommit = useCallback((key: ChromaticKey) => {
    hapticsLight();
    setLiveKey(null);
    setCommittedKey(key);
    fetchColor(key);
  }, [fetchColor]);

  // Geste relâché hors anneau/pastille : la preview revient à la teinte posée.
  const handleGestureCancel = useCallback(() => {
    setLiveKey(null);
  }, []);

  const handleSeeResults = useCallback(() => {
    if (!committedKey || results.length === 0) return;
    router.push(`/search?color=${committedKey}`);
  }, [committedKey, results.length, router]);

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  const previewKey = liveKey ?? committedKey;
  const previewDef = getColorByKey(previewKey ?? undefined);
  const swatch = previewKey ? chromaSwatch(previewKey, resolvedMode) : null;
  const showResults = committedKey !== null && liveKey === null;
  const previewBottles = useMemo(() => results.slice(0, 3), [results]);

  return (
    <SafeAreaView edges={['top', 'bottom']} style={s.container}>
      <View style={s.header}>
        <Pressable onPress={handleBack} hitSlop={8} style={s.backBtn} accessibilityLabel={t('chroma.backA11y')}>
          <Ionicons name="chevron-down" size={22} color={theme.colors.text} />
        </Pressable>
        <Text style={s.title}>{t('chroma.title')}</Text>
        <View style={s.backBtn} />
      </View>

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

      <View style={s.preview}>
        {previewDef && swatch ? (
          <>
            <View style={s.previewHeader}>
              <View
                style={[
                  s.previewSwatch,
                  { backgroundColor: swatch.swatch, borderColor: theme.colors.border },
                ]}
              />
              <View style={s.previewTexts}>
                <Text style={s.previewLabel}>{previewDef.label}</Text>
                <Text style={s.previewTagline} numberOfLines={1}>{previewDef.tagline}</Text>
              </View>
              {showResults && loading && <ActivityIndicator color={theme.colors.primary} />}
            </View>

            {showResults && !loading && results.length > 0 && (
              <View style={s.bottleRow}>
                {previewBottles.map(p => (
                  <View key={p.id} style={s.bottleWrap}>
                    <Image
                      source={{ uri: p.imageUrl }}
                      style={s.bottle}
                      contentFit="contain"
                      transition={200}
                    />
                  </View>
                ))}
                <Text style={s.bottleMore}>
                  {t('catalog.parfumCount', { count: results.length, formatted: formatNumber(results.length) })}
                </Text>
              </View>
            )}

            {showResults && !loading && results.length === 0 && (
              <Text style={s.previewStatus} maxFontSizeMultiplier={1.3}>
                {isOnline ? t('chroma.noResults') : t('chroma.offline')}
              </Text>
            )}

            {showResults && results.length > 0 && (
              <Button
                variant="primary"
                onPress={handleSeeResults}
                disabled={loading}
                icon="arrow-forward-outline"
              >
                {t('chroma.seeResults', { count: results.length, formatted: formatNumber(results.length) })}
              </Button>
            )}
          </>
        ) : (
          <Text style={s.prompt} maxFontSizeMultiplier={1.3}>{t('chroma.prompt')}</Text>
        )}
      </View>
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
    preview: {
      flex: 1,
      paddingHorizontal: 24,
      paddingTop: 20,
      gap: 16,
    },
    prompt: {
      fontFamily: 'Inter_400Regular',
      fontSize: 14,
      color: t.colors.textMuted,
      textAlign: 'center',
      lineHeight: 21,
    },
    previewHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    previewSwatch: {
      width: 34,
      height: 34,
      borderRadius: 17,
      borderWidth: StyleSheet.hairlineWidth,
    },
    previewTexts: { flex: 1 },
    previewLabel: {
      fontFamily: 'PlayfairDisplay_600SemiBold',
      fontSize: 18,
      color: t.colors.text,
    },
    previewTagline: {
      fontFamily: 'Inter_400Regular',
      fontSize: 12,
      color: t.colors.textMuted,
      marginTop: 1,
    },
    previewStatus: {
      fontFamily: 'Inter_400Regular',
      fontSize: 13,
      color: t.colors.textMuted,
      lineHeight: 20,
    },
    bottleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    bottleWrap: {
      width: 56,
      height: 72,
      borderRadius: t.radius.sm,
      backgroundColor: t.colors.surface2,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border,
      overflow: 'hidden',
    },
    bottle: { width: '100%', height: '100%' },
    bottleMore: {
      flex: 1,
      fontFamily: 'Inter_500Medium',
      fontSize: 12,
      color: t.colors.textMuted,
      fontVariant: ['tabular-nums'] as import('react-native').FontVariant[],
    },
  } as const;
}
