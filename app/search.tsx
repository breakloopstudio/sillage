// app/search.tsx — Overlay recherche plein écran
// Ouvert depuis la barre de recherche persistante (index.tsx) ou les chips famille (CatalogPage)
// Mêmes contrôles de densité que la grille catalogue

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { View, Text, TextInput, FlatList, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from '@react-native-vector-icons/ionicons/static';
import { useCatalog } from '../src/hooks/useCatalog';
import { useVoiceSearch, type VoiceState, type VoiceResult } from '../src/hooks/useVoiceSearch';
import { transcribeVoice } from '../src/services/voice-search';
import { getParfumsByFamily } from '../src/services/catalog';
import { getFamilyByKey } from '../src/utils/olfactory-families';
import ParfumCard from '../src/components/ParfumCard';
import { useTheme, type Theme } from '../src/theme/ThemeContext';
import { consumePendingCatalogQuery } from '../src/services/catalog-bridge';
import { useDensityPreference, GRID_MODES } from '../src/hooks/useDensityPreference';
import { useNetwork } from '../src/hooks/useNetwork';
import { textOn } from '../src/utils/contrast';
import type { Parfum } from '../src/models';

const RECENT_KEY = '@parfumscan/recent-searches';

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

export default function SearchScreen() {
  const { theme, resolvedMode } = useTheme();
  const s = useMemo(() => getStyles(theme), [theme]);
  const keyboardAppearance = resolvedMode === 'dark' ? 'dark' : 'light';
  const router = useRouter();
  const { q: routeQuery, family: familyKey } = useLocalSearchParams<{ q?: string; family?: string }>();
  const familyDef = useMemo(() => getFamilyByKey(familyKey), [familyKey]);
  const [initialQuery] = useState(() => routeQuery ?? consumePendingCatalogQuery());

  const inputRef = useRef<TextInput>(null);
  const [searchText, setSearchText] = useState(() => familyDef?.label ?? initialQuery ?? '');
  const recentLoadedRef = useRef(false);
  const { parfums, searching, error, search, clear } = useCatalog();
  const [familyResults, setFamilyResults] = useState<Parfum[] | null>(familyDef ? [] : null);
  const [familyLoading, setFamilyLoading] = useState(!!familyDef);
  const { density: searchDensity, setDensity: setSearchDensity } = useDensityPreference();
  const { isOnline } = useNetwork();
  const [recentSearches, setRecentSearches] = useState<string[]>(recentStore.items);

  const handleVoiceResult = useCallback(async (result: VoiceResult) => {
    if (result.text) {
      setSearchText(result.text);
      search(result.text.trim());
      return;
    }
    if (result.audioBase64) {
      try {
        const whisperText = await transcribeVoice(result.audioBase64, 'audio/wav');
        if (whisperText.trim()) {
          setSearchText(whisperText);
          search(whisperText.trim());
        }
      } catch { /* silent — user sees existing results or empty state */ }
    }
  }, [search]);

  const handleVoiceError = useCallback((msg: string) => {
    console.warn('[search] voice error:', msg);
  }, []);

  const voiceSearch = useVoiceSearch(handleVoiceResult, handleVoiceError);

  const voiceState: VoiceState = voiceSearch.state;

  useEffect(() => {
    if (voiceState === 'listening') {
      setSearchText(voiceSearch.transcript);
    }
  }, [voiceSearch.transcript, voiceState]);

  useEffect(() => {
    if (familyDef) return;
    const t = setTimeout(() => inputRef.current?.focus(), 250);
    return () => clearTimeout(t);
  }, [familyDef]);

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

  useEffect(() => {
    loadRecentFromStorage().then(items => {
      if (!recentLoadedRef.current && items.length > 0) {
        recentStore.items = items;
        setRecentSearches(items);
      }
    });
  }, []);

  useEffect(() => {
    if (familyDef) return;
    if (initialQuery && initialQuery.trim().length >= 2) {
      setSearchText(initialQuery);
      search(initialQuery.trim());
    }
  }, [initialQuery, familyDef]);

  const handleTextChange = useCallback((t: string) => {
    setSearchText(t);
    setFamilyResults(null);
    if (voiceState !== 'idle') voiceSearch.cancel();
    t.trim().length >= 2 ? search(t) : clear();
  }, [search, clear, voiceState, voiceSearch]);

  const handleVoiceToggle = useCallback(() => {
    if (!isOnline) {
      handleVoiceError('Recherche vocale indisponible hors-ligne.');
      return;
    }
    if (voiceState === 'listening' || voiceState === 'processing') {
      voiceSearch.stop();
    } else {
      clear();
      voiceSearch.start();
    }
  }, [isOnline, voiceState, voiceSearch, clear, handleVoiceError]);

  const handleResultPress = useCallback((id: string) => {
    const text = searchText.trim();
    if (text && text.length >= 2) {
      recentLoadedRef.current = true;
      recentStore.items = [text, ...recentStore.items.filter(x => x.toLowerCase() !== text.toLowerCase())].slice(0, 5);
      setRecentSearches(recentStore.items);
      saveRecentToStorage(recentStore.items);
    }
    router.push(`/catalog/${id}`);
  }, [searchText, router]);

  const handleRecentTap = useCallback((term: string) => {
    setSearchText(term);
    search(term);
    inputRef.current?.blur();
  }, [search]);

  const inFamilyMode = familyResults !== null;
  const displayParfums = inFamilyMode ? familyResults! : parfums;
  const isSearching = searching || familyLoading;
  const hasResults = displayParfums.length > 0 && !isSearching;

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
            placeholder="Rechercher un parfum..."
            placeholderTextColor={theme.colors.textMuted}
            value={searchText}
            onChangeText={handleTextChange}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            keyboardAppearance={keyboardAppearance}
          />
          <Pressable
            onPress={handleVoiceToggle}
            hitSlop={8}
            style={s.micBtn}
            disabled={voiceState === 'processing'}
          >
            <Ionicons
              name={voiceState === 'listening' ? 'mic' : 'mic-outline'}
              size={18}
              color={voiceState === 'listening' ? theme.colors.primary : theme.colors.textMuted}
            />
          </Pressable>
          {searchText.length > 0 && (
            <Pressable onPress={() => { setSearchText(''); setFamilyResults(null); clear(); }} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={theme.colors.textMuted} />
            </Pressable>
          )}
        </View>
        <Pressable onPress={() => router.back()} hitSlop={8} style={s.cancelBtn} accessibilityLabel="Fermer la recherche">
          <Text style={s.cancelText}>Annuler</Text>
        </Pressable>
      </View>

      {!searchText && (
        <View style={s.recentSection}>
          <Text style={s.recentTitle}>Recherches récentes</Text>
          <View style={s.recentChips}>
            {recentSearches.length > 0 ? recentSearches.map(term => (
              <Pressable key={term} style={s.recentChip} onPress={() => handleRecentTap(term)}>
                <Ionicons name="time-outline" size={14} color={theme.colors.textMuted} />
                <Text style={s.recentChipText}>{term}</Text>
              </Pressable>
            )) : (
              <Text style={s.recentEmpty}>Aucune recherche récente</Text>
            )}
          </View>
        </View>
      )}

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
                  {displayParfums.length.toLocaleString('fr-FR')} parfums · {familyDef.tagline}
                </Text>
              </View>
            </View>
          )}
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
            key={`search-${searchDensity}-${resolvedMode}`}
            data={displayParfums}
            numColumns={searchDensity === 'list' ? 1 : 2}
            keyExtractor={(p, i) => `${p.id}_${i}`}
            renderItem={({ item }) => (
              <View style={searchDensity === 'list' ? s.resultCardWrapFull : s.resultCardWrap}>
                <Pressable onPress={() => handleResultPress(item.id)}>
                  <ParfumCard parfum={item} mode={searchDensity} />
                </Pressable>
              </View>
            )}
            columnWrapperStyle={searchDensity !== 'list' ? s.resultRow : undefined}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          />
        </>
      ) : error && !inFamilyMode ? (
        <View style={s.errorContainer}>
          <Ionicons name="cloud-offline-outline" size={48} color={theme.colors.primary} style={{ marginBottom: 12 }} />
          <Text style={s.errorTitle}>Impossible de rechercher</Text>
          <Text style={s.errorDesc}>{error}</Text>
        </View>
      ) : !isSearching && (inFamilyMode || searchText.length >= 2) ? (
        <View style={s.empty}>
          <Ionicons name="search-outline" size={48} color={theme.colors.textMuted} style={{ opacity: 0.4 }} />
          <Text style={s.emptyTitle}>Aucun résultat</Text>
          <Text style={s.emptyDesc}>Essaie une autre orthographe ou scanne un flacon.</Text>
        </View>
      ) : null}
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
    recentTitle: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 13,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      color: t.colors.textMuted,
      marginBottom: 10,
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
    recentEmpty: {
      fontFamily: 'Inter_400Regular',
      fontSize: 13,
      color: t.colors.textMuted,
    },
    resultRow: { gap: 8, marginBottom: 8 },
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
