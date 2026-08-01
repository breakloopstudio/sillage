import { useMemo, useState, useCallback, useEffect, useRef, type ReactNode } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, ActivityIndicator, RefreshControl, Platform, Share, StyleSheet, type ViewStyle, type LayoutChangeEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { useAnimatedScrollHandler, useReducedMotion, FadeInDown, FadeIn } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import Ionicons from '@react-native-vector-icons/ionicons/static';
import { useTheme, type Theme } from '../../src/theme/ThemeContext';
import { useAuthContext } from '../../src/contexts/AuthContext';
import { useUserParfumContext } from '../../src/contexts/UserParfumContext';
import { useNavigationChrome } from '../../src/features/navigation/NavigationChromeContext';
import { useCommunityHighlights } from '../../src/hooks/useCommunityHighlights';
import { useSotd } from '../../src/hooks/useSotd';
import { useWeather } from '../../src/hooks/useWeather';
import { useMyProfile } from '../../src/hooks/useMyProfile';
import { useWeeklyRecap } from '../../src/hooks/useWeeklyRecap';
import { useNetwork } from '../../src/hooks/useNetwork';
import { getFollowedHighlights, searchProfiles, type CommunityParfum, type CommunityProfile, type CommunitySotd, type FollowedVerdict, type FollowedHave, type ProfileSearchResult } from '../../src/services/community';
import { getRunnerLeaderboard, type LeaderboardEntry } from '../../src/services/runner';
import { getTopRatedParfums, getSeasonalParfums } from '../../src/services/catalog';
import { setPendingParfum } from '../../src/services/catalog-bridge';
import { normalizePseudo, parfumShareUrl, profileShareUrl } from '../../src/utils/share';
import { getWmoMeta } from '../../src/utils/weather-codes';
import { currentSeason } from '../../src/utils/season';
import { OLFACTORY_FAMILIES } from '../../src/utils/olfactory-families';
import { hapticsLight } from '../../src/services/haptics';
import ParfumCard from '../../src/components/ParfumCard';
import SectionHeader from '../../src/components/SectionHeader';
import SOTDPicker from '../../src/features/wardrobe/SOTDPicker';
import type { Parfum } from '../../src/models';
import type { WeatherData } from '../../src/services/weather';
import type { SotdEntry } from '../../src/models/user-parfum.interface';
import type { WeeklyRecap } from '../../src/services/recap';

const NIGHT_ICON: Record<string, string> = {
  sunny: 'moon',
  'partly-sunny': 'cloudy-night',
};

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

const MIN_ROW_CAROUSEL = 3;
const MIN_ROW_GRID = 2;
const USE_FEATURED_ROWS = true;

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

function dedupCommunity(items: CommunityParfum[]): CommunityParfum[] {
  const seen = new Set<string>();
  const out: CommunityParfum[] = [];
  for (const it of items) {
    if (seen.has(it.parfum_id)) continue;
    seen.add(it.parfum_id);
    out.push(it);
  }
  return out;
}

function dedupParfums(items: Parfum[]): Parfum[] {
  const seen = new Set<string>();
  const out: Parfum[] = [];
  for (const it of items) {
    if (seen.has(it.id)) continue;
    seen.add(it.id);
    out.push(it);
  }
  return out;
}

function verdictVerb(v: FollowedVerdict['verdict']): string {
  return v === 'love' ? ' adore ' : v === 'like' ? ' aime ' : v === 'meh' ? ' mitigé sur ' : ' n’aime pas ';
}

function recapPhrase(r: WeeklyRecap): string {
  const segs: string[] = [];
  if (r.scans > 0) segs.push(`${r.scans} flacon${r.scans > 1 ? 's' : ''} croisé${r.scans > 1 ? 's' : ''}`);
  if (r.favorites > 0) segs.push(`${r.favorites} cœur${r.favorites > 1 ? 's' : ''}`);
  if (r.daysWorn > 0) segs.push(`porté ${r.daysWorn} jour${r.daysWorn > 1 ? 's' : ''}`);
  if (r.verdicts > 0) segs.push(`${r.verdicts} avis posé${r.verdicts > 1 ? 's' : ''}`);
  return segs.join(' · ');
}

interface TimelineRow {
  key: string;
  pseudo: string;
  avatar_url: string | null;
  parfum_id: string;
  nom: string | null;
  marque: string | null;
  image_url: string | null;
  mid: string;
  tail: string;
  date: string;
}

export default function CommunautePage() {
  const { theme, resolvedMode } = useTheme();
  const s = useMemo(() => getStyles(theme), [theme]);
  const router = useRouter();
  const { user, isAuthenticated } = useAuthContext();
  const uid = user?.uid ?? null;
  const { scrollY } = useNavigationChrome();
  const { top_loved, trending, public_profiles, sotd_today, loading, error, refresh } = useCommunityHighlights();
  const { isOnline } = useNetwork();
  const { sotd, setTodaySotd } = useSotd(isAuthenticated ? uid : null);
  const { weather, loading: weatherLoading } = useWeather(isAuthenticated && isOnline);
  const { items } = useUserParfumContext();
  const { profile, loading: profileLoading } = useMyProfile(isAuthenticated ? uid : null);
  const followingCount = profile?.followingCount ?? 0;
  const { recap } = useWeeklyRecap(isAuthenticated ? uid : null);

  const [pseudoQuery, setPseudoQuery] = useState('');
  const [suggestions, setSuggestions] = useState<ProfileSearchResult[]>([]);
  const [followedVerdicts, setFollowedVerdicts] = useState<FollowedVerdict[]>([]);
  const [followedSotd, setFollowedSotd] = useState<CommunitySotd[]>([]);
  const [followedHave, setFollowedHave] = useState<FollowedHave[]>([]);
  const [sotdPickerVisible, setSotdPickerVisible] = useState(false);
  const [sotdHeroAnchor, setSotdHeroAnchor] = useState(0);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [lbLoading, setLbLoading] = useState(false);
  const [topLovedSeed, setTopLovedSeed] = useState<Parfum[]>([]);
  const [trendingSeed, setTrendingSeed] = useState<Parfum[]>([]);
  const [seedLoading, setSeedLoading] = useState(false);
  const mountedRef = useRef(true);
  const seedTriggeredRef = useRef(false);
  const suggestTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const keyboardAppearance = resolvedMode === 'dark' ? 'dark' : 'light';
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; if (suggestTimer.current) clearTimeout(suggestTimer.current); };
  }, []);

  useEffect(() => {
    if (!isAuthenticated || profileLoading || followingCount <= 0) return;
    getFollowedHighlights().then((d) => {
      if (!mountedRef.current || !d) return;
      setFollowedVerdicts(d.recent_verdicts);
      setFollowedSotd(d.sotd_today);
      setFollowedHave(d.new_have);
    }).catch((e: unknown) => { console.warn('[communaute] followed highlights failed:', (e as Error)?.message ?? String(e)); });
  }, [isAuthenticated, profileLoading, followingCount]);

  const loadLeaderboard = useCallback((force = false) => {
    setLbLoading(true);
    getRunnerLeaderboard(50, force)
      .then((rows) => { if (mountedRef.current) setLeaderboard(rows); })
      .catch((e: unknown) => { console.warn('[communaute] leaderboard failed:', (e as Error)?.message ?? String(e)); })
      .finally(() => { if (mountedRef.current) setLbLoading(false); });
  }, []);

  useEffect(() => { loadLeaderboard(); }, [loadLeaderboard]);

  useEffect(() => {
    if (loading || seedTriggeredRef.current) return;
    const commLen = dedupCommunity([...top_loved, ...trending]).length;
    if (commLen >= MIN_ROW_CAROUSEL) return;
    seedTriggeredRef.current = true;
    setSeedLoading(true);
    const season = currentSeason();
    Promise.all([
      getTopRatedParfums(10).catch(() => [] as Parfum[]),
      getSeasonalParfums(season, 10).catch(() => [] as Parfum[]),
    ]).then(([rated, seasonal]) => {
      if (!mountedRef.current) return;
      setTopLovedSeed(rated);
      setTrendingSeed(seasonal);
    }).finally(() => { if (mountedRef.current) setSeedLoading(false); });
  }, [loading, top_loved, trending]);

  const handleRefresh = useCallback(() => {
    refresh();
    loadLeaderboard(true);
  }, [refresh, loadLeaderboard]);

  const scrollHandler = useAnimatedScrollHandler((e) => { scrollY.value = e.contentOffset.y; });

  const sotdEligible = useMemo(() => items.filter(i => i.status === 'have'), [items]);

  const handleParfumPress = useCallback((cp: CommunityParfum) => {
    setPendingParfum(toParfum(cp));
    router.push(`/catalog/${cp.parfum_id}`);
  }, [router]);

  const handleSeedPress = useCallback((p: Parfum) => {
    setPendingParfum(p);
    router.push(`/catalog/${p.id}`);
  }, [router]);

  const handleProfilePress = useCallback((pseudo: string) => {
    hapticsLight();
    router.push(`/u/${pseudo}`);
  }, [router]);

  const handlePseudoChange = useCallback((text: string) => {
    setPseudoQuery(text);
    if (suggestTimer.current) clearTimeout(suggestTimer.current);
    const q = normalizePseudo(text);
    if (q.length < 2) { setSuggestions([]); return; }
    suggestTimer.current = setTimeout(() => {
      searchProfiles(q).then((r) => { if (mountedRef.current) setSuggestions(r); });
    }, 250);
  }, []);

  const handlePseudoSearch = useCallback(() => {
    const q = normalizePseudo(pseudoQuery);
    if (q.length >= 3) {
      hapticsLight();
      setSuggestions([]);
      router.push(`/u/${q}`);
    }
  }, [pseudoQuery, router]);

  const handleSuggestionPress = useCallback((pseudo: string) => {
    hapticsLight();
    setSuggestions([]);
    setPseudoQuery('');
    router.push(`/u/${pseudo}`);
  }, [router]);

  const handleSotdPress = useCallback(() => {
    if (sotd) router.push(`/catalog/${sotd.parfumId}`);
  }, [sotd, router]);

  const handleSotdChange = useCallback(() => setSotdPickerVisible(true), []);

  const handleSotdSelect = useCallback((parfumId: string) => {
    if (parfumId === sotd?.parfumId) { setSotdPickerVisible(false); return; }
    const item = sotdEligible.find(i => i.parfumId === parfumId);
    if (item) { hapticsLight(); setTodaySotd(item).catch(() => {}); }
    setSotdPickerVisible(false);
  }, [sotd, sotdEligible, setTodaySotd]);

  const handleShareSotd = useCallback(() => {
    if (!sotd) return;
    hapticsLight();
    const url = parfumShareUrl(sotd.parfumId);
    const text = `Aujourd’hui je porte ${sotd.marque} – ${sotd.nom}`;
    if (Platform.OS === 'ios') Share.share({ url, message: text }).catch(() => {});
    else Share.share({ message: `${text}\n${url}` }).catch(() => {});
  }, [sotd]);

  const handleAnchorLayout = useCallback((y: number, h: number) => {
    setSotdHeroAnchor(y + h);
  }, []);

  const handlePlay = useCallback(() => {
    hapticsLight();
    router.push('/runner');
  }, [router]);

  const comm = useMemo(() => dedupCommunity([...top_loved, ...trending]), [top_loved, trending]);
  const seedMerged = useMemo(() => dedupParfums([...topLovedSeed, ...trendingSeed]), [topLovedSeed, trendingSeed]);
  const commParfums = useMemo(() => comm.map(toParfum), [comm]);
  const commLoveTotal = useMemo(() => comm.reduce((sum, c) => sum + (c.love_count ?? 0), 0), [comm]);
  const commLabel = commLoveTotal < 5 ? 'par les premiers nez' : 'par la communauté';

  const commFull = !loading && comm.length >= MIN_ROW_CAROUSEL;
  const commThin = !loading && comm.length >= 1 && comm.length < MIN_ROW_CAROUSEL;
  const showSeedRow = !loading && seedMerged.length > 0;
  const showAnyAir = !loading && (comm.length > 0 || seedMerged.length > 0);

  const hasFollowedActivity = followedVerdicts.length > 0 || followedSotd.length > 0 || followedHave.length > 0;
  const anything = comm.length > 0 || seedMerged.length > 0 || public_profiles.length > 0 || sotd_today.length > 0;

  const myEntry = leaderboard.find((e) => e.isMe) ?? null;

  const weekFamily = useMemo(
    () => OLFACTORY_FAMILIES[Math.floor(Date.now() / WEEK_MS) % OLFACTORY_FAMILIES.length],
    [],
  );

  const timeline = useMemo<TimelineRow[]>(() => {
    const verdicts: TimelineRow[] = followedVerdicts.map((v) => ({
      key: `v-${v.pseudo}-${v.parfum_id}-${v.updated_at}`,
      pseudo: v.pseudo, avatar_url: v.avatar_url, parfum_id: v.parfum_id,
      nom: v.nom, marque: v.marque, image_url: v.image_url,
      mid: verdictVerb(v.verdict), tail: '', date: v.updated_at,
    }));
    const haves: TimelineRow[] = followedHave.map((h) => ({
      key: `h-${h.pseudo}-${h.parfum_id}-${h.added_at}`,
      pseudo: h.pseudo, avatar_url: h.avatar_url, parfum_id: h.parfum_id,
      nom: h.nom, marque: h.marque, image_url: h.image_url,
      mid: ' a ajouté ', tail: ' à sa parfumerie', date: h.added_at,
    }));
    return [...verdicts, ...haves].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  }, [followedVerdicts, followedHave]);

  const handleFamilyExplore = useCallback(() => {
    hapticsLight();
    router.push(`/search?family=${encodeURIComponent(weekFamily.key)}`);
  }, [router, weekFamily.key]);

  const recapPublic = !!profile?.isPublic && !!profile?.pseudo;

  const handleShareRecap = useCallback(() => {
    if (!recap || !profile?.pseudo) return;
    hapticsLight();
    const phrase = recapPhrase(recap);
    const url = profileShareUrl(profile.pseudo);
    const text = `Ma semaine olfactive — ${phrase}.`;
    if (Platform.OS === 'ios') Share.share({ url, message: text }).catch(() => {});
    else Share.share({ message: `${text}\n${url}` }).catch(() => {});
  }, [recap, profile?.pseudo]);

  const handleRecapCta = useCallback(() => {
    if (recapPublic) handleShareRecap();
    else router.push('/profile');
  }, [recapPublic, handleShareRecap, router]);

  const recapCtaLabel = recapPublic ? 'Partager' : 'Rendre public';
  const recapCtaIcon = recapPublic ? 'share-social-outline' : 'chevron-forward';

  return (
    <SafeAreaView edges={['bottom']} style={s.container}>
      <Animated.ScrollView
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={loading || lbLoading} onRefresh={handleRefresh} tintColor={theme.colors.primary} />}
      >
        <View style={s.header}>
          <Text style={s.title}>Communauté</Text>
        </View>

        <Reveal index={0} onLayout={(e) => handleAnchorLayout(e.nativeEvent.layout.y, e.nativeEvent.layout.height)}>
          <TodayHero
            weather={weather}
            weatherLoading={weatherLoading}
            sotd={sotd}
            sotdToday={sotd_today}
            isAuthenticated={isAuthenticated}
            onSotdPress={handleSotdPress}
            onSotdChange={handleSotdChange}
            onShareSotd={handleShareSotd}
            onSotdTodayPress={handleProfilePress}
            styles={s}
            theme={theme}
          />
        </Reveal>

        <Reveal index={1} style={s.challengeCard}>
          <View style={s.challengeTop}>
            <View style={s.challengeIcon}>
              <Ionicons name={weekFamily.icon as never} size={20} color={theme.colors.primary} accessible={false} />
            </View>
            <View style={s.challengeTexts}>
              <Text style={s.challengeOverline}>Le geste de la semaine</Text>
              <Text style={s.challengeTitle} numberOfLines={1}>{weekFamily.label}</Text>
              <Text style={s.challengeTagline} numberOfLines={2} maxFontSizeMultiplier={1.3}>{weekFamily.tagline}</Text>
            </View>
            <Pressable style={({ pressed }) => [s.challengeCta, pressed && s.pressFade]} onPress={handleFamilyExplore} accessibilityRole="button" accessibilityLabel={`Explorer la famille ${weekFamily.label}`}>
              <Text style={s.challengeCtaText}>Explorer</Text>
              <Ionicons name="arrow-forward" size={15} color={theme.colors.primaryInk} accessible={false} />
            </Pressable>
          </View>
        </Reveal>

        {recap && recap.total >= 1 ? (
          <Reveal index={2} style={s.recapCard}>
            <View style={s.recapRow}>
              <View style={s.recapTexts}>
                <Text style={s.recapOverline}>Ta semaine</Text>
                <Text style={s.recapPhrase} numberOfLines={2} maxFontSizeMultiplier={1.3}>{recapPhrase(recap)}</Text>
              </View>
              <Pressable
                style={({ pressed }) => [s.recapCta, pressed && s.pressFade]}
                onPress={handleRecapCta}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                accessibilityRole="button"
                accessibilityLabel={recapPublic ? 'Partager ta semaine olfactive' : 'Rendre ton profil public pour partager ta semaine'}
              >
                <Text style={s.recapCtaText}>{recapCtaLabel}</Text>
                <Ionicons name={recapCtaIcon as never} size={15} color={theme.colors.primary} accessible={false} />
              </Pressable>
            </View>
          </Reveal>
        ) : null}

        <View style={s.section}>
          <SectionHeader style={s.sectionHeader} title="Les nez" subtitle="Trouve et suis des passionnés" icon="people-outline" tint="primary" tintBg="primarySoft" />
          <View style={s.pseudoRow}>
            <Ionicons name="person-outline" size={16} color={theme.colors.textMuted} accessible={false} />
            <TextInput
              style={s.pseudoInput}
              value={pseudoQuery}
              onChangeText={handlePseudoChange}
              placeholder="Chercher un pseudo…"
              placeholderTextColor={theme.colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              onSubmitEditing={handlePseudoSearch}
              keyboardAppearance={keyboardAppearance}
            />
            {pseudoQuery.length > 0 ? (
              <Pressable onPress={() => { setPseudoQuery(''); setSuggestions([]); }} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                <Ionicons name="close-circle" size={16} color={theme.colors.textMuted} />
              </Pressable>
            ) : null}
          </View>
          {suggestions.length > 0 ? (
            <View style={s.suggestionsBox}>
              {suggestions.map((sg) => (
                <Pressable key={sg.pseudo} style={s.suggestionRow} onPress={() => handleSuggestionPress(sg.pseudo)} accessibilityRole="button">
                  {sg.avatar_url ? (
                    <Image source={{ uri: sg.avatar_url }} style={s.suggestionAvatar} contentFit="cover" transition={200} />
                  ) : (
                    <View style={[s.suggestionAvatar, s.suggestionAvatarPlaceholder]}>
                      <Text allowFontScaling={false} style={s.suggestionInitial}>{sg.pseudo.charAt(0).toUpperCase()}</Text>
                    </View>
                  )}
                  <Text style={s.suggestionPseudo}>@{sg.pseudo}</Text>
                  <Text style={s.suggestionCount} allowFontScaling={false}>{sg.collection_count}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          {isAuthenticated && hasFollowedActivity ? (
            <View style={s.followedBlock}>
              <Text style={s.subLabel}>Activité de tes suivis</Text>
              {followedSotd.length > 0 ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.hRow}>
                  {followedSotd.map((item) => (
                    <SotdCard key={`f-${item.pseudo}-${item.parfum_id}`} item={item} styles={s} theme={theme} onPress={() => handleProfilePress(item.pseudo)} />
                  ))}
                </ScrollView>
              ) : null}
              {timeline.map((row) => (
                <Pressable key={row.key} style={s.activityRow} onPress={() => handleParfumPress({ parfum_id: row.parfum_id, nom: row.nom, marque: row.marque, image_url: row.image_url, famille_olfactive: null, best_price: null })} accessibilityRole="button">
                  {row.avatar_url ? (
                    <Image source={{ uri: row.avatar_url }} style={s.activityAvatar} contentFit="cover" transition={200} />
                  ) : (
                    <View style={[s.activityAvatar, s.activityAvatarPlaceholder]}>
                      <Text allowFontScaling={false} style={s.activityInitial}>{row.pseudo.charAt(0).toUpperCase()}</Text>
                    </View>
                  )}
                  <Text style={s.activityText} numberOfLines={2} maxFontSizeMultiplier={1.3}>
                    <Text style={s.activityPseudo}>@{row.pseudo}</Text>
                    {row.mid}
                    <Text style={s.activityParfum}>{row.marque} {row.nom}</Text>
                    {row.tail}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          {public_profiles.length >= MIN_ROW_GRID ? (
            <View style={s.profilesBlock}>
              <Text style={s.subLabel}>Collections à découvrir</Text>
              <View style={s.profilesGrid}>
                {public_profiles.map((p) => (
                  <ProfileCard key={p.pseudo} profile={p} styles={s} theme={theme} onPress={() => handleProfilePress(p.pseudo)} />
                ))}
              </View>
            </View>
          ) : null}
        </View>

        {loading ? (
          <ActivityIndicator style={s.loader} color={theme.colors.primary} />
        ) : error ? (
          <View style={s.stateWrap}>
            <Text style={s.stateText}>{error}</Text>
          </View>
        ) : (!anything && !seedLoading) ? (
          <Animated.View style={s.stateWrap} entering={reducedMotion ? undefined : FadeIn.duration(320)}>
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
          </Animated.View>
        ) : showAnyAir ? (
          <View style={s.section}>
            <SectionHeader style={s.sectionHeader} title="L’air du temps" subtitle="Ce qui se porte et se convoite" icon="trending-up-outline" tint="primary" tintBg="primarySoft" />
            {commFull ? (
              <View style={s.subSection}>
                <Text style={s.subLabel}>{commLabel}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.hRow}>
                  {commParfums.map((p, i) => (
                    <View key={p.id} style={s.cardWrap}>
                      <ParfumCard parfum={p} mode="carousel" hidePrice socialLoves={comm[i].love_count ?? undefined} onPressOverride={() => handleParfumPress(comm[i])} />
                    </View>
                  ))}
                </ScrollView>
              </View>
            ) : (
              <>
                {commThin ? (
                  <View style={s.subSection}>
                    <Text style={s.subLabel}>{commLabel}</Text>
                    {USE_FEATURED_ROWS ? commParfums.map((p, i) => (
                      <View key={p.id} style={s.featuredRow}>
                        <ParfumCard parfum={p} mode="list" hidePrice socialLoves={comm[i].love_count ?? undefined} onPressOverride={() => handleParfumPress(comm[i])} />
                      </View>
                    )) : null}
                  </View>
                ) : null}
                {showSeedRow ? (
                  <View style={s.subSection}>
                    <Text style={s.subLabel}>La sélection de la maison</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.hRow}>
                      {seedMerged.map((p) => (
                        <View key={p.id} style={s.cardWrap}>
                          <ParfumCard parfum={p} mode="carousel" hidePrice onPressOverride={() => handleSeedPress(p)} />
                        </View>
                      ))}
                    </ScrollView>
                  </View>
                ) : null}
              </>
            )}
          </View>
        ) : null}

        <RunnerFooter entry={myEntry} loading={lbLoading} onPress={handlePlay} styles={s} theme={theme} />
      </Animated.ScrollView>

      <SOTDPicker
        visible={sotdPickerVisible}
        haveItems={sotdEligible}
        currentSotdId={sotd?.parfumId ?? null}
        anchorTop={sotdHeroAnchor}
        weather={weather}
        onSelect={handleSotdSelect}
        onClose={() => setSotdPickerVisible(false)}
      />
    </SafeAreaView>
  );
}

function Reveal({ index, children, style, onLayout }: { index: number; children: ReactNode; style?: ViewStyle; onLayout?: (e: LayoutChangeEvent) => void }) {
  const reduced = useReducedMotion();
  return (
    <Animated.View style={style} onLayout={onLayout} entering={reduced ? undefined : FadeInDown.delay(index * 70).duration(420)}>
      {children}
    </Animated.View>
  );
}

function TodayHero({
  weather, weatherLoading, sotd, sotdToday, isAuthenticated,
  onSotdPress, onSotdChange, onShareSotd, onSotdTodayPress, styles: s, theme,
}: {
  weather: WeatherData | null;
  weatherLoading: boolean;
  sotd: SotdEntry | null;
  sotdToday: CommunitySotd[];
  isAuthenticated: boolean;
  onSotdPress: () => void;
  onSotdChange: () => void;
  onShareSotd: () => void;
  onSotdTodayPress: (pseudo: string) => void;
  styles: ReturnType<typeof getStyles>;
  theme: Theme;
}) {
  const showWeather = weather !== null && !weatherLoading;
  const wmo = showWeather ? getWmoMeta((weather as WeatherData).weatherCode) : null;
  const iconName = wmo
    ? (weather as WeatherData).isDay
      ? wmo.icon
      : NIGHT_ICON[wmo.icon] ?? wmo.icon
    : null;

  const meItem: CommunitySotd | null = isAuthenticated && sotd
    ? { pseudo: 'moi', avatar_url: null, parfum_id: sotd.parfumId, nom: sotd.nom, marque: sotd.marque, image_url: sotd.imageUrl }
    : null;
  const showRow = sotdToday.length > 0;

  return (
    <View style={s.heroCard}>
      <View style={s.heroTop}>
        <View style={s.heroTitles}>
          <Text style={s.heroTitle}>L’air du jour</Text>
          <Text style={s.heroEditorial}>Ce que la journée porte.</Text>
        </View>
        {showWeather && wmo && iconName ? (
          <View style={s.heroWeather}>
            <Ionicons name={iconName as never} size={15} color={theme.colors.primary} accessible={false} />
            <Text allowFontScaling={false} style={s.heroTemp}>
              {Math.round((weather as WeatherData).temperature)}
              <Text style={s.heroDegree}>°</Text>
            </Text>
            <Text style={s.heroWeatherLabel} numberOfLines={1}>{wmo.label}</Text>
          </View>
        ) : null}
      </View>

      {showRow ? <Text style={s.heroTodayLabel}>Portés aujourd’hui</Text> : null}

      {showRow ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.hRow}>
          {meItem ? (
            <SotdCard key="me" item={meItem} isMe styles={s} theme={theme} onPress={onSotdPress} />
          ) : null}
          {sotdToday.map((item) => (
            <SotdCard key={`${item.pseudo}-${item.parfum_id}`} item={item} styles={s} theme={theme} onPress={() => onSotdTodayPress(item.pseudo)} />
          ))}
        </ScrollView>
      ) : null}

      {isAuthenticated ? (
        <Pressable
          style={({ pressed }) => [s.heroMeLine, pressed && s.pressFade]}
          onPress={sotd ? onSotdPress : onSotdChange}
          onLongPress={sotd ? onShareSotd : undefined}
          delayLongPress={400}
          accessibilityRole="button"
          accessibilityLabel={sotd ? `Ton parfum du jour : ${sotd.nom} ${sotd.marque}. Appuie longuement pour partager.` : 'Choisir ton parfum du jour'}
        >
          <View style={s.heroMeThumbWrap}>
            {sotd?.imageUrl ? (
              <Image source={{ uri: sotd.imageUrl }} style={s.heroMeThumb} contentFit="contain" transition={200} />
            ) : (
              <Ionicons name={sotd ? 'flask-outline' : 'add-circle-outline'} size={16} color={theme.colors.primaryInk} accessible={false} />
            )}
          </View>
          <Text style={s.heroMeLineText} numberOfLines={1}>
            {sotd ? `Aujourd’hui tu portes ${sotd.nom}` : 'Choisis ton parfum du jour'}
          </Text>
          <Ionicons name="chevron-forward" size={16} color={theme.colors.textMuted} accessible={false} />
        </Pressable>
      ) : sotdToday.length === 0 ? (
        <Text style={s.heroTodayEmpty}>Les premiers flacons du jour apparaîtront ici.</Text>
      ) : null}
    </View>
  );
}

function SotdCard({ item, isMe, styles: s, theme, onPress }: { item: CommunitySotd; isMe?: boolean; styles: ReturnType<typeof getStyles>; theme: Theme; onPress: () => void }) {
  return (
    <Pressable style={s.sotdCard} onPress={onPress} accessibilityRole="button" accessibilityLabel={isMe ? `Toi : ${item.nom}` : `${item.pseudo} porte ${item.nom}`}>
      <View style={s.sotdImgWrap}>
        {item.image_url ? (
          <Image source={{ uri: item.image_url }} style={s.sotdImg} contentFit="contain" transition={200} />
        ) : (
          <View style={[s.sotdImg, s.sotdImgPlaceholder]}>
            <Ionicons name="flask-outline" size={20} color={theme.colors.textMuted} />
          </View>
        )}
        {isMe ? (
          <View style={s.sotdMeBadge}>
            <Text allowFontScaling={false} style={s.sotdMeBadgeText}>Toi</Text>
          </View>
        ) : null}
      </View>
      <Text style={s.sotdName} numberOfLines={1}>{item.nom}</Text>
      <Text style={s.sotdPseudo} numberOfLines={1}>{isMe ? 'ton parfum' : `@${item.pseudo}`}</Text>
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

function RunnerFooter({ entry, loading, onPress, styles: s, theme }: { entry: LeaderboardEntry | null; loading: boolean; onPress: () => void; styles: ReturnType<typeof getStyles>; theme: Theme }) {
  const sub = loading
    ? 'Chargement…'
    : entry
      ? `Ton rang #${entry.rank} · ${entry.score} pts`
      : 'Lance une partie';
  return (
    <Pressable style={({ pressed }) => [s.runnerFooter, pressed && s.pressFade]} onPress={onPress} accessibilityRole="button" accessibilityLabel={`Flacon Runner, ${entry ? `ton rang ${entry.rank}, ${entry.score} points` : 'aucune partie jouée'}. Jouer`}>
      <Ionicons name="game-controller-outline" size={16} color={theme.colors.textMuted} accessible={false} />
      <View style={s.runnerFooterText}>
        <Text style={s.runnerFooterTitle}>Flacon Runner</Text>
        <Text style={s.runnerFooterSub} numberOfLines={1} allowFontScaling={false}>{sub}</Text>
      </View>
      <Text style={s.runnerFooterCta}>Jouer</Text>
      <Ionicons name="chevron-forward" size={16} color={theme.colors.primary} accessible={false} />
    </Pressable>
  );
}

function getStyles(t: Theme) {
  return {
    container: { flex: 1, backgroundColor: t.colors.background },
    content: { paddingBottom: 40 },
    header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
    title: { fontFamily: 'PlayfairDisplay_700Bold', fontSize: 28, color: t.colors.text },

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
    pressFade: { opacity: 0.7 },

    section: { marginTop: 24 },
    sectionHeader: { paddingHorizontal: 16 },
    subSection: { marginTop: 16 },
    subLabel: { fontFamily: 'Inter_500Medium', fontSize: 12, color: t.colors.textMuted, marginHorizontal: 16, marginBottom: 10 },
    hRow: { paddingHorizontal: 16, gap: 10 },
    cardWrap: { width: 140 },
    featuredRow: { marginHorizontal: 16, marginTop: 8 },

    heroCard: {
      backgroundColor: t.colors.surface, borderRadius: t.radius.card,
      marginHorizontal: 16, marginTop: 4, padding: 14, ...t.shadow.card,
    },
    heroTop: { flexDirection: 'row' as const, alignItems: 'flex-start' as const, justifyContent: 'space-between' as const, gap: 12 },
    heroTitles: { flex: 1, minWidth: 0 },
    heroTitle: { fontFamily: 'PlayfairDisplay_600SemiBold', fontSize: 20, lineHeight: 24, color: t.colors.text },
    heroEditorial: { fontFamily: 'PlayfairDisplay_700Bold_Italic', fontSize: 15, color: t.colors.textMuted, marginTop: 2 },
    heroWeather: {
      flexDirection: 'row' as const, alignItems: 'center' as const, gap: 4, flexShrink: 0,
      backgroundColor: t.colors.surface2, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5,
    },
    heroTemp: { fontFamily: 'Inter_700Bold', fontSize: 13, color: t.colors.text, fontVariant: ['tabular-nums'] as import('react-native').FontVariant[] },
    heroDegree: { fontFamily: 'Inter_500Medium', fontSize: 11, color: t.colors.textMuted },
    heroWeatherLabel: { fontFamily: 'Inter_400Regular', fontSize: 11, color: t.colors.textMuted, maxWidth: 70 },

    heroTodayLabel: { fontFamily: 'Inter_500Medium', fontSize: 11, textTransform: 'uppercase' as const, letterSpacing: 1, color: t.colors.textMuted, marginTop: 14, marginBottom: 10 },
    heroTodayEmpty: { fontFamily: 'Inter_400Regular', fontSize: 13, color: t.colors.textMuted, paddingVertical: 4 },

    heroMeLine: {
      flexDirection: 'row' as const, alignItems: 'center' as const, gap: 10,
      marginTop: 10, paddingVertical: 6, minHeight: 44,
      borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.colors.border,
    },
    heroMeThumbWrap: {
      width: 32, height: 32, borderRadius: 8, backgroundColor: t.colors.primarySoft,
      justifyContent: 'center' as const, alignItems: 'center' as const, overflow: 'hidden' as const,
    },
    heroMeThumb: { width: 32, height: 32, borderRadius: 8 },
    heroMeLineText: { flex: 1, fontFamily: 'Inter_500Medium', fontSize: 13, color: t.colors.text },

    challengeCard: {
      backgroundColor: t.colors.surface, borderRadius: t.radius.card,
      marginHorizontal: 16, marginTop: 16, padding: 14, ...t.shadow.card,
    },
    challengeTop: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 12 },
    challengeIcon: {
      width: 40, height: 40, borderRadius: 20, backgroundColor: t.colors.primarySoft,
      justifyContent: 'center' as const, alignItems: 'center' as const,
    },
    challengeTexts: { flex: 1, minWidth: 0 },
    challengeOverline: { fontFamily: 'Inter_500Medium', fontSize: 10, textTransform: 'uppercase' as const, letterSpacing: 1, color: t.colors.textMuted },
    challengeTitle: { fontFamily: 'PlayfairDisplay_600SemiBold', fontSize: 18, color: t.colors.text, marginTop: 2 },
    challengeTagline: { fontFamily: 'Inter_400Regular', fontSize: 13, color: t.colors.textMuted, lineHeight: 18, marginTop: 2 },
    challengeCta: {
      flexShrink: 0, flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6,
      minHeight: 44, paddingHorizontal: 12, borderRadius: t.radius.base, backgroundColor: t.colors.primarySoft,
    },
    challengeCtaText: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: t.colors.primaryInk },

    recapCard: {
      backgroundColor: t.colors.surface, borderRadius: t.radius.card,
      marginHorizontal: 16, marginTop: 16, padding: 14, ...t.shadow.card,
    },
    recapRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 10 },
    recapTexts: { flex: 1, minWidth: 0 },
    recapOverline: { fontFamily: 'Inter_500Medium', fontSize: 10, textTransform: 'uppercase' as const, letterSpacing: 1, color: t.colors.textMuted },
    recapPhrase: { fontFamily: 'Inter_400Regular', fontSize: 13, color: t.colors.text, lineHeight: 18, marginTop: 3 },
    recapCta: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'flex-end' as const, gap: 6, minWidth: 124, paddingHorizontal: 8, paddingVertical: 8, flexShrink: 0 },
    recapCtaText: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: t.colors.primary },

    pseudoRow: {
      flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8,
      marginHorizontal: 16, paddingHorizontal: 12, height: 44,
      backgroundColor: t.colors.surface2, borderRadius: t.radius.base,
    },
    pseudoInput: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 14, color: t.colors.text, padding: 0 },

    followedBlock: { marginTop: 18 },
    profilesBlock: { marginTop: 18 },

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
    sotdImgWrap: { width: 72, height: 96, position: 'relative' as const },
    sotdImg: { width: 72, height: 96, borderRadius: 8, backgroundColor: t.colors.surface },
    sotdImgPlaceholder: { justifyContent: 'center' as const, alignItems: 'center' as const },
    sotdMeBadge: {
      position: 'absolute' as const, top: 4, left: 4, backgroundColor: t.colors.primary,
      borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2,
    },
    sotdMeBadgeText: { fontFamily: 'Inter_600SemiBold', fontSize: 9, color: '#FFFFFF' },
    sotdName: { fontFamily: 'Inter_500Medium', fontSize: 11, color: t.colors.text, marginTop: 6, textAlign: 'center' as const },
    sotdPseudo: { fontFamily: 'Inter_400Regular', fontSize: 10, color: t.colors.textMuted, marginTop: 2 },

    activityRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 10, marginHorizontal: 16, paddingVertical: 10 },
    activityAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: t.colors.surface2 },
    activityAvatarPlaceholder: { justifyContent: 'center' as const, alignItems: 'center' as const, backgroundColor: t.colors.primarySoft },
    activityInitial: { fontFamily: 'Inter_700Bold', fontSize: 13, color: t.colors.primaryInk },
    activityText: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 13, color: t.colors.textMuted, lineHeight: 18 },
    activityPseudo: { fontFamily: 'Inter_600SemiBold', color: t.colors.text },
    activityParfum: { fontFamily: 'Inter_500Medium', color: t.colors.text },

    suggestionsBox: { marginHorizontal: 16, marginTop: 4, backgroundColor: t.colors.surface, borderRadius: t.radius.base, borderWidth: 1, borderColor: t.colors.border, overflow: 'hidden' as const },
    suggestionRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 10, paddingHorizontal: 12, paddingVertical: 10 },
    suggestionAvatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: t.colors.surface2 },
    suggestionAvatarPlaceholder: { justifyContent: 'center' as const, alignItems: 'center' as const, backgroundColor: t.colors.primarySoft },
    suggestionInitial: { fontFamily: 'Inter_700Bold', fontSize: 12, color: t.colors.primaryInk },
    suggestionPseudo: { flex: 1, fontFamily: 'Inter_500Medium', fontSize: 14, color: t.colors.text },
    suggestionCount: { fontFamily: 'Inter_400Regular', fontSize: 12, color: t.colors.textMuted },

    runnerFooter: {
      flexDirection: 'row' as const, alignItems: 'center' as const, gap: 10,
      marginHorizontal: 16, marginTop: 24, paddingVertical: 12, minHeight: 44,
      borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.colors.border,
    },
    runnerFooterText: { flex: 1, minWidth: 0 },
    runnerFooterTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: t.colors.text },
    runnerFooterSub: { fontFamily: 'Inter_400Regular', fontSize: 11, color: t.colors.textMuted, marginTop: 1, fontVariant: ['tabular-nums'] as never },
    runnerFooterCta: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: t.colors.primary },
  } as const;
}
