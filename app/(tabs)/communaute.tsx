import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, ActivityIndicator, RefreshControl, Platform, Share, StyleSheet, type LayoutChangeEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { useAnimatedScrollHandler } from 'react-native-reanimated';
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
import { useNetwork } from '../../src/hooks/useNetwork';
import { getFollowedHighlights, searchProfiles, type CommunityParfum, type CommunityProfile, type CommunitySotd, type FollowedVerdict, type FollowedHave, type ProfileSearchResult } from '../../src/services/community';
import { getRunnerLeaderboard, type LeaderboardEntry } from '../../src/services/runner';
import { setPendingParfum } from '../../src/services/catalog-bridge';
import { normalizePseudo, parfumShareUrl } from '../../src/utils/share';
import { getWmoMeta } from '../../src/utils/weather-codes';
import { scoreWardrobeItemForWeather } from '../../src/utils/weather-scoring';
import { hapticsLight } from '../../src/services/haptics';
import ParfumCard from '../../src/components/ParfumCard';
import SectionHeader from '../../src/components/SectionHeader';
import SOTDPicker from '../../src/features/wardrobe/SOTDPicker';
import type { Parfum } from '../../src/models';
import type { WeatherData } from '../../src/services/weather';
import type { SotdEntry } from '../../src/models/user-parfum.interface';

const NIGHT_ICON: Record<string, string> = {
  sunny: 'moon',
  'partly-sunny': 'cloudy-night',
};

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
  const { user, isAuthenticated } = useAuthContext();
  const uid = user?.uid ?? null;
  const { scrollY } = useNavigationChrome();
  const { top_loved, trending, public_profiles, sotd_today, loading, error, refresh } = useCommunityHighlights();
  const { isOnline } = useNetwork();
  const { sotd, setTodaySotd } = useSotd(isAuthenticated ? uid : null);
  const { weather, loading: weatherLoading } = useWeather(isAuthenticated && isOnline);
  const { items } = useUserParfumContext();

  const [pseudoQuery, setPseudoQuery] = useState('');
  const [suggestions, setSuggestions] = useState<ProfileSearchResult[]>([]);
  const [followedVerdicts, setFollowedVerdicts] = useState<FollowedVerdict[]>([]);
  const [followedSotd, setFollowedSotd] = useState<CommunitySotd[]>([]);
  const [followedHave, setFollowedHave] = useState<FollowedHave[]>([]);
  const [sotdPickerVisible, setSotdPickerVisible] = useState(false);
  const [sotdHeroAnchor, setSotdHeroAnchor] = useState(0);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [lbLoading, setLbLoading] = useState(false);
  const mountedRef = useRef(true);
  const suggestTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const keyboardAppearance = resolvedMode === 'dark' ? 'dark' : 'light';

  useEffect(() => {
    mountedRef.current = true;
    if (!isAuthenticated) return;
    getFollowedHighlights().then((d) => {
      if (!mountedRef.current || !d) return;
      setFollowedVerdicts(d.recent_verdicts);
      setFollowedSotd(d.sotd_today);
      setFollowedHave(d.new_have);
    }).catch((e: unknown) => { console.warn('[communaute] followed highlights failed:', (e as Error)?.message ?? String(e)); });
    return () => { mountedRef.current = false; if (suggestTimer.current) clearTimeout(suggestTimer.current); };
  }, [isAuthenticated]);

  const loadLeaderboard = useCallback((force = false) => {
    setLbLoading(true);
    getRunnerLeaderboard(50, force)
      .then((rows) => { if (mountedRef.current) setLeaderboard(rows); })
      .catch((e: unknown) => { console.warn('[communaute] leaderboard failed:', (e as Error)?.message ?? String(e)); })
      .finally(() => { if (mountedRef.current) setLbLoading(false); });
  }, []);

  useEffect(() => { loadLeaderboard(); }, [loadLeaderboard]);

  const handleRefresh = useCallback(() => {
    refresh();
    loadLeaderboard(true);
  }, [refresh, loadLeaderboard]);

  const scrollHandler = useAnimatedScrollHandler((e) => { scrollY.value = e.contentOffset.y; });

  const sotdEligible = useMemo(() => items.filter(i => i.status === 'have'), [items]);
  const sotdScore = useMemo(() => {
    if (!weather || !sotd) return null;
    const it = items.find(i => i.parfumId === sotd.parfumId);
    return it ? scoreWardrobeItemForWeather(it, weather) : null;
  }, [items, weather, sotd]);

  const handleParfumPress = useCallback((cp: CommunityParfum) => {
    setPendingParfum(toParfum(cp));
    router.push(`/catalog/${cp.parfum_id}`);
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

  const handleHeroLayout = useCallback((e: LayoutChangeEvent) => {
    setSotdHeroAnchor(e.nativeEvent.layout.y + e.nativeEvent.layout.height);
  }, []);

  const handlePlay = useCallback(() => {
    hapticsLight();
    router.push('/runner');
  }, [router]);

  const hasContent = top_loved.length > 0 || trending.length > 0 || public_profiles.length > 0 || sotd_today.length > 0;

  const topLovedParfums = useMemo(() => top_loved.map(toParfum), [top_loved]);
  const trendingParfums = useMemo(() => trending.map(toParfum), [trending]);

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

        <View style={s.searchRow}>
          <Ionicons name="search-outline" size={16} color={theme.colors.textMuted} />
          <TextInput
            style={s.searchInput}
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

        <View onLayout={handleHeroLayout}>
          <TodayHero
            weather={weather}
            weatherLoading={weatherLoading}
            sotd={sotd}
            sotdScore={sotdScore}
            sotdToday={sotd_today}
            isAuthenticated={isAuthenticated}
            onSotdPress={handleSotdPress}
            onSotdChange={handleSotdChange}
            onShareSotd={handleShareSotd}
            onSotdTodayPress={handleProfilePress}
            styles={s}
            theme={theme}
          />
        </View>

        <View style={s.section}>
          <SectionHeader title="Flacon Runner" subtitle="Le classement" actionLabel="Jouer" onAction={handlePlay} />
          {lbLoading && leaderboard.length === 0 ? (
            <ActivityIndicator style={s.lbLoader} color={theme.colors.primary} />
          ) : leaderboard.length === 0 ? (
            <Pressable style={s.lbEmpty} onPress={handlePlay} accessibilityRole="button">
              <Ionicons name="game-controller-outline" size={24} color={theme.colors.primary} />
              <Text style={s.lbEmptyText}>Sois le premier au classement — lance une partie.</Text>
            </Pressable>
          ) : (
            <View style={s.lbList}>
              {leaderboard.slice(0, 10).map((e) => (
                <LeaderboardRow
                  key={e.pseudo ?? `rank-${e.rank}`}
                  entry={e}
                  isMe={e.isMe}
                  styles={s}
                  theme={theme}
                  onPress={e.pseudo ? () => handleProfilePress(e.pseudo as string) : undefined}
                />
              ))}
            </View>
          )}
        </View>

        {loading ? (
          <ActivityIndicator style={s.loader} color={theme.colors.primary} />
        ) : error ? (
          <View style={s.stateWrap}>
            <Text style={s.stateText}>{error}</Text>
          </View>
        ) : (
          <>
            {isAuthenticated && (followedVerdicts.length > 0 || followedSotd.length > 0 || followedHave.length > 0) ? (
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
                      {v.verdict === 'love' ? ' adore ' : v.verdict === 'like' ? ' aime ' : v.verdict === 'meh' ? ' mitigé sur ' : ' n’aime pas '}
                      <Text style={s.activityParfum}>{v.marque} {v.nom}</Text>
                    </Text>
                  </Pressable>
                ))}
                {followedHave.map((h, i) => (
                  <Pressable key={`h-${h.pseudo}-${h.parfum_id}-${i}`} style={s.activityRow} onPress={() => handleParfumPress({ parfum_id: h.parfum_id, nom: h.nom, marque: h.marque, image_url: h.image_url, famille_olfactive: null, best_price: null })} accessibilityRole="button">
                    {h.avatar_url ? (
                      <Image source={{ uri: h.avatar_url }} style={s.activityAvatar} contentFit="cover" transition={200} />
                    ) : (
                      <View style={[s.activityAvatar, s.activityAvatarPlaceholder]}>
                        <Text allowFontScaling={false} style={s.activityInitial}>{h.pseudo.charAt(0).toUpperCase()}</Text>
                      </View>
                    )}
                    <Text style={s.activityText} numberOfLines={2} maxFontSizeMultiplier={1.3}>
                      <Text style={s.activityPseudo}>@{h.pseudo}</Text>
                      {' a ajouté '}
                      <Text style={s.activityParfum}>{h.marque} {h.nom}</Text>
                      {' à sa parfumerie'}
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
                {top_loved.length > 0 ? (
                  <View style={s.section}>
                    <SectionHeader title="Les plus aimés" subtitle="Par la communauté" />
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.hRow}>
                      {topLovedParfums.map((p, i) => (
                        <View key={p.id} style={s.cardWrap}>
                          <ParfumCard parfum={p} mode="carousel" onPressOverride={() => handleParfumPress(top_loved[i])} />
                        </View>
                      ))}
                    </ScrollView>
                  </View>
                ) : null}

                {trending.length > 0 ? (
                  <View style={s.section}>
                    <SectionHeader title="Tendances" subtitle="Cette semaine" />
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.hRow}>
                      {trendingParfums.map((p, i) => (
                        <View key={p.id} style={s.cardWrap}>
                          <ParfumCard parfum={p} mode="carousel" onPressOverride={() => handleParfumPress(trending[i])} />
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

function TodayHero({
  weather, weatherLoading, sotd, sotdScore, sotdToday, isAuthenticated,
  onSotdPress, onSotdChange, onShareSotd, onSotdTodayPress, styles: s, theme,
}: {
  weather: WeatherData | null;
  weatherLoading: boolean;
  sotd: SotdEntry | null;
  sotdScore: number | null;
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
  const showScore = typeof sotdScore === 'number' && !isNaN(sotdScore) && sotdScore >= 50;
  const scColor = showScore
    ? (sotdScore as number) >= 70 ? theme.colors.deal : (sotdScore as number) >= 40 ? theme.colors.fair : theme.colors.textMuted
    : theme.colors.textMuted;

  const wmo = showWeather ? getWmoMeta((weather as WeatherData).weatherCode) : null;
  const iconName = wmo
    ? (weather as WeatherData).isDay
      ? wmo.icon
      : NIGHT_ICON[wmo.icon] ?? wmo.icon
    : null;

  if (!showWeather && !isAuthenticated && sotdToday.length === 0) return null;

  return (
    <View style={s.heroCard}>
      <View style={s.heroTop}>
        <View style={s.heroTitles}>
          <Text style={s.heroTitle}>Aujourd’hui</Text>
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

      {isAuthenticated ? (
        <View style={s.heroMeRow}>
          <Pressable
            style={s.heroMeMain}
            onPress={sotd ? onSotdPress : onSotdChange}
            onLongPress={sotd ? onShareSotd : undefined}
            delayLongPress={400}
            accessibilityRole="button"
            accessibilityLabel={sotd ? `Ton parfum du jour : ${sotd.nom} ${sotd.marque}` : 'Choisir ton parfum du jour'}
          >
            <View style={s.heroMeThumbWrap}>
              {sotd?.imageUrl ? (
                <Image source={{ uri: sotd.imageUrl }} style={s.heroMeThumb} contentFit="contain" transition={200} />
              ) : (
                <Ionicons name={sotd ? 'flask-outline' : 'sunny-outline'} size={16} color={sotd ? theme.colors.primaryInk : theme.colors.secondary} accessible={false} />
              )}
            </View>
            <View style={s.heroMeInfo}>
              {sotd ? (
                <>
                  <Text style={s.heroMeName} numberOfLines={1}>{sotd.nom}</Text>
                  <Text style={s.heroMeBrand} numberOfLines={1}>{sotd.marque}</Text>
                </>
              ) : (
                <Text style={s.heroMeCta}>Choisis ton parfum du jour</Text>
              )}
            </View>
            {showScore ? (
              <View style={[s.heroMeScore, { backgroundColor: (sotdScore as number) >= 70 ? theme.colors.dealSoft : (sotdScore as number) >= 40 ? theme.colors.fairSoft : theme.colors.surface2 }]}>
                <Text allowFontScaling={false} style={[s.heroMeScoreText, { color: scColor }]}>{sotdScore}%</Text>
              </View>
            ) : null}
          </Pressable>
          {sotd ? (
            <Pressable onPress={onShareSotd} hitSlop={8} style={s.heroMeBtn} accessibilityRole="button" accessibilityLabel="Partager ton parfum du jour">
              <Ionicons name="share-social-outline" size={16} color={theme.colors.primary} />
            </Pressable>
          ) : null}
          <Pressable onPress={onSotdChange} hitSlop={8} style={s.heroMeBtn} accessibilityRole="button" accessibilityLabel="Changer ton parfum du jour">
            <Ionicons name={sotd ? 'swap-horizontal-outline' : 'add-circle-outline'} size={16} color={theme.colors.primary} />
          </Pressable>
        </View>
      ) : null}

      <View style={s.heroDivider} />

      {sotdToday.length > 0 ? (
        <>
          <Text style={s.heroTodayLabel}>Portés aujourd’hui</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.hRow}>
            {sotdToday.map((item) => (
              <SotdCard key={`${item.pseudo}-${item.parfum_id}`} item={item} styles={s} theme={theme} onPress={() => onSotdTodayPress(item.pseudo)} />
            ))}
          </ScrollView>
        </>
      ) : isAuthenticated ? (
        <Pressable style={s.heroTodayCta} onPress={onSotdChange} accessibilityRole="button" accessibilityLabel="Partager ton parfum du jour">
          <Ionicons name="add-circle-outline" size={15} color={theme.colors.primary} />
          <Text style={s.heroTodayCtaText}>Partage le tien</Text>
        </Pressable>
      ) : (
        <Text style={s.heroTodayEmpty}>Les premiers flacons du jour apparaîtront ici.</Text>
      )}
    </View>
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

function LeaderboardRow({ entry, isMe, styles: s, theme, onPress }: { entry: LeaderboardEntry; isMe: boolean; styles: ReturnType<typeof getStyles>; theme: Theme; onPress?: () => void }) {
  const label = entry.pseudo ?? 'Nez anonyme';
  const content = (
    <>
      <Text allowFontScaling={false} style={[s.lbRank, entry.rank <= 3 ? s.lbRankTop : null]}>{entry.rank}</Text>
      {entry.avatarUrl ? (
        <Image source={{ uri: entry.avatarUrl }} style={s.lbAvatar} contentFit="cover" transition={200} />
      ) : (
        <View style={[s.lbAvatar, s.lbAvatarPlaceholder]}>
          <Text allowFontScaling={false} style={s.lbInitial}>{label.charAt(0).toUpperCase()}</Text>
        </View>
      )}
      <Text style={[s.lbPseudo, isMe ? s.lbPseudoMe : null]} numberOfLines={1}>{isMe ? 'Toi' : `@${label}`}</Text>
      <Text allowFontScaling={false} style={s.lbScore}>{entry.score}</Text>
    </>
  );
  if (onPress) {
    return <Pressable style={[s.lbRow, isMe ? s.lbRowMe : null]} onPress={onPress} accessibilityRole="button" accessibilityLabel={`Rang ${entry.rank}, ${label}, ${entry.score} points`}>{content}</Pressable>;
  }
  return <View style={[s.lbRow, isMe ? s.lbRowMe : null]} accessibilityLabel={`Rang ${entry.rank}, ${label}, ${entry.score} points`}>{content}</View>;
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

    heroCard: {
      backgroundColor: t.colors.surface, borderRadius: t.radius.card,
      marginHorizontal: 16, marginTop: 4, padding: 14, ...t.shadow.card,
    },
    heroTop: { flexDirection: 'row' as const, alignItems: 'flex-start' as const, justifyContent: 'space-between' as const, gap: 12 },
    heroTitles: { flex: 1, minWidth: 0 },
    heroTitle: { fontFamily: 'PlayfairDisplay_600SemiBold', fontSize: 17, color: t.colors.text },
    heroEditorial: { fontFamily: 'PlayfairDisplay_700Bold_Italic', fontSize: 13, color: t.colors.textMuted, marginTop: 1 },
    heroWeather: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 4, flexShrink: 0 },
    heroTemp: { fontFamily: 'Inter_700Bold', fontSize: 14, color: t.colors.text, fontVariant: ['tabular-nums'] as import('react-native').FontVariant[] },
    heroDegree: { fontFamily: 'Inter_500Medium', fontSize: 11, color: t.colors.textMuted },
    heroWeatherLabel: { fontFamily: 'Inter_400Regular', fontSize: 11, color: t.colors.textMuted, maxWidth: 80 },

    heroMeRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8, marginTop: 12 },
    heroMeMain: { flex: 1, flexDirection: 'row' as const, alignItems: 'center' as const, gap: 10, minWidth: 0 },
    heroMeThumbWrap: {
      width: 36, height: 36, borderRadius: 8, backgroundColor: t.colors.primarySoft,
      justifyContent: 'center' as const, alignItems: 'center' as const, overflow: 'hidden' as const,
    },
    heroMeThumb: { width: 36, height: 36, borderRadius: 8 },
    heroMeInfo: { flex: 1, minWidth: 0 },
    heroMeName: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: t.colors.text },
    heroMeBrand: { fontFamily: 'Inter_400Regular', fontSize: 11, color: t.colors.textMuted, marginTop: 1 },
    heroMeCta: { fontFamily: 'Inter_500Medium', fontSize: 13, color: t.colors.primaryInk },
    heroMeScore: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
    heroMeScoreText: { fontFamily: 'Inter_600SemiBold', fontSize: 10 },
    heroMeBtn: { width: 30, height: 30, borderRadius: 15, alignItems: 'center' as const, justifyContent: 'center' as const },

    heroDivider: { height: 1, backgroundColor: t.colors.border, marginVertical: 12, opacity: 0.7 },
    heroTodayLabel: { fontFamily: 'Inter_500Medium', fontSize: 11, textTransform: 'uppercase' as const, letterSpacing: 1, color: t.colors.textMuted, marginBottom: 10 },
    heroTodayCta: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6, paddingVertical: 4 },
    heroTodayCtaText: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: t.colors.primary },
    heroTodayEmpty: { fontFamily: 'Inter_400Regular', fontSize: 13, color: t.colors.textMuted, paddingVertical: 4 },

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

    suggestionsBox: { marginHorizontal: 16, marginTop: 4, backgroundColor: t.colors.surface, borderRadius: t.radius.base, borderWidth: 1, borderColor: t.colors.border, overflow: 'hidden' as const },
    suggestionRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 10, paddingHorizontal: 12, paddingVertical: 10 },
    suggestionAvatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: t.colors.surface2 },
    suggestionAvatarPlaceholder: { justifyContent: 'center' as const, alignItems: 'center' as const, backgroundColor: t.colors.primarySoft },
    suggestionInitial: { fontFamily: 'Inter_700Bold', fontSize: 12, color: t.colors.primaryInk },
    suggestionPseudo: { flex: 1, fontFamily: 'Inter_500Medium', fontSize: 14, color: t.colors.text },
    suggestionCount: { fontFamily: 'Inter_400Regular', fontSize: 12, color: t.colors.textMuted },

    lbLoader: { marginTop: 24 },
    lbEmpty: {
      alignItems: 'center' as const, gap: 8, paddingVertical: 24, marginHorizontal: 16,
      backgroundColor: t.colors.surface, borderRadius: t.radius.card, borderWidth: 1, borderColor: t.colors.border,
    },
    lbEmptyText: { fontFamily: 'Inter_400Regular', fontSize: 13, color: t.colors.textMuted, textAlign: 'center' as const, paddingHorizontal: 24 },
    lbList: { marginHorizontal: 16, backgroundColor: t.colors.surface, borderRadius: t.radius.card, borderWidth: 1, borderColor: t.colors.border, overflow: 'hidden' as const },
    lbRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 10, paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.colors.border },
    lbRowMe: { backgroundColor: t.colors.primarySoft },
    lbRank: { width: 22, fontFamily: 'Inter_700Bold', fontSize: 13, color: t.colors.textMuted, textAlign: 'center' as const, fontVariant: ['tabular-nums'] as never },
    lbRankTop: { color: t.colors.secondary },
    lbAvatar: { width: 30, height: 30, borderRadius: 15, backgroundColor: t.colors.surface2 },
    lbAvatarPlaceholder: { justifyContent: 'center' as const, alignItems: 'center' as const, backgroundColor: t.colors.primarySoft },
    lbInitial: { fontFamily: 'Inter_700Bold', fontSize: 12, color: t.colors.primaryInk },
    lbPseudo: { flex: 1, fontFamily: 'Inter_500Medium', fontSize: 14, color: t.colors.text },
    lbPseudoMe: { fontFamily: 'Inter_700Bold', color: t.colors.primaryInk },
    lbScore: { fontFamily: 'Inter_800ExtraBold', fontSize: 14, color: t.colors.text, fontVariant: ['tabular-nums'] as never },
  } as const;
}
