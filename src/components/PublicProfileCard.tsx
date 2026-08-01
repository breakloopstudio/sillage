// src/components/PublicProfileCard.tsx — Carte « Profil public » (communauté Phase 1)
// Pseudo + bio + toggle de visibilité + partage. Opt-in : la collection n'est
// publique qu'après enregistrement avec is_public = true. Les notes perso ne sont
// jamais exposées (la RPC publique les exclut).

import { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, Pressable, TextInput, Platform, Share, ActivityIndicator } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming, useReducedMotion } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import Ionicons from '@react-native-vector-icons/ionicons/static';
import { useTheme, type Theme } from '../theme/ThemeContext';
import { useMyProfile } from '../hooks/useMyProfile';
import { normalizePseudo, isValidPseudo, profileShareUrl } from '../utils/share';
import { translateSupabaseError } from '../utils/error-translator';
import { hapticsLight, hapticsSuccess } from '../services/haptics';

const BIO_MAX = 140;

interface Props {
  uid: string;
  photoUrl: string | null;
  defaultPseudo: string;
  embedded?: boolean;
  onPublicSaved?: () => void;
}

export default function PublicProfileCard({ uid, photoUrl, defaultPseudo, embedded = false, onPublicSaved }: Props) {
  const { theme, resolvedMode } = useTheme();
  const s = useMemo(() => getStyles(theme), [theme]);
  const router = useRouter();
  const { profile, loading, save } = useMyProfile(uid);

  const [pseudo, setPseudo] = useState('');
  const [bio, setBio] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const knobX = useSharedValue(0);
  const reduceMotion = useReducedMotion();
  const keyboardAppearance = resolvedMode === 'dark' ? 'dark' : 'light';

  useEffect(() => {
    if (loading || initialized) return;
    if (profile) {
      setPseudo(profile.pseudo);
      setBio(profile.bio ?? '');
      setIsPublic(profile.isPublic);
    } else if (defaultPseudo) {
      setPseudo(defaultPseudo);
    }
    setInitialized(true);
  }, [loading, profile, initialized, defaultPseudo]);

  useEffect(() => {
    knobX.value = reduceMotion
      ? withTiming(isPublic ? 20 : 0, { duration: 0 })
      : withSpring(isPublic ? 20 : 0, { stiffness: 300, damping: 20 });
  }, [isPublic, reduceMotion]);

  const knobStyle = useAnimatedStyle(() => ({ transform: [{ translateX: knobX.value }] }));

  const pseudoValid = isValidPseudo(pseudo);
  const isSavedPublic = !!profile?.isPublic && !!profile?.pseudo;

  const handlePseudoChange = useCallback((text: string) => {
    setPseudo(normalizePseudo(text));
    setError(null);
  }, []);

  const handleBioChange = useCallback((text: string) => {
    setBio(text.slice(0, BIO_MAX));
  }, []);

  const handleTogglePublic = useCallback(() => {
    hapticsLight();
    setIsPublic((v) => !v);
  }, []);

  const handleSave = useCallback(async () => {
    if (saving) return;
    if (!pseudoValid) {
      setError('Pseudo : 3 à 20 caractères (lettres, chiffres, _ ou -).');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await save({ pseudo, bio: bio.trim() || null, isPublic, avatarUrl: photoUrl });
      hapticsSuccess();
      if (isPublic) onPublicSaved?.();
    } catch (e: unknown) {
      const code = (e as { code?: string })?.code;
      setError(code === '23505' ? 'Ce pseudo est déjà pris.' : translateSupabaseError(e));
    } finally {
      setSaving(false);
    }
  }, [pseudo, pseudoValid, bio, isPublic, photoUrl, save, onPublicSaved]);

  const handleShare = useCallback(() => {
    if (!profile?.pseudo) return;
    hapticsLight();
    const url = profileShareUrl(profile.pseudo);
    if (Platform.OS === 'ios') {
      Share.share({ url, message: 'Ma parfumerie sur Sillage' }).catch(() => {});
    } else {
      Share.share({ message: `Ma parfumerie sur Sillage ${url}` }).catch(() => {});
    }
  }, [profile]);

  const handleViewPublic = useCallback(() => {
    if (profile?.pseudo) router.push(`/u/${profile.pseudo}`);
  }, [profile, router]);

  if (loading) {
    return (
      <View style={[s.card, embedded && s.cardEmbedded]}>
        <ActivityIndicator style={s.loading} color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <View style={[s.card, embedded && s.cardEmbedded]}>
      <Text style={s.label}>Pseudo</Text>
      <View style={s.pseudoRow}>
        <Text style={s.pseudoPrefix}>@</Text>
        <TextInput
          style={s.pseudoInput}
          value={pseudo}
          onChangeText={handlePseudoChange}
          placeholder="ton_pseudo"
          placeholderTextColor={theme.colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={20}
          keyboardAppearance={keyboardAppearance}
        />
      </View>
      {pseudo.length > 0 && !pseudoValid ? (
        <Text style={s.hintError}>3 à 20 caractères : lettres, chiffres, _ ou -.</Text>
      ) : null}

      <Text style={s.label}>Bio (optionnel)</Text>
      <TextInput
        style={s.bioInput}
        value={bio}
        onChangeText={handleBioChange}
        placeholder="Amateur de boisés sombres…"
        placeholderTextColor={theme.colors.textMuted}
        multiline
        maxLength={BIO_MAX}
        keyboardAppearance={keyboardAppearance}
      />
      <Text style={s.counter} allowFontScaling={false}>{bio.length}/{BIO_MAX}</Text>

      <Pressable
        style={s.toggleRow}
        onPress={handleTogglePublic}
        accessibilityRole="switch"
        accessibilityState={{ checked: isPublic }}
        accessibilityLabel="Collection publique"
      >
        <View style={s.toggleText}>
          <Text style={s.toggleLabel}>Collection publique</Text>
          <Text style={s.toggleDesc}>Chacun peut voir tes parfums (pas tes notes).</Text>
        </View>
        <View style={[s.track, isPublic && s.trackActive]}>
          <Animated.View style={[s.knob, { backgroundColor: isPublic ? theme.colors.primary : theme.colors.textMuted }, knobStyle]} />
        </View>
      </Pressable>

      {error ? <Text style={s.error}>{error}</Text> : null}

      <Pressable
        style={[s.saveBtn, saving && s.saveBtnDisabled]}
        onPress={handleSave}
        disabled={saving}
        accessibilityRole="button"
        accessibilityLabel="Enregistrer le profil"
      >
        {saving ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={s.saveBtnText}>Enregistrer</Text>}
      </Pressable>

      {isSavedPublic && !embedded ? (
        <View style={s.shareRow}>
          <Pressable style={s.shareBtn} onPress={handleShare} accessibilityRole="button" accessibilityLabel="Partager mon profil">
            <Ionicons name="share-social-outline" size={16} color={theme.colors.primaryInk} />
            <Text style={s.shareBtnText} allowFontScaling={false}>Partager</Text>
          </Pressable>
          <Pressable style={s.viewBtn} onPress={handleViewPublic} hitSlop={6} accessibilityRole="button" accessibilityLabel="Voir mon profil public">
            <Text style={s.viewBtnText} allowFontScaling={false}>Voir mon profil</Text>
            <Ionicons name="chevron-forward" size={14} color={theme.colors.primary} />
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function getStyles(t: Theme) {
  return {
    card: { backgroundColor: t.colors.surface, borderRadius: t.radius.card, marginHorizontal: 16, padding: 16, ...t.shadow.card },
    cardEmbedded: {
      marginHorizontal: 0,
      paddingHorizontal: 0,
      paddingTop: 0,
      backgroundColor: 'transparent',
      shadowColor: 'transparent',
      shadowOpacity: 0,
      elevation: 0,
      borderWidth: 0,
    },
    loading: { marginVertical: 20 },
    label: {
      fontFamily: 'Inter_600SemiBold', fontSize: 11, textTransform: 'uppercase' as const, letterSpacing: 0.8,
      color: t.colors.textMuted, marginTop: 12, marginBottom: 6,
    },
    pseudoRow: {
      flexDirection: 'row' as const, alignItems: 'center' as const, gap: 4,
      backgroundColor: t.colors.surface, borderWidth: 1, borderColor: t.colors.border,
      borderRadius: t.radius.base, height: 44, paddingHorizontal: 12,
    },
    pseudoPrefix: { fontFamily: 'Inter_400Regular', fontSize: 15, color: t.colors.textMuted },
    pseudoInput: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 15, color: t.colors.text, padding: 0 },
    hintError: { fontFamily: 'Inter_400Regular', fontSize: 11, color: t.colors.overpriced, marginTop: 4 },
    bioInput: {
      backgroundColor: t.colors.surface, borderWidth: 1, borderColor: t.colors.border,
      borderRadius: t.radius.base, minHeight: 70, paddingTop: 10, paddingHorizontal: 12,
      fontFamily: 'Inter_400Regular', fontSize: 15, color: t.colors.text, textAlignVertical: 'top' as const,
    },
    counter: { fontFamily: 'Inter_400Regular', fontSize: 11, color: t.colors.textMuted, textAlign: 'right' as const, marginTop: 2 },
    toggleRow: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const, gap: 12, paddingVertical: 12, marginTop: 8 },
    toggleText: { flex: 1 },
    toggleLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: t.colors.text },
    toggleDesc: { fontFamily: 'Inter_400Regular', fontSize: 12, color: t.colors.textMuted, marginTop: 1 },
    track: { width: 48, height: 28, borderRadius: 14, backgroundColor: t.colors.border, justifyContent: 'center' as const, paddingHorizontal: 3 },
    trackActive: { backgroundColor: t.colors.primarySoft },
    knob: { width: 22, height: 22, borderRadius: 11 },
    error: { fontFamily: 'Inter_500Medium', fontSize: 12, color: t.colors.overpriced, marginTop: 8 },
    saveBtn: { backgroundColor: t.colors.primary, borderRadius: t.radius.base, minHeight: 48, alignItems: 'center' as const, justifyContent: 'center' as const, marginTop: 12 },
    saveBtnDisabled: { opacity: 0.6 },
    saveBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: '#FFFFFF' },
    shareRow: {
      flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const,
      marginTop: 12, paddingTop: 12, borderTopWidth: 0.5, borderTopColor: t.colors.border,
    },
    shareBtn: {
      flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6,
      paddingHorizontal: 14, paddingVertical: 9, minHeight: 40, borderRadius: 20, backgroundColor: t.colors.primarySoft,
    },
    shareBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: t.colors.primaryInk },
    viewBtn: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 2 },
    viewBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: t.colors.primary },
  } as const;
}
