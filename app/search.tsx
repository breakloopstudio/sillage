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
import ParfumCard from '../src/components/ParfumCard';
import { useTheme, type Theme } from '../src/theme/ThemeContext';
import { consumePendingCatalogQuery } from '../src/services/catalog-bridge';
import { useDensityPreference, GRID_MODES } from '../src/hooks/useDensityPreference';
import { useNetwork } from '../src/hooks/useNetwork';

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
  const { q: routeQuery } = useLocalSearchParams<{ q?: string }>();
  const [initialQuery] = useState(() => routeQuery ?? consumePendingCatalogQuery());

  const inputRef = useRef<TextInput>(null);
  const [searchText, setSearchText] = useState(initialQuery ?? '');
  const recentLoadedRef = useRef(false);
  const { parfums, searching, error, rateLimited, search, clear } = useCatalog();
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
    const t = setTimeout(() => inputRef.current?.focus(), 250);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    loadRecentFromStorage().then(items => {
      if (!recentLoadedRef.current && items.length > 0) {
        recentStore.items = items;
        setRecentSearches(items);
      }
    });
  }, []);

  useEffect(() => {
    if (initialQuery && initialQuery.trim().length >= 3) {
      setSearchText(initialQuery);
      search(initialQuery.trim());
    }
  }, [initialQuery]);

  const handleTextChange = useCallback((t: string) => {
    setSearchText(t);
    if (voiceState !== 'idle') voiceSearch.cancel();
    t.trim().length >= 3 ? search(t) : clear();
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
    if (text && text.length >= 3) {
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

  const hasResults = parfums.length > 0 && !searching;

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
            <Pressable onPress={() => { setSearchText(''); clear(); }} hitSlop={8}>
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

      {searching && <ActivityIndicator style={{ marginTop: 24 }} color={theme.colors.primary} />}

      {rateLimited && (
        <View style={s.rateBanner}>
          <Ionicons name="timer-outline" size={14} color={theme.colors.fairInk} />
          <Text style={s.rateBannerText}>Trop de recherches. Réessaie dans quelques secondes.</Text>
        </View>
      )}

      {hasResults ? (
        <>
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
            data={parfums}
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
      ) : error ? (
        <View style={s.errorContainer}>
          <Ionicons name="cloud-offline-outline" size={48} color={theme.colors.primary} style={{ marginBottom: 12 }} />
          <Text style={s.errorTitle}>Impossible de rechercher</Text>
          <Text style={s.errorDesc}>{error}</Text>
        </View>
      ) : searchText.length >= 3 && !searching ? (
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
    rateBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 8,
      paddingHorizontal: 16,
      backgroundColor: t.colors.fairSoft,
      marginHorizontal: 16,
      marginTop: 8,
      borderRadius: t.radius.sm,
    },
    rateBannerText: {
      fontFamily: 'Inter_500Medium',
      fontSize: 12,
      color: t.colors.fairInk,
    },
  } as const;
}
