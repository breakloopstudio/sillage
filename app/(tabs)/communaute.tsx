import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { useAnimatedScrollHandler } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import Ionicons from '@react-native-vector-icons/ionicons/static';
import { useTheme, type Theme } from '../../src/theme/ThemeContext';
import { useAuthContext } from '../../src/contexts/AuthContext';
import { useNavigationChrome } from '../../src/features/navigation/NavigationChromeContext';
import { useCommunityHighlights } from '../../src/hooks/useCommunityHighlights';
import { getFollowedHighlights, type CommunityParfum, type CommunityProfile, type CommunitySotd, type FollowedVerdict } from '../../src/services/community';
import { setPendingParfum } from '../../src/services/catalog-bridge';
import { normalizePseudo } from '../../src/utils/share';
import { hapticsLight } from '../../src/services/haptics';
import ParfumCard from '../../src/components/ParfumCard';
import SectionHeader from '../../src/components/SectionHeader';
import type { Parfum } from '../../src/models';

function toParfum(cp: CommunityParfum): Parfum {
  return {
    id: cp.parfum_id,
    nom: cp.nom ?? '',
    marque: cp.marque ?? '',
    imageUrl: cp.image_url ?? undefined,
    familleOlactive: cp.famille_olfactive ?? '',
    bestPrice: cp.best_price ?? undefined,
  } as Parfum;
}

export default function CommunautePage() {
  const { theme, resolvedMode } = useTheme();
  const s = useMemo(() => getStyles(theme), [theme]);
  const router = useRouter();
  const { isAuthenticated } = useAuthContext();
  const { scrollY } = useNavigationChrome();
  const { top_loved, trending, public_profiles, sotd_today, loading, error, refresh } = useCommunityHighlights();

  const [pseudoQuery, setPseudoQuery] = useState('');
  const [followedVerdicts, setFollowedVerdicts] = useState<FollowedVerdict[]>([]);
  const [followedSotd, setFollowedSotd] = useState<CommunitySotd[]>([]);
  const mountedRef = useRef(true);
  const keyboardAppearance = resolvedMode === 'dark' ? 'dark' : 'light';

  useEffect(() => {
    mountedRef.current = true;
    if (!isAuthenticated) return;
    getFollowedHighlights().then((d) => {
      if (!mountedRef.current || !d) return;
      setFollowedVerdicts(d.recent_verdicts);
      setFollowedSotd(d.sotd_today);
    });
    return () => { mountedRef.current = false; };
  }, [isAuthenticated]);

  const scrollHandler = useAnimatedScrollHandler((e) => { scrollY.value = e.contentOffset.y; });

  const handleParfumPress = useCallback((cp: CommunityParfum) => {
    setPendingParfum(toParfum(cp));
    router.push(`/catalog/${cp.parfum_id}`);
  }, [router]);

  const handleProfilePress = useCallback((pseudo: string) => {
    hapticsLight();
    router.push(`/u/${pseudo}`);
  }, [router]);

  const handlePseudoSearch = useCallback(() => {
    const q = normalizePseudo(pseudoQuery);
    if (q.length >= 3) {
      hapticsLight();
      router.push(`/u/${q}`);
    }
  }, [pseudoQuery, router]);

  const hasContent = top_loved.length > 0 || trending.length > 0 || public_profiles.length > 0 || sotd_today.length > 0;

  return (
    <SafeAreaView edges={['bottom']} style={s.container}>
      <Animated.ScrollView
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={theme.colors.primary} />}
      >
        <View style={s.header}>
          <Text style={s.title}>Communauté</Text>
        </View>

        <View style={s.searchRow}>
          <Ionicons name="search-outline" size={16} color={theme.colors.textMuted} />
          <TextInput
            style={s.searchInput}
            value={pseudoQuery}
            onChangeText={setPseudoQuery}
            placeholder="Chercher un pseudo…"
            placeholderTextColor={theme.colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            onSubmitEditing={handlePseudoSearch}
            keyboardAppearance={keyboardAppearance}
          />
          {pseudoQuery.length > 0 ? (
            <Pressable onPress={() => setPseudoQuery('')} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Ionicons name="close-circle" size={16} color={theme.colors.textMuted} />
            </Pressable>
          ) : null}
        </View>

        {loading ? (
          <ActivityIndicator style={s.loader} color={theme.colors.primary} />
        ) : error ? (
          <View style={s.stateWrap}>
            <Text style={s.stateText}>{error}</Text>
          </View>
        ) : (
          <>
            {isAuthenticated && (followedVerdicts.length > 0 || followedSotd.length > 0) ? (
              <View style={s.section}>
                <SectionHeader title="Nez que tu suis" subtitle="Cette semaine" />
                {followedSotd.length > 0 ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.hRow}>
                    {followedSotd.map((item) => (
                      <SotdCard key={`f-${item.pseudo}-${item.parfum_id}`} item={item} styles={s} theme={theme} onPress={() => handleProfilePress(item.pseudo)} />
                    ))}
                  </ScrollView>
                ) : null}
                {followedVerdicts.map((v, i) => (
                  <Pressable key={`${v.pseudo}-${v.parfum_id}-${i}`} style={s.activityRow} onPress={() => handleParfumPress({ parfum_id: v.parfum_id, nom: v.nom, marque: v.marque, image_url: v.image_url, famille_olfactive: null, best_price: null })} accessibilityRole="button">
                    {v.avatar_url ? (
                      <Image source={{ uri: v.avatar_url }} style={s.activityAvatar} contentFit="cover" transition={200} />
                    ) : (
                      <View style={[s.activityAvatar, s.activityAvatarPlaceholder]}>
                        <Text allowFontScaling={false} style={s.activityInitial}>{v.pseudo.charAt(0).toUpperCase()}</Text>
                      </View>
                    )}
                    <Text style={s.activityText} numberOfLines={2} maxFontSizeMultiplier={1.3}>
                      <Text style={s.activityPseudo}>@{v.pseudo}</Text>
                      {v.verdict === 'love' ? ' adore ' : v.verdict === 'like' ? ' aime ' : v.verdict === 'meh' ? ' mitigé sur ' : ' n\u2019aime pas '}
                      <Text style={s.activityParfum}>{v.marque} {v.nom}</Text>
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}

            {!hasContent ? (
          <View style={s.stateWrap}>
            <View style={s.iconCircle}>
              <Ionicons name="people-outline" size={32} color={theme.colors.primary} />
            </View>
            <Text style={s.stateHeading}>Les membres arrivent</Text>
            <Text style={s.stateText}>
              {isAuthenticated
                ? 'Suis des nez pour voir leur activité ici, et rends ton profil visible pour être découvert.'
                : 'Rends ton profil visible pour être parmi les premiers nez de la communauté.'}
            </Text>
            <Pressable style={s.ctaBtn} onPress={() => router.push('/profile')} accessibilityRole="button">
              <Text style={s.ctaBtnText}>{isAuthenticated ? 'Mon profil public' : 'Créer mon profil'}</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {sotd_today.length > 0 ? (
              <View style={s.section}>
                <SectionHeader title="Portés aujourd'hui" />
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.hRow}>
                  {sotd_today.map((item) => (
                    <SotdCard key={`${item.pseudo}-${item.parfum_id}`} item={item} styles={s} theme={theme} onPress={() => handleProfilePress(item.pseudo)} />
                  ))}
                </ScrollView>
              </View>
            ) : null}

            {top_loved.length > 0 ? (
              <View style={s.section}>
                <SectionHeader title="Les plus aimés" subtitle="Par la communauté" />
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.hRow}>
                  {top_loved.map((cp) => (
                    <View key={cp.parfum_id} style={s.cardWrap}>
                      <ParfumCard parfum={toParfum(cp)} mode="compact" onPressOverride={() => handleParfumPress(cp)} />
                    </View>
                  ))}
                </ScrollView>
              </View>
            ) : null}

            {trending.length > 0 ? (
              <View style={s.section}>
                <SectionHeader title="Tendances" subtitle="Cette semaine" />
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.hRow}>
                  {trending.map((cp) => (
                    <View key={cp.parfum_id} style={s.cardWrap}>
                      <ParfumCard parfum={toParfum(cp)} mode="compact" onPressOverride={() => handleParfumPress(cp)} />
                    </View>
                  ))}
                </ScrollView>
              </View>
            ) : null}

            {public_profiles.length > 0 ? (
              <View style={s.section}>
                <SectionHeader title="Collections à découvrir" />
                <View style={s.profilesGrid}>
                  {public_profiles.map((p) => (
                    <ProfileCard key={p.pseudo} profile={p} styles={s} theme={theme} onPress={() => handleProfilePress(p.pseudo)} />
                  ))}
                </View>
              </View>
            ) : null}
          </>
        )}
          </>
        )}
      </Animated.ScrollView>
    </SafeAreaView>
  );
}

function SotdCard({ item, styles: s, theme, onPress }: { item: CommunitySotd; styles: ReturnType<typeof getStyles>; theme: Theme; onPress: () => void }) {
  return (
    <Pressable style={s.sotdCard} onPress={onPress} accessibilityRole="button" accessibilityLabel={`${item.pseudo} porte ${item.nom}`}>
      {item.image_url ? (
        <Image source={{ uri: item.image_url }} style={s.sotdImg} contentFit="contain" transition={200} />
      ) : (
        <View style={[s.sotdImg, s.sotdImgPlaceholder]}>
          <Ionicons name="flask-outline" size={20} color={theme.colors.textMuted} />
        </View>
      )}
      <Text style={s.sotdName} numberOfLines={1}>{item.nom}</Text>
      <Text style={s.sotdPseudo} numberOfLines={1}>@{item.pseudo}</Text>
    </Pressable>
  );
}

function ProfileCard({ profile, styles: s, theme, onPress }: { profile: CommunityProfile; styles: ReturnType<typeof getStyles>; theme: Theme; onPress: () => void }) {
  const initial = profile.pseudo.charAt(0).toUpperCase();
  return (
    <Pressable style={s.profileCard} onPress={onPress} accessibilityRole="button" accessibilityLabel={`Profil de ${profile.pseudo}, ${profile.collection_count} parfums`}>
      <View style={s.profileTop}>
        {profile.avatar_url ? (
          <Image source={{ uri: profile.avatar_url }} style={s.profileAvatar} contentFit="cover" transition={200} />
        ) : (
          <View style={[s.profileAvatar, s.profileAvatarPlaceholder]}>
            <Text allowFontScaling={false} style={s.profileInitial}>{initial}</Text>
          </View>
        )}
        <View style={s.profileInfo}>
          <Text style={s.profilePseudo} numberOfLines={1}>@{profile.pseudo}</Text>
          <Text style={s.profileCount} allowFontScaling={false}>
            {profile.collection_count} parfum{profile.collection_count > 1 ? 's' : ''}
          </Text>
        </View>
      </View>
      {profile.top_images.length > 0 ? (
        <View style={s.profileThumbs}>
          {profile.top_images.map((url, i) => (
            <Image key={i} source={{ uri: url }} style={s.profileThumb} contentFit="contain" transition={200} />
          ))}
        </View>
      ) : null}
    </Pressable>
  );
}

function getStyles(t: Theme) {
  return {
    container: { flex: 1, backgroundColor: t.colors.background },
    content: { paddingBottom: 40 },
    header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
    title: { fontFamily: 'PlayfairDisplay_700Bold', fontSize: 28, color: t.colors.text },

    searchRow: {
      flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8,
      marginHorizontal: 16, marginVertical: 12, paddingHorizontal: 12, height: 44,
      backgroundColor: t.colors.surface, borderRadius: t.radius.base, borderWidth: 1, borderColor: t.colors.border,
    },
    searchInput: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 15, color: t.colors.text, padding: 0 },

    loader: { marginTop: 60 },
    stateWrap: { alignItems: 'center' as const, paddingHorizontal: 32, paddingTop: 60 },
    stateHeading: { fontFamily: 'PlayfairDisplay_700Bold', fontSize: 20, color: t.colors.text, textAlign: 'center' as const, marginBottom: 8 },
    stateText: { fontFamily: 'Inter_400Regular', fontSize: 14, color: t.colors.textMuted, textAlign: 'center' as const, lineHeight: 21, maxWidth: 280 },
    iconCircle: {
      width: 72, height: 72, borderRadius: 36, backgroundColor: t.colors.primarySoft,
      justifyContent: 'center' as const, alignItems: 'center' as const, marginBottom: 16,
    },
    ctaBtn: {
      marginTop: 20, paddingHorizontal: 24, paddingVertical: 12, minHeight: 48,
      borderRadius: t.radius.base, backgroundColor: t.colors.primary, justifyContent: 'center' as const,
    },
    ctaBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: '#FFFFFF' },

    section: { marginTop: 24 },
    hRow: { paddingHorizontal: 16, gap: 10 },
    cardWrap: { width: 140 },

    profilesGrid: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, paddingHorizontal: 12, gap: 8 },
    profileCard: {
      width: '48%' as const, backgroundColor: t.colors.surface, borderRadius: t.radius.card,
      padding: 12, ...t.shadow.card,
    },
    profileTop: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 10 },
    profileAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: t.colors.surface2 },
    profileAvatarPlaceholder: { justifyContent: 'center' as const, alignItems: 'center' as const, backgroundColor: t.colors.primarySoft },
    profileInitial: { fontFamily: 'Inter_700Bold', fontSize: 16, color: t.colors.primaryInk },
    profileInfo: { flex: 1 },
    profilePseudo: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: t.colors.text },
    profileCount: { fontFamily: 'Inter_400Regular', fontSize: 11, color: t.colors.textMuted, marginTop: 1 },
    profileThumbs: { flexDirection: 'row' as const, gap: 4, marginTop: 10 },
    profileThumb: { width: 44, height: 58, borderRadius: 6, backgroundColor: t.colors.surface2 },

    sotdCard: { width: 100, alignItems: 'center' as const },
    sotdImg: { width: 72, height: 96, borderRadius: 8, backgroundColor: t.colors.surface },
    sotdImgPlaceholder: { justifyContent: 'center' as const, alignItems: 'center' as const },
    sotdName: { fontFamily: 'Inter_500Medium', fontSize: 11, color: t.colors.text, marginTop: 6, textAlign: 'center' as const },
    sotdPseudo: { fontFamily: 'Inter_400Regular', fontSize: 10, color: t.colors.textMuted, marginTop: 2 },

    activityRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 10, marginHorizontal: 16, paddingVertical: 10 },
    activityAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: t.colors.surface2 },
    activityAvatarPlaceholder: { justifyContent: 'center' as const, alignItems: 'center' as const, backgroundColor: t.colors.primarySoft },
    activityInitial: { fontFamily: 'Inter_700Bold', fontSize: 13, color: t.colors.primaryInk },
    activityText: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 13, color: t.colors.textMuted, lineHeight: 18 },
    activityPseudo: { fontFamily: 'Inter_600SemiBold', color: t.colors.text },
    activityParfum: { fontFamily: 'Inter_500Medium', color: t.colors.text },
  } as const;
}
