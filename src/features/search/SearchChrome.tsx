import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import Ionicons from '@react-native-vector-icons/ionicons/static';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { useTheme, type Theme } from '../../theme/ThemeContext';
import { useAuthContext } from '../../contexts/AuthContext';
import { alpha } from '../../utils/alpha';
import { textOn } from '../../utils/contrast';
import { hapticsLight, hapticsSuccess } from '../../services/haptics';
import {
  identifyFromVoice,
  transcribeVoice,
  readVoiceAudioBase64,
  mimeFromAudioUri,
  voiceNeedsSecondChance,
  pickBetterVoiceOutcome,
  type VoiceIdentifyOutcome,
} from '../../services/voice-search';
import {
  setPendingParfum,
  setPendingVoiceAutoOpen,
  consumePendingVoiceResults,
} from '../../services/catalog-bridge';
import { useVoiceSearch, type VoiceResult, type VoiceErrorCode } from '../../hooks/useVoiceSearch';
import { useNetwork } from '../../hooks/useNetwork';
import { useVoicePreference } from '../../hooks/useVoicePreference';
import { usePermissionPrimer } from '../../hooks/usePermissionPrimer';
import { PERMISSION_PRIMERS } from '../../utils/permission-primers';
import PermissionPrimer from '../../components/PermissionPrimer';
import VoiceOverlay from './VoiceOverlay';
import type { VoicePhase } from './VoiceOverlay';

export default function SearchChrome() {
  const { theme, resolvedMode } = useTheme();
  const { t } = useTranslation('common');
  const insets = useSafeAreaInsets();
  const s = useMemo(() => getSearchStyles(theme, insets.top), [theme, insets.top]);
  const router = useRouter();
  const { isOnline } = useNetwork();
  const { user, isAuthenticated } = useAuthContext();

  const [voicePhase, setVoicePhase] = useState<VoicePhase>({ type: 'listening', transcript: '' });
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const voiceRequestIdRef = useRef(0);
  const [avatarFailed, setAvatarFailed] = useState(false);

  const handleSettingsPress = useCallback(() => {
    hapticsLight();
    router.push('/settings');
  }, [router]);

  // Roue chromatique : mode de recherche par couleur (feature 100 % lecture —
  // zéro gate auth/online/permission).
  const handleWheelPress = useCallback(() => {
    hapticsLight();
    router.push('/wheel');
  }, [router]);

  const handleAvatarPress = useCallback(() => {
    hapticsLight();
    router.push('/profile');
  }, [router]);

  // Aboutissement du pipeline : auto-ouverture (match confiant) OU overlay résultats.
  // Retourne true si un aboutissement a eu lieu (false = 0 résultat).
  // (La session STT est déjà terminée à ce stade — deliverResult a rendu la main.)
  const applyVoiceOutcome = useCallback((outcome: VoiceIdentifyOutcome): boolean => {
    if (outcome.results.length === 0) return false;
    if (outcome.autoOpen) {
      const top = outcome.autoOpen;
      setVoicePhase({ type: 'listening', transcript: '' });
      setVoiceTranscript('');
      setPendingParfum(top);
      setPendingVoiceAutoOpen({ parfumId: top.id, query: outcome.query, results: outcome.results });
      hapticsSuccess();
      router.push(`/catalog/${top.id}`);
      return true;
    }
    setVoicePhase({ type: 'results', results: outcome.results, query: outcome.query });
    return true;
  }, [router]);

  const handleVoiceResult = useCallback(async (result: VoiceResult) => {
    const transcript = result.text?.trim() || '';
    setVoicePhase({ type: 'searching', query: transcript });
    const requestId = ++voiceRequestIdRef.current;

    try {
      if (transcript) {
        setVoiceTranscript(transcript);
        // Pipeline identification : interprétation structurée → searchParfumFromScan.
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
                setVoiceTranscript(whisperText);
                setVoicePhase({ type: 'searching', query: whisperText });
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

        if (applyVoiceOutcome(best)) return;
      } else if (result.audioBase64) {
        // Pas de transcript on-device → Whisper d'abord (voie historique).
        const whisperText = (await transcribeVoice(result.audioBase64, mimeFromAudioUri(result.audioUri ?? ''))).trim();
        if (requestId !== voiceRequestIdRef.current) return;
        if (whisperText) {
          setVoiceTranscript(whisperText);
          setVoicePhase({ type: 'searching', query: whisperText });
          const outcome = await identifyFromVoice(whisperText, { isAuthenticated });
          if (requestId !== voiceRequestIdRef.current) return;
          if (applyVoiceOutcome(outcome)) return;
        }
      }

      if (requestId !== voiceRequestIdRef.current) return;
      setVoicePhase({ type: 'empty' });
    } catch (err: unknown) {
      if (requestId !== voiceRequestIdRef.current) return;
      const msg = (err as Error)?.message;
      setVoicePhase({ type: 'error', message: msg || t('voice.searchFailedMsg') });
    }
  }, [isAuthenticated, applyVoiceOutcome, t]);

  const handleVoiceError = useCallback((msg: string, code?: VoiceErrorCode) => {
    setVoicePhase({
      type: 'error',
      message: msg || t('voice.recognitionError'),
      showSettings: code === 'mic-denied-permanent',
    });
  }, [t]);

  const voiceSearch = useVoiceSearch(handleVoiceResult, handleVoiceError);
  const { voiceEnabled } = useVoicePreference();
  const micPrimer = usePermissionPrimer('mic');

  const handleOpenSystemSettings = useCallback(() => {
    voiceRequestIdRef.current++;
    voiceSearch.cancel();
    setVoicePhase({ type: 'listening', transcript: '' });
    setVoiceTranscript('');
    Linking.openSettings().catch(() => {});
  }, [voiceSearch]);

  const overlayVisible = voicePhase.type !== 'listening';
  const showVoiceTranscript = voiceSearch.state === 'listening' || voiceSearch.state === 'processing';

  // Retour de la bannière « Ce n'est pas lui ? » (fiche → ici) : restaurer les
  // résultats vocaux en overlay au focus des tabs.
  useFocusEffect(
    useCallback(() => {
      const pending = consumePendingVoiceResults();
      if (pending && pending.results.length > 0) {
        setVoiceTranscript(pending.query);
        setVoicePhase({ type: 'results', results: pending.results, query: pending.query });
      }
    }, []),
  );

  // Watchdog « searching » : dépend de l'objet phase pour se ré-armer à chaque
  // transition (incl. re-position avant re-transcription). À l'expiration, il
  // invalide le pipeline en cours (requestId) pour qu'aucun résultat tardif ne
  // recouvre l'erreur. 35 s : interprétation (≤12 s) + recherche + lecture
  // audio + re-transcription (≤15 s) + seconde interprétation peuvent se chaîner.
  useEffect(() => {
    if (voicePhase.type !== 'searching') return;
    const timer = setTimeout(() => {
      voiceRequestIdRef.current++;
      setVoicePhase({ type: 'error', message: t('voice.timeoutMsg') });
    }, 35_000);
    return () => clearTimeout(timer);
  }, [voicePhase, t]);

  useEffect(() => {
    if (voiceSearch.state === 'listening') {
      setVoiceTranscript(voiceSearch.transcript);
      setVoicePhase({ type: 'listening', transcript: voiceSearch.transcript });
    }
  }, [voiceSearch.transcript, voiceSearch.state]);

  const startVoiceSession = useCallback(() => {
    voiceRequestIdRef.current++;
    setVoiceTranscript('');
    setVoicePhase({ type: 'listening', transcript: '' });
    hapticsLight();
    voiceSearch.start({ continuous: true });
  }, [voiceSearch]);

  const handleFabPressIn = useCallback(() => {
    if (!isOnline) {
      handleVoiceError(t('voice.offlineMsg'));
      return;
    }
    if (micPrimer.needsPrimer) {
      micPrimer.open();
      return;
    }
    startVoiceSession();
  }, [isOnline, micPrimer, startVoiceSession, handleVoiceError, t]);

  const handleFabPressOut = useCallback(() => {
    voiceSearch.stop();
  }, [voiceSearch]);

  const handleMicPrimerAccept = useCallback(() => {
    micPrimer.accept();
    startVoiceSession();
  }, [micPrimer, startVoiceSession]);

  const handleMicPrimerDecline = useCallback(() => {
    micPrimer.decline();
  }, [micPrimer]);

  const handleSearchPress = useCallback(() => {
    if (overlayVisible) return;
    router.push('/search');
  }, [overlayVisible, router]);

  const handleVoiceResultPress = useCallback((id: string) => {
    voiceRequestIdRef.current++;
    voiceSearch.cancel();
    setVoicePhase({ type: 'listening', transcript: '' });
    setVoiceTranscript('');
    router.push(`/catalog/${id}`);
  }, [voiceSearch, router]);

  const handleVoiceViewAll = useCallback(() => {
    voiceRequestIdRef.current++;
    voiceSearch.cancel();
    setVoicePhase({ type: 'listening', transcript: '' });
    setVoiceTranscript('');
    router.push(`/search?q=${encodeURIComponent(voiceTranscript)}`);
  }, [voiceSearch, voiceTranscript, router]);

  const handleVoiceCancel = useCallback(() => {
    voiceRequestIdRef.current++;
    voiceSearch.cancel();
    setVoicePhase({ type: 'listening', transcript: '' });
    setVoiceTranscript('');
  }, [voiceSearch]);

  const handleVoiceRetry = useCallback(() => {
    voiceRequestIdRef.current++;
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
            accessibilityLabel={t('searchChrome.searchA11y')}
          >
            <Ionicons name="search-outline" size={18} color={theme.colors.textMuted} />
            {showVoiceTranscript ? (
              <Text style={s.voiceTranscript} numberOfLines={1}>
                {voiceTranscript || t('searchChrome.speakPlaceholder')}
              </Text>
            ) : (
              <Text style={s.searchPlaceholder} numberOfLines={1}>{t('searchChrome.searchPlaceholder')}</Text>
            )}
          </Pressable>
        </View>
        <Pressable onPress={handleWheelPress} style={s.wheelBtn} hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }} accessibilityRole="button" accessibilityLabel={t('searchChrome.openWheelA11y')}>
          <Ionicons name="color-palette-outline" size={18} color={theme.colors.textMuted} />
        </Pressable>
        <Pressable onPress={handleSettingsPress} style={s.settingsBtn} hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }} accessibilityRole="button" accessibilityLabel={t('searchChrome.openSettingsA11y')}>
          <Ionicons name="settings-outline" size={18} color={theme.colors.textMuted} />
        </Pressable>
        <Pressable onPress={handleAvatarPress} style={s.avatarBtn} hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }} accessibilityRole="button" accessibilityLabel={t('searchChrome.openProfileA11y')}>
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
        onOpenSettings={handleOpenSystemSettings}
      />

      <PermissionPrimer
        visible={micPrimer.visible}
        copy={PERMISSION_PRIMERS.mic}
        onAccept={handleMicPrimerAccept}
        onDecline={handleMicPrimerDecline}
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
            accessibilityLabel={t('searchChrome.voiceSearchA11y')}
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
    wheelBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: t.colors.surface2,
      justifyContent: 'center' as const,
      alignItems: 'center' as const,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border,
    },
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
