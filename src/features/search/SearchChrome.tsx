import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import Ionicons from '@react-native-vector-icons/ionicons/static';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { useTheme, type Theme } from '../../theme/ThemeContext';
import { useAuthContext } from '../../contexts/AuthContext';
import { alpha } from '../../utils/alpha';
import { textOn } from '../../utils/contrast';
import { hapticsLight } from '../../services/haptics';
import { searchParfumsCached } from '../../services/catalog';
import { transcribeVoice } from '../../services/voice-search';
import { useVoiceSearch, type VoiceResult } from '../../hooks/useVoiceSearch';
import { useNetwork } from '../../hooks/useNetwork';
import { useVoicePreference } from '../../hooks/useVoicePreference';
import VoiceOverlay from './VoiceOverlay';
import type { VoicePhase } from './VoiceOverlay';

export default function SearchChrome() {
  const { theme, resolvedMode } = useTheme();
  const insets = useSafeAreaInsets();
  const s = useMemo(() => getSearchStyles(theme, insets.top), [theme, insets.top]);
  const router = useRouter();
  const { isOnline } = useNetwork();
  const { user } = useAuthContext();

  const [voicePhase, setVoicePhase] = useState<VoicePhase>({ type: 'listening', transcript: '' });
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const voiceRequestIdRef = useRef(0);
  const [avatarFailed, setAvatarFailed] = useState(false);

  const handleSettingsPress = useCallback(() => {
    hapticsLight();
    router.push('/settings');
  }, [router]);

  const handleAvatarPress = useCallback(() => {
    hapticsLight();
    router.push('/profile');
  }, [router]);

  const handleVoiceResult = useCallback(async (result: VoiceResult) => {
    const searchQuery = result.text?.trim() || '';
    setVoicePhase({ type: 'searching', query: searchQuery });
    const requestId = ++voiceRequestIdRef.current;

    try {
      if (result.text) {
        setVoiceTranscript(result.text);
        const resolvedQuery = result.text.trim();
        const results = await searchParfumsCached(resolvedQuery);
        if (requestId !== voiceRequestIdRef.current) return;
        if (results.length > 0) {
          setVoicePhase({ type: 'results', results, query: resolvedQuery });
          return;
        }
      }

      if (result.audioBase64) {
        const whisperText = await transcribeVoice(result.audioBase64, 'audio/wav');
        if (requestId !== voiceRequestIdRef.current) return;
        const resolvedQuery = whisperText.trim();
        if (resolvedQuery) {
          setVoiceTranscript(resolvedQuery);
          const results = await searchParfumsCached(resolvedQuery);
          if (requestId !== voiceRequestIdRef.current) return;
          if (results.length > 0) {
            setVoicePhase({ type: 'results', results, query: resolvedQuery });
            return;
          }
        }
      }

      if (requestId !== voiceRequestIdRef.current) return;
      setVoicePhase({ type: 'empty' });
    } catch {
      if (requestId !== voiceRequestIdRef.current) return;
      setVoicePhase({ type: 'error', message: 'La recherche a échoué. Vérifie ta connexion.' });
    }
  }, []);

  const handleVoiceError = useCallback((msg: string) => {
    setVoicePhase({ type: 'error', message: msg || 'Erreur de reconnaissance vocale.' });
  }, []);

  const voiceSearch = useVoiceSearch(handleVoiceResult, handleVoiceError);
  const { voiceEnabled } = useVoicePreference();

  const overlayVisible = voicePhase.type !== 'listening';
  const showVoiceTranscript = voiceSearch.state === 'listening' || voiceSearch.state === 'processing';

  useEffect(() => {
    if (voicePhase.type !== 'searching') return;
    const t = setTimeout(() => {
      setVoicePhase({ type: 'error', message: 'La recherche prend trop de temps. Réessaie.' });
    }, 20_000);
    return () => clearTimeout(t);
  }, [voicePhase.type]);

  useEffect(() => {
    if (voiceSearch.state === 'listening') {
      setVoiceTranscript(voiceSearch.transcript);
      setVoicePhase({ type: 'listening', transcript: voiceSearch.transcript });
    }
  }, [voiceSearch.transcript, voiceSearch.state]);

  const handleFabPressIn = useCallback(() => {
    if (!isOnline) {
      handleVoiceError('Recherche vocale indisponible hors-ligne.');
      return;
    }
    setVoiceTranscript('');
    setVoicePhase({ type: 'listening', transcript: '' });
    hapticsLight();
    voiceSearch.start({ continuous: true });
  }, [isOnline, voiceSearch, handleVoiceError]);

  const handleFabPressOut = useCallback(() => {
    voiceSearch.stop();
  }, [voiceSearch]);

  const handleSearchPress = useCallback(() => {
    if (overlayVisible) return;
    router.push('/search');
  }, [overlayVisible, router]);

  const handleVoiceResultPress = useCallback((id: string) => {
    voiceSearch.cancel();
    setVoicePhase({ type: 'listening', transcript: '' });
    setVoiceTranscript('');
    router.push(`/catalog/${id}`);
  }, [voiceSearch, router]);

  const handleVoiceViewAll = useCallback(() => {
    voiceSearch.cancel();
    setVoicePhase({ type: 'listening', transcript: '' });
    setVoiceTranscript('');
    router.push(`/search?q=${encodeURIComponent(voiceTranscript)}`);
  }, [voiceSearch, voiceTranscript, router]);

  const handleVoiceCancel = useCallback(() => {
    voiceSearch.cancel();
    setVoicePhase({ type: 'listening', transcript: '' });
    setVoiceTranscript('');
  }, [voiceSearch]);

  const handleVoiceRetry = useCallback(() => {
    setVoiceTranscript('');
    setVoicePhase({ type: 'listening', transcript: '' });
    voiceSearch.start({ continuous: true });
  }, [voiceSearch]);

  const micFabVisible = voiceEnabled && !overlayVisible;
  const micFabStyle = useAnimatedStyle(() => ({
    opacity: withTiming(micFabVisible ? 1 : 0, { duration: 150 }),
  }));

  return (
    <>
      <View style={[s.searchWrap, s.searchBarShadow, s.searchRow]}>
        <View style={[s.searchBar, showVoiceTranscript && s.searchBarVoiceActive, s.searchBarFlex]}>
          <BlurView
            intensity={20}
            tint={resolvedMode === 'dark' ? 'dark' : 'light'}
            style={StyleSheet.absoluteFill}
          />
          <View style={[StyleSheet.absoluteFill, s.searchBarOverlay]} />
          <Pressable
            onPress={handleSearchPress}
            style={s.searchBarPressable}
            accessibilityLabel="Rechercher un parfum"
          >
            <Ionicons name="search-outline" size={18} color={theme.colors.textMuted} />
            {showVoiceTranscript ? (
              <Text style={s.voiceTranscript} numberOfLines={1}>
                {voiceTranscript || 'Parle…'}
              </Text>
            ) : (
              <Text style={s.searchPlaceholder} numberOfLines={1}>Rechercher un parfum…</Text>
            )}
          </Pressable>
        </View>
        <Pressable onPress={handleSettingsPress} style={s.settingsBtn} accessibilityRole="button" accessibilityLabel="Ouvrir les paramètres">
          <Ionicons name="settings-outline" size={18} color={theme.colors.textMuted} />
        </Pressable>
        <Pressable onPress={handleAvatarPress} style={s.avatarBtn} accessibilityRole="button" accessibilityLabel="Ouvrir le profil">
          {user?.photoURL && !avatarFailed ? (
            <Image source={{ uri: user.photoURL }} style={s.avatarImg} onError={() => setAvatarFailed(true)} />
          ) : (
            <View style={s.avatarPlaceholder}>
              <Ionicons name="person-outline" size={18} color={theme.colors.textMuted} />
            </View>
          )}
        </Pressable>
      </View>

      <VoiceOverlay
        visible={overlayVisible}
        phase={voicePhase}
        onResultPress={handleVoiceResultPress}
        onViewAll={handleVoiceViewAll}
        onCancel={handleVoiceCancel}
        onRetry={handleVoiceRetry}
      />

      {voiceEnabled && (
        <Animated.View
          style={[micFabStyle, s.micFabWrap]}
          pointerEvents={micFabVisible ? 'auto' : 'none'}
        >
          <Pressable
            onPressIn={handleFabPressIn}
            onPressOut={handleFabPressOut}
            style={({ pressed }) => [
              s.micFab,
              pressed && s.micFabPressed,
              showVoiceTranscript && s.micFabActive,
            ]}
            accessibilityLabel="Recherche vocale"
          >
            <Ionicons
              name={showVoiceTranscript ? 'mic' : 'mic-outline'}
              size={20}
              color={showVoiceTranscript ? textOn(theme.colors.primary) : theme.colors.primary}
            />
          </Pressable>
        </Animated.View>
      )}
    </>
  );
}

function getSearchStyles(t: Theme, safeTop: number) {
  return {
    searchWrap: {
      paddingHorizontal: t.spacing.md,
      paddingTop: safeTop + 8,
      paddingBottom: 6,
    },
    searchRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8 },
    searchBarFlex: { flex: 1 },
    settingsBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: t.colors.surface2,
      justifyContent: 'center' as const,
      alignItems: 'center' as const,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border,
    },
    avatarBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center' as const, alignItems: 'center' as const },
    avatarImg: { width: 36, height: 36, borderRadius: 18 },
    avatarPlaceholder: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: t.colors.surface2,
      justifyContent: 'center' as const,
      alignItems: 'center' as const,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border,
    },
    searchBar: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      borderRadius: 20,
      paddingLeft: 14,
      paddingRight: 14,
      height: 44,
      overflow: 'hidden' as const,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border,
    },
    searchBarPressable: {
      flex: 1,
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: 10,
      height: 44,
    },
    searchBarOverlay: {
      backgroundColor: alpha(t.colors.background, 0.88),
    },
    searchBarShadow: { ...t.shadow.card },
    searchPlaceholder: {
      fontFamily: 'Inter_400Regular',
      fontSize: 15,
      color: t.colors.textMuted,
      flex: 1,
    },
    searchBarVoiceActive: {
      borderColor: t.colors.primary,
      borderWidth: 1.5,
    },
    voiceTranscript: {
      fontFamily: 'Inter_400Regular',
      fontSize: 15,
      color: t.colors.text,
      flex: 1,
    },
    micFabWrap: {
      position: 'absolute' as const,
      bottom: 100,
      right: t.spacing.md,
      zIndex: 50,
    },
    micFab: {
      width: 48,
      height: 48,
      borderRadius: t.radius.full,
      backgroundColor: t.colors.surface,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      borderWidth: 1,
      borderColor: t.colors.border,
      ...t.shadow.button,
    },
    micFabPressed: {
      opacity: 0.85,
    },
    micFabActive: {
      backgroundColor: t.colors.primary,
      borderColor: t.colors.primary,
    },
  } as const;
}
