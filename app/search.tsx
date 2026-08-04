// app/search.tsx — Overlay recherche plein écran
// Ouvert depuis la barre de recherche persistante (index.tsx) ou les chips famille (CatalogPage)
// Mêmes contrôles de densité que la grille catalogue

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { View, Text, TextInput, FlatList, ScrollView, Pressable, ActivityIndicator, StyleSheet, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from 'react-i18next';
import Ionicons from '@react-native-vector-icons/ionicons/static';
import { useCatalog } from '../src/hooks/useCatalog';
import { useVoiceSearch, type VoiceState, type VoiceResult, type VoiceErrorCode } from '../src/hooks/useVoiceSearch';
import { usePermissionPrimer } from '../src/hooks/usePermissionPrimer';
import { PERMISSION_PRIMERS } from '../src/utils/permission-primers';
import PermissionPrimer from '../src/components/PermissionPrimer';
import {
  transcribeVoice,
  identifyFromVoice,
  readVoiceAudioBase64,
  mimeFromAudioUri,
  voiceNeedsSecondChance,
  pickBetterVoiceOutcome,
  type VoiceIdentifyOutcome,
} from '../src/services/voice-search';
import {
  setPendingVoiceAutoOpen,
  consumePendingVoiceResults,
  consumePendingCatalogQuery,
  setPendingParfum,
} from '../src/services/catalog-bridge';
import { getParfumsByFamily, getParfumsByColor, getPopularParfums, getPersonalizedSuggestions, getSeasonalParfums, getSuggestionIndex } from '../src/services/catalog';
import { getFamilyByKey } from '../src/utils/olfactory-families';
import { getColorByKey, chromaSwatch } from '../src/utils/chromatic-wheel';
import { buildSuggestionIndex, matchSuggestions, type SuggestionIndex, type SuggestionTerm } from '../src/utils/suggest';
import ParfumCard from '../src/components/ParfumCard';
import CatalogRow from '../src/features/catalog/CatalogRow';
import { TOP_BRANDS } from '../src/features/catalog/BrandCapsules';
import { useAuthContext } from '../src/contexts/AuthContext';
import { currentSeason, SEASON_META } from '../src/utils/season';
import { hapticsLight, hapticsError, hapticsSuccess } from '../src/services/haptics';
import { useTheme, type Theme } from '../src/theme/ThemeContext';
import { useDensityPreference, GRID_MODES } from '../src/hooks/useDensityPreference';
import { useNetwork } from '../src/hooks/useNetwork';
import { textOn } from '../src/utils/contrast';
import { formatNumber } from '../src/utils/format-price';
import type { Parfum } from '../src/models';

const RECENT_KEY = '@sillage/recent-searches';

// Persiste les recherches recentes entre les navigations et sessions
const recentStore = { items: [] as string[] };

async function loadRecentFromStorage(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(RECENT_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.slice(0, 5);
    }
  } catch { /* ignore */ }
  return [];
}

async function saveRecentToStorage(items: string[]): Promise<void> {
  try {
    await AsyncStorage.setItem(RECENT_KEY, JSON.stringify(items.slice(0, 5)));
  } catch { /* ignore */ }
}

const discoverStore = {
  loaded: false,
  kind: 'trending' as 'foryou' | 'trending',
  trends: [] as Parfum[],
  seasonal: [] as Parfum[],
};

function seededShuffle<T>(arr: T[], seed: number): T[] {
  const shuffled = [...arr];
  let s = seed;
  for (let i = shuffled.length - 1; i > 0; i--) {
    s = (s * 16807 + 0) % 2147483647;
    const j = s % (i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

const suggestStore = {
  loaded: false,
  index: { brands: [], names: [] } as SuggestionIndex,
};

export default function SearchScreen() {
  const { theme, resolvedMode } = useTheme();
  const s = useMemo(() => getStyles(theme), [theme]);
  const { t } = useTranslation('common');
  const keyboardAppearance = resolvedMode === 'dark' ? 'dark' : 'light';
  const router = useRouter();
  const { q: rawQ, family: rawFamily, color: rawColor } = useLocalSearchParams<{ q?: string; family?: string; color?: string }>();
  const routeQuery = Array.isArray(rawQ) ? rawQ[0] : rawQ;
  const familyKey = Array.isArray(rawFamily) ? rawFamily[0] : rawFamily;
  const colorKey = Array.isArray(rawColor) ? rawColor[0] : rawColor;
  const familyDef = useMemo(() => getFamilyByKey(familyKey), [familyKey]);
  // Modes facette mutuellement exclusifs : la famille prime si les deux params
  // sont présents (URL craftée), sinon deux bannières se superposeraient.
  const colorDef = useMemo(() => (familyDef ? undefined : getColorByKey(colorKey)), [familyDef, colorKey]);
  const [initialQuery] = useState(() => routeQuery ?? consumePendingCatalogQuery());

  const inputRef = useRef<TextInput>(null);
  const [searchText, setSearchText] = useState(() => familyDef?.label ?? colorDef?.label ?? initialQuery ?? '');
  const recentLoadedRef = useRef(false);
  const { parfums, searching, error, search, clear, inject } = useCatalog();
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [voiceErrorCode, setVoiceErrorCode] = useState<VoiceErrorCode | null>(null);
  const [voiceSearching, setVoiceSearching] = useState(false);
  const voiceRequestIdRef = useRef(0);
  const [familyResults, setFamilyResults] = useState<Parfum[] | null>(familyDef ? [] : null);
  const [familyLoading, setFamilyLoading] = useState(!!familyDef);
  const [colorResults, setColorResults] = useState<Parfum[] | null>(colorDef ? [] : null);
  const [colorLoading, setColorLoading] = useState(!!colorDef);
  // Quitte les modes facette (famille / couleur) — appelé dès que l'utilisateur
  // tape, efface, ou relance un pipeline voix.
  const clearFacetResults = useCallback(() => {
    setFamilyResults(null);
    setColorResults(null);
  }, []);
  const { density: searchDensity, setDensity: setSearchDensity } = useDensityPreference();
  const { isOnline } = useNetwork();
  const [recentSearches, setRecentSearches] = useState<string[]>(recentStore.items);
  const { user, authReady, isAuthenticated } = useAuthContext();
  const season = useMemo(() => currentSeason(), []);
  const [discover, setDiscover] = useState<{ trends: Parfum[]; seasonal: Parfum[] } | null>(
    discoverStore.loaded ? { trends: discoverStore.trends, seasonal: discoverStore.seasonal } : null,
  );
  const [discoverKind, setDiscoverKind] = useState<'foryou' | 'trending'>(discoverStore.kind);
  const [suggestIndex, setSuggestIndex] = useState<SuggestionIndex>(suggestStore.index);

  const persistRecent = useCallback((term: string) => {
    const trimmed = term.trim();
    if (!trimmed || trimmed.length < 2) return;
    recentLoadedRef.current = true;
    recentStore.items = [trimmed, ...recentStore.items.filter(x => x.toLowerCase() !== trimmed.toLowerCase())].slice(0, 5);
    setRecentSearches(recentStore.items);
    saveRecentToStorage(recentStore.items);
  }, []);

  // Auto-ouverture vocale : match confiant → fiche directe (+ bannière « Ce n'est pas lui ? »).
  const openVoiceAutoOpen = useCallback((outcome: VoiceIdentifyOutcome) => {
    const top = outcome.autoOpen;
    if (!top) return;
    setPendingParfum(top);
    setPendingVoiceAutoOpen({ parfumId: top.id, query: outcome.query, results: outcome.results });
    // Recherche récente = le parfum trouvé, pas le transcript potentiellement
    // écorché (« dire à Casa ») récupéré phonétiquement.
    const recent = [top.marque, top.nom].filter(Boolean).join(' ');
    persistRecent(recent || outcome.query);
    hapticsSuccess();
    router.push(`/catalog/${top.id}`);
  }, [persistRecent, router]);

  const handleVoiceResult = useCallback(async (result: VoiceResult) => {
    const transcript = result.text?.trim() ?? '';
    const requestId = ++voiceRequestIdRef.current;
    setVoiceSearching(true);
    try {
      if (transcript) {
        setVoiceError(null);
        const outcome = await identifyFromVoice(transcript, { isAuthenticated, alternatives: result.alternatives });
        if (requestId !== voiceRequestIdRef.current) return;

        // Seconde chance gatée sur la QUALITÉ du match (pas le nombre de
        // résultats) : un transcript écorché renvoie presque toujours « quelque
        // chose » en trgm — c'est la confiance qui décide de re-transcrire.
        let best = outcome;
        if (voiceNeedsSecondChance(outcome) && result.audioUri && isAuthenticated) {
          const base64 = await readVoiceAudioBase64(result.audioUri);
          if (requestId !== voiceRequestIdRef.current) return;
          if (base64) {
            try {
              const whisperText = (await transcribeVoice(base64, mimeFromAudioUri(result.audioUri))).trim();
              if (requestId !== voiceRequestIdRef.current) return;
              if (whisperText && whisperText.toLowerCase() !== transcript.toLowerCase()) {
                const retry = await identifyFromVoice(whisperText, { isAuthenticated });
                if (requestId !== voiceRequestIdRef.current) return;
                best = pickBetterVoiceOutcome(outcome, retry);
              }
            } catch (e: unknown) {
              // Échec de la re-transcription → repli sur le premier passage.
              if (__DEV__) console.warn('[voice] second chance failed:', (e as Error)?.message ?? String(e));
            }
          }
        }

        if (best.results.length > 0) {
          if (best.autoOpen) { openVoiceAutoOpen(best); return; }
          setSearchText(best.query);
          clearFacetResults();
          inject(best.results);
          return;
        }

        setSearchText(best.query);
        clearFacetResults();
        inject([]);
      } else if (result.audioBase64) {
        // Pas de transcript on-device → Whisper d'abord (voie historique).
        const whisperText = (await transcribeVoice(result.audioBase64, mimeFromAudioUri(result.audioUri ?? ''))).trim();
        if (requestId !== voiceRequestIdRef.current) return;
        if (whisperText) {
          const outcome = await identifyFromVoice(whisperText, { isAuthenticated });
          if (requestId !== voiceRequestIdRef.current) return;
          if (outcome.autoOpen) { openVoiceAutoOpen(outcome); return; }
          setSearchText(outcome.query);
          clearFacetResults();
          inject(outcome.results);
        }
      }
    } catch (err: unknown) {
      if (requestId !== voiceRequestIdRef.current) return;
      setVoiceError((err as Error)?.message || t('search.voiceError'));
    } finally {
      // Reset inconditionnel : si l'utilisateur tape pendant le pipeline, le
      // requestId change et le reset conditionnel ne tournerait jamais →
      // voiceSearching resterait true à vie (micro désactivé). Aucun nouveau
      // pipeline voix ne peut démarrer tant que voiceSearching est true.
      setVoiceSearching(false);
    }
  }, [isAuthenticated, inject, openVoiceAutoOpen, t, clearFacetResults]);

  const handleVoiceError = useCallback((msg: string, code?: VoiceErrorCode) => {
      setVoiceError(msg || t('search.voiceErrorRecognition'));
    setVoiceErrorCode(code ?? null);
  }, [t]);

  const voiceSearch = useVoiceSearch(handleVoiceResult, handleVoiceError);
  const micPrimer = usePermissionPrimer('mic');

  const voiceState: VoiceState = voiceSearch.state;

  // Retour de la bannière « Ce n'est pas lui ? » (fiche → ici) : restaurer les
  // résultats vocaux dans la grille au focus.
  useFocusEffect(
    useCallback(() => {
      const pending = consumePendingVoiceResults();
      if (pending && pending.results.length > 0) {
        setVoiceError(null);
        clearFacetResults();
        setSearchText(pending.query);
        inject(pending.results);
      }
    }, [inject]),
  );

  useEffect(() => {
    if (voiceState === 'listening') {
      setSearchText(voiceSearch.transcript);
    }
  }, [voiceSearch.transcript, voiceState]);

  useEffect(() => {
    if (familyDef || colorDef) return;
    const timer = setTimeout(() => inputRef.current?.focus(), 250);
    return () => clearTimeout(timer);
  }, [familyDef, colorDef]);

  useEffect(() => {
    if (!familyDef) return;
    let cancelled = false;
    setFamilyLoading(true);
    getParfumsByFamily(familyDef.values, 50)
      .then(list => { if (!cancelled) setFamilyResults(list); })
      .catch(() => { if (!cancelled) setFamilyResults([]); })
      .finally(() => { if (!cancelled) setFamilyLoading(false); });
    return () => { cancelled = true; };
  }, [familyDef]);

  // Mode couleur : lit le cache mémoire partagé (le fetch posé dans /wheel
  // préchauffe cette entrée → rendu instantané, jamais de second fetch).
  useEffect(() => {
    if (!colorDef) return;
    let cancelled = false;
    setColorLoading(true);
    getParfumsByColor(colorDef.key, 50)
      .then(list => { if (!cancelled) setColorResults(list); })
      .catch(() => { if (!cancelled) setColorResults([]); })
      .finally(() => { if (!cancelled) setColorLoading(false); });
    return () => { cancelled = true; };
  }, [colorDef]);

  useEffect(() => {
    loadRecentFromStorage().then(items => {
      if (!recentLoadedRef.current && items.length > 0) {
        recentStore.items = items;
        setRecentSearches(items);
      }
    });
  }, []);

  useEffect(() => {
    if (!authReady || discoverStore.loaded) return;
    let cancelled = false;
    const today = Math.floor(Date.now() / 86400000);
    (async () => {
      const [trendsRes, seasonalRes] = await Promise.allSettled([
        (async () => {
          if (isAuthenticated) {
            const perso = await getPersonalizedSuggestions(user?.uid ?? '', 12);
            if (perso.length > 0) return { items: perso, kind: 'foryou' as const };
          }
          const pop = await getPopularParfums(12);
          return { items: pop, kind: 'trending' as const };
        })(),
        getSeasonalParfums(season, 12),
      ]);
      if (cancelled) return;
      const raw = trendsRes.status === 'fulfilled'
        ? trendsRes.value
        : { items: [] as Parfum[], kind: 'trending' as const };
      const trends = seededShuffle(raw.items, today).slice(0, 8);
      const trendIds = new Set(trends.map(p => p.id));
      const seasonal = (seasonalRes.status === 'fulfilled' ? seasonalRes.value : [])
        .filter(p => !trendIds.has(p.id))
        .slice(0, 8);
      discoverStore.loaded = true;
      discoverStore.kind = raw.kind;
      discoverStore.trends = trends;
      discoverStore.seasonal = seasonal;
      setDiscover({ trends, seasonal });
      setDiscoverKind(raw.kind);
    })();
    return () => { cancelled = true; };
  }, [authReady, isAuthenticated, user?.uid, season]);

  useEffect(() => {
    if (suggestStore.loaded) return;
    let cancelled = false;
    getSuggestionIndex(300).then(rows => {
      if (cancelled) return;
      const index = buildSuggestionIndex(rows);
      suggestStore.loaded = true;
      suggestStore.index = index;
      setSuggestIndex(index);
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (familyDef || colorDef) return;
    if (initialQuery && initialQuery.trim().length >= 2) {
      setSearchText(initialQuery);
      search(initialQuery.trim());
    }
  }, [initialQuery, familyDef, colorDef]);

  const handleTextChange = useCallback((text: string) => {
    voiceRequestIdRef.current++;
    setSearchText(text);
    clearFacetResults();
    setVoiceError(null);
    setVoiceErrorCode(null);
    if (voiceState !== 'idle') voiceSearch.cancel();
    text.trim().length >= 2 ? search(text) : clear();
  }, [search, clear, voiceState, voiceSearch]);

  const handleVoiceToggle = useCallback(() => {
    if (!isOnline) {
      handleVoiceError(t('search.voiceOffline'));
      return;
    }
    if (voiceState === 'listening' || voiceState === 'processing') {
      voiceSearch.stop();
      return;
    }
    if (micPrimer.needsPrimer) {
      micPrimer.open();
      return;
    }
    voiceRequestIdRef.current++;
    setVoiceError(null);
    setVoiceErrorCode(null);
    clear();
    voiceSearch.start();
  }, [isOnline, voiceState, voiceSearch, clear, handleVoiceError, micPrimer, t]);

  const handleMicPrimerAccept = useCallback(() => {
    micPrimer.accept();
    voiceRequestIdRef.current++;
    setVoiceError(null);
    setVoiceErrorCode(null);
    clear();
    voiceSearch.start();
  }, [micPrimer, clear, voiceSearch]);

  const handleMicPrimerDecline = useCallback(() => {
    micPrimer.decline();
  }, [micPrimer]);

  const handleOpenSystemSettings = useCallback(() => {
    Linking.openSettings().catch(() => {});
  }, []);

  const handleResultPress = useCallback((item: Parfum) => {
    setPendingParfum(item);
    persistRecent(searchText);
    router.push(`/catalog/${item.id}`);
  }, [persistRecent, searchText, router]);

  const renderResult = useCallback(({ item }: { item: Parfum }) => (
    <View style={searchDensity === 'list' ? s.resultCardWrapFull : s.resultCardWrap}>
      <ParfumCard
        parfum={item}
        mode={searchDensity}
        onPressOverride={() => handleResultPress(item)}
      />
    </View>
  ), [searchDensity, s, handleResultPress]);

  const handleSubmitEditing = useCallback(() => {
    persistRecent(searchText);
    inputRef.current?.blur();
  }, [persistRecent, searchText]);

  const handleClearRecent = useCallback(() => {
    hapticsError();
    recentLoadedRef.current = true;
    recentStore.items = [];
    setRecentSearches([]);
    AsyncStorage.removeItem(RECENT_KEY).catch(() => {});
  }, []);

  const handleRecentTap = useCallback((term: string) => {
    hapticsLight();
    setSearchText(term);
    search(term);
    inputRef.current?.blur();
  }, [search]);

  const handleBrandTap = useCallback((brand: string) => {
    hapticsLight();
    setSearchText(brand);
    search(brand);
    inputRef.current?.blur();
  }, [search]);

  const suggestions = useMemo(
    () => matchSuggestions(suggestIndex, searchText, 6),
    [suggestIndex, searchText],
  );

  const handleSuggestionPress = useCallback((term: SuggestionTerm) => {
    hapticsLight();
    if (term.kind === 'parfum' && term.id) {
      persistRecent(term.sub ? `${term.sub} ${term.label}` : term.label);
      router.push(`/catalog/${term.id}`);
      return;
    }
    setSearchText(term.label);
    search(term.label);
    inputRef.current?.blur();
  }, [persistRecent, router, search]);

  const inFamilyMode = familyResults !== null;
  const inColorMode = colorResults !== null;
  const inFacetMode = inFamilyMode || inColorMode;
  const displayParfums = inFamilyMode ? familyResults! : inColorMode ? colorResults! : parfums;
  const isSearching = searching || familyLoading || colorLoading;
  const hasResults = displayParfums.length > 0 && !isSearching;
  const showSuggestions = searchText.trim().length >= 1 && suggestions.length > 0 && !hasResults && !inFacetMode;

  return (
    <SafeAreaView edges={['top', 'bottom']} style={s.container}>
      <View style={s.header}>
        <View style={s.inputWrap}>
          <Ionicons
            name="search-outline"
            size={18}
            color={theme.colors.primary}
          />
          <TextInput
            ref={inputRef}
            style={s.input}
              placeholder={t('search.placeholder')}
            placeholderTextColor={theme.colors.textMuted}
            value={searchText}
            onChangeText={handleTextChange}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            onSubmitEditing={handleSubmitEditing}
            keyboardAppearance={keyboardAppearance}
          />
          <Pressable
            onPress={handleVoiceToggle}
            hitSlop={8}
            style={s.micBtn}
            disabled={voiceState === 'processing' || voiceSearching}
          >
            {voiceSearching ? (
              <ActivityIndicator size="small" color={theme.colors.primary} />
            ) : (
              <Ionicons
                name={voiceState === 'listening' ? 'mic' : 'mic-outline'}
                size={18}
                color={voiceState === 'listening' ? theme.colors.primary : theme.colors.textMuted}
              />
            )}
          </Pressable>
          {searchText.length > 0 && (
            <Pressable
              onPress={() => {
                // Invalide le pipeline voix en cours (sinon il peut aboutir
                // après le clear et ré-injecter texte + résultats).
                voiceRequestIdRef.current++;
                if (voiceState !== 'idle') voiceSearch.cancel();
                setSearchText('');
                clearFacetResults();
                setVoiceError(null);
                clear();
              }}
              hitSlop={8}
              accessibilityLabel={t('search.clearSearchA11y')}
            >
              <Ionicons name="close-circle" size={18} color={theme.colors.textMuted} />
            </Pressable>
          )}
        </View>
        <Pressable onPress={() => router.back()} hitSlop={8} style={s.cancelBtn} accessibilityLabel={t('search.closeSearchA11y')}>
            <Text style={s.cancelText}>{t('cancel')}</Text>
        </Pressable>
      </View>

      {!searchText && (
        <ScrollView
          style={s.discoverScroll}
          contentContainerStyle={s.discoverScrollContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          {recentSearches.length > 0 && (
            <View style={s.recentSection}>
              <View style={s.recentHeaderRow}>
                <Text style={s.sectionTitle}>{t('search.recent')}</Text>
                <Pressable
                  onPress={handleClearRecent}
                  hitSlop={12}
                  style={s.clearBtn}
                  accessibilityLabel={t('search.clearRecentA11y')}
                >
                  <Text style={s.clearBtnText}>{t('search.clearAll')}</Text>
                </Pressable>
              </View>
              <View style={s.recentChips}>
                {recentSearches.map(term => (
                  <Pressable
                    key={term}
                    style={s.recentChip}
                    onPress={() => handleRecentTap(term)}
                    hitSlop={{ top: 6, bottom: 6 }}
                  >
                    <Ionicons name="time-outline" size={14} color={theme.colors.textMuted} />
                    <Text style={s.recentChipText}>{term}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          <View style={s.brandsSection}>
            <Text style={[s.sectionTitle, s.brandsTitle]}>{t('search.iconicBrands')}</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.brandsChips}
            >
              {TOP_BRANDS.map(brand => (
                <Pressable
                  key={brand}
                  style={s.recentChip}
                  onPress={() => handleBrandTap(brand)}
                  hitSlop={{ top: 6, bottom: 6 }}
                >
                  <Text style={s.recentChipText}>{brand}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>

          {discover !== null && discover.trends.length > 0 && (
            <CatalogRow title={discoverKind === 'foryou' ? t('catalog.suggestions.foryouTu') : t('catalog.suggestions.trending')} collapsible={false}>
              {discover.trends.map(p => (
                <ParfumCard key={p.id} parfum={p} mode="carousel" />
              ))}
            </CatalogRow>
          )}

          {discover !== null && discover.seasonal.length > 0 && (
            <CatalogRow title={t('catalog.seasonalRow', { season: SEASON_META[season].withArticle })} collapsible={false}>
              {discover.seasonal.map(p => (
                <ParfumCard key={p.id} parfum={p} mode="carousel" />
              ))}
            </CatalogRow>
          )}
        </ScrollView>
      )}

      {showSuggestions ? (
        <View style={s.suggestDropdown}>
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {suggestions.map((term, i) => (
              <Pressable
                key={`${term.kind}_${term.id ?? term.key}`}
                style={[s.suggestRow, i < suggestions.length - 1 && s.suggestRowBorder]}
                onPress={() => handleSuggestionPress(term)}
                accessibilityRole="button"
                accessibilityLabel={term.kind === 'brand' ? t('search.brandSuggestionA11y', { label: term.label }) : term.sub ? t('search.suggestionA11y', { label: term.label, sub: term.sub }) : term.label}
              >
                <Ionicons
                  name={term.kind === 'brand' ? 'business-outline' : 'flask-outline'}
                  size={16}
                  color={theme.colors.textMuted}
                />
                <View style={s.suggestTexts}>
                  <Text style={s.suggestLabel} numberOfLines={1}>{term.label}</Text>
                  {term.sub ? <Text style={s.suggestSub} numberOfLines={1}>{term.sub}</Text> : null}
                </View>
                <Ionicons name="chevron-forward" size={16} color={theme.colors.textMuted} />
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : (
        <>
          {isSearching && <ActivityIndicator style={{ marginTop: 24 }} color={theme.colors.primary} />}

          {hasResults ? (
            <>
              {inFamilyMode && familyDef && (
                <View style={[s.familyHeader, { backgroundColor: theme.colors[familyDef.accentSoft] }]}>
                  <View style={[s.familyIcon, { backgroundColor: theme.colors[familyDef.accent] }]}>
                    <Ionicons name={familyDef.icon as never} size={16} color={textOn(theme.colors[familyDef.accent])} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.familyTitle}>{familyDef.label}</Text>
                    <Text style={s.familyMeta}>
                      {t('catalog.parfumCount', { count: displayParfums.length, formatted: formatNumber(displayParfums.length) })} · {familyDef.tagline}
                    </Text>
                  </View>
                </View>
              )}
              {inColorMode && colorDef && (() => {
                const cs = chromaSwatch(colorDef.key, resolvedMode);
                return (
                  <View style={[s.familyHeader, { backgroundColor: cs.soft }]}>
                    <View style={[s.familyIcon, { backgroundColor: cs.swatch, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.colors.border }]}>
                      <Ionicons name="color-palette-outline" size={16} color={textOn(cs.swatch)} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.familyTitle}>{colorDef.label}</Text>
                      <Text style={s.familyMeta}>
                        {t('catalog.parfumCount', { count: displayParfums.length, formatted: formatNumber(displayParfums.length) })} · {colorDef.tagline}
                      </Text>
                    </View>
                  </View>
                );
              })()}
              <View style={s.densityRow}>
                {GRID_MODES.map(m => (
                  <Pressable
                    key={m.key}
                    style={[s.segmentBtn, searchDensity === m.key && s.segmentBtnActive]}
                    onPress={() => setSearchDensity(m.key)}
                  >
                    <Text style={[s.segmentBtnText, searchDensity === m.key && s.segmentBtnTextActive]}>
                      {m.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <FlatList
                key={`search-${searchDensity}`}
                data={displayParfums}
                numColumns={searchDensity === 'list' ? 1 : 2}
                keyExtractor={(p) => p.id}
                renderItem={renderResult}
                columnWrapperStyle={searchDensity !== 'list' ? s.resultRow : undefined}
                contentContainerStyle={s.resultListContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                windowSize={5}
                initialNumToRender={10}
                maxToRenderPerBatch={10}
              />
            </>
          ) : (error || voiceError) && !inFacetMode ? (
            <View style={s.errorContainer}>
              <Ionicons name="cloud-offline-outline" size={48} color={theme.colors.primary} style={{ marginBottom: 12 }} />
              <Text style={s.errorTitle}>{voiceErrorCode === 'mic-denied-permanent' ? t('search.micDisabled') : t('search.searchFailed')}</Text>
              <Text style={s.errorDesc}>{error ?? voiceError}</Text>
              {voiceErrorCode === 'mic-denied-permanent' ? (
            <Pressable style={s.errorSettingsBtn} onPress={handleOpenSystemSettings} accessibilityRole="button" accessibilityLabel={t('openSettings')}>
              <Text style={s.errorSettingsBtnText}>{t('openSettings')}</Text>
                </Pressable>
              ) : null}
            </View>
          ) : !isSearching && (inFacetMode || searchText.length >= 2) ? (
            <View style={s.empty}>
              <Ionicons name="search-outline" size={48} color={theme.colors.textMuted} style={{ opacity: 0.4 }} />
            <Text style={s.emptyTitle}>{t('search.noResults')}</Text>
            <Text style={s.emptyDesc}>{t('search.noResultsDesc')}</Text>
            </View>
          ) : null}
        </>
      )}

      <PermissionPrimer
        visible={micPrimer.visible}
        copy={PERMISSION_PRIMERS.mic}
        onAccept={handleMicPrimerAccept}
        onDecline={handleMicPrimerDecline}
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
      gap: 12,
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.border,
    },
    inputWrap: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: t.colors.surface,
      borderRadius: 14,
      paddingHorizontal: 14,
      height: 44,
      gap: 10,
      borderWidth: 1.5,
      borderColor: t.colors.primary,
      ...t.shadow.card,
    },
    input: {
      flex: 1,
      fontFamily: 'Inter_400Regular',
      fontSize: 16,
      color: t.colors.text,
      padding: 0,
    },
    micBtn: {
      width: 28,
      height: 28,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cancelBtn: {
      paddingHorizontal: 4,
      paddingVertical: 8,
    },
    cancelText: {
      fontFamily: 'Inter_500Medium',
      fontSize: 15,
      color: t.colors.primary,
    },
    recentSection: {
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 12,
    },
    discoverScroll: { flex: 1 },
    discoverScrollContent: { paddingBottom: 24 },
    recentHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 10,
    },
    sectionTitle: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 13,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      color: t.colors.textMuted,
    },
    brandsTitle: { marginBottom: 10 },
    clearBtn: { paddingVertical: 4, paddingHorizontal: 8 },
    clearBtnText: {
      fontFamily: 'Inter_500Medium',
      fontSize: 13,
      color: t.colors.primary,
    },
    brandsSection: { paddingHorizontal: 16, paddingBottom: 8 },
    brandsChips: { gap: 8, paddingRight: 16 },
    suggestDropdown: {
      marginHorizontal: 16,
      marginTop: 12,
      borderRadius: t.radius.base,
      backgroundColor: t.colors.surface,
      ...t.shadow.elevated,
    },
    suggestRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      minHeight: 48,
      paddingHorizontal: 14,
      paddingVertical: 8,
    },
    suggestRowBorder: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.border,
    },
    suggestTexts: { flex: 1 },
    suggestLabel: {
      fontFamily: 'Inter_500Medium',
      fontSize: 15,
      color: t.colors.text,
    },
    suggestSub: {
      fontFamily: 'Inter_400Regular',
      fontSize: 12,
      color: t.colors.textMuted,
      marginTop: 1,
    },
    recentChips: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    recentChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: t.colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border,
    },
    recentChipText: {
      fontFamily: 'Inter_500Medium',
      fontSize: 13,
      color: t.colors.text,
    },
    resultRow: { gap: 8, marginBottom: 8 },
    resultListContent: { paddingHorizontal: 16, paddingBottom: 16 },
    resultCardWrap: { flex: 1, maxWidth: '50%' },
    resultCardWrapFull: { width: '100%' },
    familyHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginHorizontal: 16,
      marginTop: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderRadius: t.radius.base,
    },
    familyIcon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      justifyContent: 'center',
      alignItems: 'center',
    },
    familyTitle: {
      fontFamily: 'PlayfairDisplay_600SemiBold',
      fontSize: 17,
      color: t.colors.text,
    },
    familyMeta: {
      fontFamily: 'Inter_400Regular',
      fontSize: 12,
      color: t.colors.textMuted,
      marginTop: 1,
    },
    densityRow: {
      flexDirection: 'row',
      gap: 6,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.border,
    },
    segmentBtn: {
      paddingHorizontal: 14,
      paddingVertical: 9,
      borderRadius: 6,
      backgroundColor: t.colors.surface2,
      minHeight: 44,
      justifyContent: 'center',
    },
    segmentBtnActive: {
      backgroundColor: t.colors.surface,
      ...t.shadow.card,
    },
    segmentBtnText: {
      fontFamily: 'Inter_500Medium', fontSize: 12, color: t.colors.textMuted,
    },
    segmentBtnTextActive: {
      fontFamily: 'Inter_600SemiBold', color: t.colors.text,
    },
    empty: {
      alignItems: 'center',
      paddingTop: 48,
    },
    errorContainer: {
      alignItems: 'center',
      paddingTop: 48,
      paddingHorizontal: 32,
    },
    errorTitle: {
      fontFamily: 'PlayfairDisplay_600SemiBold',
      fontSize: 18,
      color: t.colors.text,
      marginTop: 12,
      textAlign: 'center',
    },
    errorDesc: {
      fontFamily: 'Inter_400Regular',
      fontSize: 13,
      color: t.colors.textMuted,
      textAlign: 'center',
      lineHeight: 20,
      marginTop: 8,
    },
    errorSettingsBtn: {
      marginTop: 16,
      borderWidth: 1.5,
      borderColor: t.colors.primary,
      borderRadius: t.radius.base,
      paddingVertical: 10,
      paddingHorizontal: 20,
      minHeight: 44,
      justifyContent: 'center',
    },
    errorSettingsBtnText: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 13,
      color: t.colors.primary,
    },
    emptyTitle: {
      fontFamily: 'PlayfairDisplay_600SemiBold',
      fontSize: 18,
      color: t.colors.text,
      marginTop: 12,
    },
    emptyDesc: {
      fontFamily: 'Inter_400Regular',
      fontSize: 13,
      color: t.colors.textMuted,
      textAlign: 'center',
      lineHeight: 20,
      marginTop: 8,
      paddingHorizontal: 32,
    },
  } as const;
}
