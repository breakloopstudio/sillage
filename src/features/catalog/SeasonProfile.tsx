import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import Ionicons from '@react-native-vector-icons/ionicons/static';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
  interpolateColor,
  Extrapolation,
  FadeIn,
  useReducedMotion,
} from 'react-native-reanimated';
import { useTheme, type Theme } from '../../theme/ThemeContext';
import { hapticsLight, hapticsSuccess } from '../../services/haptics';
import { alpha } from '../../utils/alpha';
import { SEASON_ORDER, SEASON_META, type SeasonKey } from '../../utils/season';
import {
  type SeasonProfileData,
  type SeasonColumn,
} from '../../utils/season-profile';
import { type UsePerfVotes } from '../../hooks/usePerfVotes';
import { useAuthContext } from '../../contexts/AuthContext';
import VotePickerSheet, { type VoteOption } from '../../components/VotePickerSheet';

interface Props {
  profile: SeasonProfileData;
  perfVotes: UsePerfVotes;
}

export default function SeasonProfile({ profile, perfVotes }: Props) {
  const { theme, resolvedMode } = useTheme();
  const c = theme.colors;
  const s = useMemo(() => getStyles(theme), [theme]);
  const { t } = useTranslation('common');
  const reduced = useReducedMotion();
  const router = useRouter();
  const { user } = useAuthContext();

  const { perf, available, vote, removeVote } = perfVotes;

  // Colonnes recalculées depuis la fusion (frag×poids + user) quand la RPC répond,
  // sinon les colonnes Fragrantica (season_ranking) — la star suit le vécu combiné.
  const { displayColumns, showSeasons } = useMemo(() => {
    if (!available || !perf) {
      return { displayColumns: profile.columns, showSeasons: profile.seasonMax > 0, topKey: profile.topSeasonKey };
    }
    const counts: Record<SeasonKey, number> = {
      spring: perf.season.spring ?? 0,
      summer: perf.season.summer ?? 0,
      fall: perf.season.fall ?? 0,
      winter: perf.season.winter ?? 0,
    };
    const max = Math.max(0, counts.spring, counts.summer, counts.fall, counts.winter);
    if (max === 0) {
      return { displayColumns: profile.columns, showSeasons: profile.seasonMax > 0, topKey: profile.topSeasonKey };
    }
    const cols = profile.columns.map(col => {
      const score = counts[col.key] ?? 0;
      return { ...col, score, ratio: score / max, isTop: score === max };
    });
    const top = SEASON_ORDER.find(k => counts[k] === max) ?? profile.topSeasonKey;
    return { displayColumns: cols, showSeasons: true, topKey: top };
  }, [available, perf, profile.columns, profile.seasonMax, profile.topSeasonKey]);

  // Moment dominant (fusion) ou Fragrantica (fallback)
  const momentDominant = useMemo<'day' | 'night' | null>(() => {
    if (available && perf) {
      const d = perf.dayNight.day ?? 0;
      const n = perf.dayNight.night ?? 0;
      return d === n ? null : n > d ? 'night' : 'day';
    }
    return profile.dayNight;
  }, [available, perf, profile.dayNight]);

  const [active, setActive] = useState<SeasonKey | null>(null);
  const [seasonPickerOpen, setSeasonPickerOpen] = useState(false);
  const anyActive = active !== null;

  const handleSelect = useCallback((key: SeasonKey) => {
    hapticsLight();
    setActive(prev => (prev === key ? null : key));
  }, []);

  const handleOpenSeasonPicker = useCallback(() => {
    if (!user) {
      router.push('/auth/login');
      return;
    }
    hapticsLight();
    setSeasonPickerOpen(true);
  }, [user, router]);

  const handleSeasonPick = useCallback(
    async (key: string) => {
      hapticsLight();
      const ok = await vote('season', key);
      if (ok) hapticsSuccess();
    },
    [vote],
  );

  const handleSeasonRemove = useCallback(() => {
    hapticsLight();
    void removeVote('season');
  }, [removeVote]);

  const handleCloseSeasonPicker = useCallback(() => setSeasonPickerOpen(false), []);

  const handleMomentVote = useCallback(
    async (moment: 'day' | 'night') => {
      if (!user) {
        router.push('/auth/login');
        return;
      }
      hapticsLight();
      const ok = await vote('moment', moment);
      if (ok) hapticsSuccess();
    },
    [user, vote, router],
  );

  const seasonUserVotes = available && perf ? perf.seasonUserVotes : 0;

  const seasonOptions: VoteOption[] = SEASON_ORDER.map(key => ({
    key,
    label: SEASON_META[key].label,
    icon: SEASON_META[key].icon,
    color: c[SEASON_META[key].token],
  }));

  return (
    <Animated.View style={s.root} entering={FadeIn.duration(reduced ? 0 : 400)}>
      <View style={s.header}>
        <View style={s.headerRow}>
          <View style={s.headerBadge}>
            <Ionicons name="calendar-outline" size={14} color={c.primaryInk} />
          </View>
          <Text style={s.title}>{t('seasonProfile.title')}</Text>
          {seasonUserVotes > 0 ? (
            <View style={[sCountChip, { backgroundColor: c.primarySoft }]}>
              <Text allowFontScaling={false} style={[sCountText, { color: c.primaryInk }]}>
                {seasonUserVotes}
              </Text>
            </View>
          ) : null}
          {available ? (
            <Pressable
              onPress={handleOpenSeasonPicker}
              style={[sSeasonVoteBtn, { backgroundColor: c.primarySoft }]}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t('seasonProfile.voteA11y')}
            >
              <Ionicons name="thumbs-up-outline" size={14} color={c.primaryInk} />
            </Pressable>
          ) : null}
        </View>

      </View>

      {showSeasons ? (
        <View style={s.row}>
          {displayColumns.map((col, i) => (
            <SeasonColumn
              key={col.key}
              column={col}
              rank={i}
              isActive={active === col.key}
              anyActive={anyActive}
              isMyVote={available && perf ? perf.mySeason === col.key : false}
              onSelect={handleSelect}
              reduced={reduced}
              mode={resolvedMode}
              colors={c}
            />
          ))}
        </View>
      ) : null}

      <MomentVotes
        dominant={momentDominant}
        myMoment={available && perf ? perf.myMoment : null}
        canVote={available}
        onVote={handleMomentVote}
        colors={c}
      />

      {profile.topOccasions.length > 0 ? (
        <View style={[s.occasionRow, showSeasons ? { marginTop: 16 } : { marginTop: 4 }]}>
          {profile.topOccasions.map((o, i) => {
            const lead = i === 0;
            return (
              <View
                key={o.label}
                style={[
                  s.occasionChip,
                  { backgroundColor: c.surface2 },
                  lead ? { borderWidth: StyleSheet.hairlineWidth, borderColor: c.border } : null,
                ]}
              >
                <Ionicons name={o.icon as never} size={12} color={lead ? c.text : c.textMuted} />
                <Text
                  style={[
                    s.occasionChipText,
                    { color: lead ? c.text : c.textMuted },
                    lead ? { fontFamily: 'Inter_600SemiBold' } : null,
                  ]}
                >
                  {o.label}
                </Text>
              </View>
            );
          })}
        </View>
      ) : null}

      <VotePickerSheet
        visible={seasonPickerOpen}
        title={t('seasonProfile.voteSeasonTitle')}
        options={seasonOptions}
        currentKey={available && perf ? perf.mySeason : null}
        accent={c.primary}
        onPick={handleSeasonPick}
        onRemove={handleSeasonRemove}
        onClose={handleCloseSeasonPicker}
      />
    </Animated.View>
  );
}

interface MomentProps {
  dominant: 'day' | 'night' | null;
  myMoment: 'day' | 'night' | null;
  canVote: boolean;
  onVote: (moment: 'day' | 'night') => void;
  colors: Theme['colors'];
}

function MomentVotes({ dominant, myMoment, canVote, onVote, colors: c }: MomentProps) {
  const { t } = useTranslation('common');
  const items: { key: 'day' | 'night'; label: string; icon: string }[] = [
    { key: 'day', label: t('seasonProfile.momentDay'), icon: 'sunny-outline' },
    { key: 'night', label: t('seasonProfile.momentNight'), icon: 'moon-outline' },
  ];
  return (
    <View style={sMomentRow}>
      <Ionicons name="time-outline" size={13} color={c.textMuted} />
      {items.map(it => {
        const isMy = myMoment === it.key;
        const isDominant = dominant === it.key;
        return (
          <Pressable
            key={it.key}
            onPress={canVote ? () => onVote(it.key) : undefined}
            hitSlop={{ top: 10, bottom: 10, left: 4, right: 4 }}
            accessibilityRole="button"
            accessibilityLabel={canVote ? t('seasonProfile.voteMomentA11y', { label: it.label }) : `${it.label}${isMy ? `, ${t('seasonProfile.myVote')}` : ''}`}
            style={[
              sMomentChip,
              { backgroundColor: c.surface2 },
              isDominant ? { borderWidth: StyleSheet.hairlineWidth, borderColor: c.border } : null,
            ]}
          >
            <Ionicons name={it.icon as never} size={12} color={isDominant ? c.text : c.textMuted} />
            <Text
              style={[
                sMomentText,
                { color: isDominant ? c.text : c.textMuted },
                isDominant ? { fontFamily: 'Inter_600SemiBold' } : null,
              ]}
            >
              {it.label}
            </Text>
            {isMy ? <View style={[sMomentDot, { backgroundColor: c.primary }]} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

interface ColumnProps {
  column: SeasonColumn;
  rank: number;
  isActive: boolean;
  anyActive: boolean;
  isMyVote: boolean;
  onSelect: (key: SeasonKey) => void;
  reduced: boolean;
  mode: 'light' | 'dark';
  colors: Theme['colors'];
}

function SeasonColumn({ column, rank, isActive, anyActive, isMyVote, onSelect, reduced, mode, colors: c }: ColumnProps) {
  const { t } = useTranslation('common');
  // emph : 1 = colonne explorée, -1 = estompée (une autre est explorée), 0 = repos.
  const emph = useSharedValue(isActive ? 1 : anyActive ? -1 : 0);

  useEffect(() => {
    emph.value = withTiming(isActive ? 1 : anyActive ? -1 : 0, { duration: reduced ? 0 : 260 });
  }, [isActive, anyActive, reduced]);

  const seasonColor = c[column.token];
  const seasonSoft = c[column.tokenSoft];
  const hasScore = column.score > 0;
  const idleIcon = hasScore ? seasonColor : c.textMuted;
  const innerTint = alpha(seasonColor, mode === 'light' ? 0.16 : 0.08);

  // Tuile de fond : visible sur la star au repos et sur la colonne explorée,
  // invisible ailleurs (crossfade d'opacité, pas de couleur transparente).
  const tileStyle = useAnimatedStyle(() => ({
    opacity: interpolate(emph.value, [-1, 0, 1], [0, column.isTop ? 1 : 0, 1], Extrapolation.CLAMP),
  }));

  // Cercle icône : plein saison sur star/explorée, voile teinté au repos.
  const discStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      emph.value,
      [-1, 0, 1],
      [innerTint, column.isTop ? seasonColor : innerTint, seasonColor],
    ),
    transform: [{ scale: interpolate(emph.value, [-1, 0, 1], [0.96, 1, 1.06], Extrapolation.CLAMP) }],
  }));

  // Couche teintée de l'icône : visible au repos, fondue vers le blanc sur star/explorée.
  const iconFadeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(emph.value, [-1, 0, 1], [1, column.isTop ? 0 : 1, 0], Extrapolation.CLAMP),
  }));

  const fillStyle = useAnimatedStyle(() => ({
    opacity: interpolate(emph.value, [-1, 0, 1], [0.32, column.isTop ? 1 : 0.5, 1], Extrapolation.CLAMP),
  }));

  const labelStyle = useAnimatedStyle(() => ({
    fontSize: interpolate(emph.value, [-1, 0, 1], [11, column.isTop ? 13 : 11, 13], Extrapolation.CLAMP),
    color: interpolateColor(
      emph.value,
      [-1, 0, 1],
      [c.textMuted, column.isTop ? c.text : c.textMuted, seasonColor],
    ),
  }));

  const handlePress = useCallback(() => onSelect(column.key), [onSelect, column.key]);

  const fillPct = hasScore ? Math.max(12, Math.round(column.ratio * 100)) : 6;
  const fillColor = hasScore ? seasonColor : c.border;
  const ratioOutOfFive = hasScore ? Math.max(1, Math.round(column.ratio * 5)) : 0;
  const a11yParts = [
    hasScore
      ? t('seasonProfile.colScored', { label: column.label, score: ratioOutOfFive })
      : t('seasonProfile.colLow', { label: column.label }),
  ];
  if (isActive) a11yParts.push(t('seasonProfile.colSelected'));
  if (isMyVote) a11yParts.push(t('seasonProfile.myVote'));
  const a11y = a11yParts.join(', ');

  return (
    <Animated.View entering={FadeIn.delay(reduced ? 0 : rank * 80).duration(reduced ? 0 : 360)} style={sColWrap}>
      <Pressable
        onPress={handlePress}
        accessibilityRole="button"
        accessibilityLabel={a11y}
        accessibilityState={{ selected: isActive }}
        style={sCol}
      >
        <Animated.View style={[StyleSheet.absoluteFill, { borderRadius: 14, backgroundColor: seasonSoft }, tileStyle]} />

        <View style={sColInner}>
          <View style={sIconSlot}>
            <Animated.View style={[sIconWrap, discStyle]}>
              <Ionicons name={column.icon as never} size={15} color="#FFFFFF" />
              <Animated.View style={[StyleSheet.absoluteFill, sIconCenter, iconFadeStyle]}>
                <Ionicons name={column.icon as never} size={15} color={idleIcon} />
              </Animated.View>
            </Animated.View>
            {isMyVote ? <View style={[sMyVoteDot, { backgroundColor: seasonColor }]} /> : null}
          </View>

          <View style={[sTrack, { backgroundColor: c.surface2 }]}>
            <Animated.View style={[sFill, { height: `${fillPct}%`, backgroundColor: fillColor }, fillStyle]} />
          </View>

          <View style={sLabelSlot}>
            <Animated.Text
              allowFontScaling={false}
              numberOfLines={1}
              style={[
                {
                  fontFamily:
                    isActive || column.isTop ? 'Inter_600SemiBold' : 'Inter_500Medium',
                },
                labelStyle,
              ]}
            >
              {column.label}
            </Animated.Text>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

function getStyles(t: Theme) {
  const c = t.colors;
  return {
    root: { marginTop: 24, marginBottom: 4 },
    header: { marginBottom: 16 },
    headerRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8 },
    headerBadge: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: c.primarySoft,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
    },
    title: { fontFamily: 'PlayfairDisplay_600SemiBold', fontSize: 18, color: c.text },
    row: { flexDirection: 'row' as const, gap: 8, marginTop: 4 },
    occasionRow: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 8, justifyContent: 'center' as const },
    occasionChip: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: 5,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 18,
    },
    occasionChipText: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  } as const;
}

const sCountChip = {
  minWidth: 20,
  height: 18,
  borderRadius: 9,
  paddingHorizontal: 5,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
  marginLeft: 6,
} as const;

const sCountText = {
  fontFamily: 'Inter_700Bold',
  fontSize: 10,
} as const;

const sSeasonVoteBtn = {
  width: 30,
  height: 30,
  borderRadius: 15,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
  marginLeft: 'auto' as const,
} as const;

const sColWrap = {
  flex: 1,
} as const;

const sCol = {
  minHeight: 44,
  borderRadius: 14,
  overflow: 'hidden' as const,
} as const;

const sColInner = {
  alignItems: 'center' as const,
  paddingVertical: 10,
  paddingHorizontal: 4,
  gap: 6,
} as const;

const sIconSlot = {
  width: 46,
  height: 46,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
} as const;

const sIconWrap = {
  width: 32,
  height: 32,
  borderRadius: 16,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
} as const;

const sIconCenter = {
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
} as const;

const sMyVoteDot = {
  position: 'absolute' as const,
  top: 2,
  alignSelf: 'center' as const,
  width: 6,
  height: 6,
  borderRadius: 3,
} as const;

const sTrack = {
  width: 12,
  height: 44,
  borderRadius: 6,
  justifyContent: 'flex-end' as const,
  overflow: 'hidden' as const,
} as const;

const sFill = {
  width: '100%',
  borderRadius: 6,
} as const;

const sLabelSlot = {
  height: 20,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
} as const;

const sMomentRow = {
  flexDirection: 'row' as const,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
  gap: 8,
  marginTop: 16,
} as const;

const sMomentChip = {
  flexDirection: 'row' as const,
  alignItems: 'center' as const,
  gap: 5,
  paddingHorizontal: 12,
  paddingVertical: 6,
  borderRadius: 14,
} as const;

const sMomentText = {
  fontSize: 12,
  fontFamily: 'Inter_500Medium',
} as const;

const sMomentDot = {
  width: 6,
  height: 6,
  borderRadius: 3,
  marginLeft: 2,
} as const;
