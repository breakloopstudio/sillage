import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@react-native-vector-icons/ionicons/static';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSequence,
  withSpring,
  interpolate,
  interpolateColor,
  Extrapolation,
  FadeIn,
  FadeInDown,
  useReducedMotion,
} from 'react-native-reanimated';
import { useTheme, type Theme } from '../../theme/ThemeContext';
import { hapticsLight, hapticsSuccess } from '../../services/haptics';
import { alpha } from '../../utils/alpha';
import { buildPerformance, perfDimensionAt, type PerfDimension, type PerfDimensionKey } from '../../utils/performance-profile';
import { type UsePerfVotes } from '../../hooks/usePerfVotes';
import { useAuthContext } from '../../contexts/AuthContext';
import VotePickerSheet, { type VoteOption } from '../../components/VotePickerSheet';

interface Props {
  longevity?: string | null;
  sillage?: string | null;
  perfVotes: UsePerfVotes;
}

const DIM_KEYS: PerfDimensionKey[] = ['longevity', 'sillage'];

export default function PerformanceProfile({ longevity, sillage, perfVotes }: Props) {
  const { theme } = useTheme();
  const c = theme.colors;
  const s = useMemo(() => getStyles(theme), [theme]);
  const reduced = useReducedMotion();
  const router = useRouter();
  const { user } = useAuthContext();

  const { perf, available, vote, removeVote } = perfVotes;

  const fallback = useMemo(() => buildPerformance(longevity, sillage), [longevity, sillage]);

  // Niveau affiché = fusion (RPC) si disponible, sinon niveau issu de la string legacy.
  const displayDims = useMemo(() => {
    const out: { dim: PerfDimension; userVotes: number; myVote: number | null }[] = [];
    for (const key of DIM_KEYS) {
      const rpcDim = available && perf ? perf[key] : null;
      const level = rpcDim && rpcDim.level !== null ? rpcDim.level : fallback[key]?.level ?? null;
      const dim = perfDimensionAt(key, level);
      if (dim) {
        out.push({
          dim,
          userVotes: rpcDim?.userVotes ?? 0,
          myVote: rpcDim?.myVote ?? null,
        });
      }
    }
    return out;
  }, [available, perf, fallback]);

  const [active, setActive] = useState<string | null>(null);
  const [pickerDim, setPickerDim] = useState<PerfDimensionKey | null>(null);

  const handleSelect = useCallback((key: string) => {
    hapticsLight();
    setActive(prev => (prev === key ? null : key));
  }, []);

  // Affordance visible : ouvre le sélecteur de vote pour une dimension (auth gate).
  const handleOpenPicker = useCallback(
    (key: PerfDimensionKey) => {
      if (!user) {
        router.push('/auth/login');
        return;
      }
      hapticsLight();
      setPickerDim(key);
    },
    [user, router],
  );

  const handlePickerPick = useCallback(
    async (value: string) => {
      if (!pickerDim) return;
      hapticsLight();
      const ok = await vote(pickerDim, value);
      if (ok) hapticsSuccess();
    },
    [pickerDim, vote],
  );

  const handlePickerRemove = useCallback(() => {
    if (!pickerDim) return;
    hapticsLight();
    void removeVote(pickerDim);
  }, [pickerDim, removeVote]);

  const handleClosePicker = useCallback(() => setPickerDim(null), []);

  // Options du sélecteur = les crans de la dimension ciblée (value = index+1).
  const pickerDimObj = pickerDim ? displayDims.find(d => d.dim.key === pickerDim)?.dim ?? null : null;
  const pickerMyVote = pickerDim && perf ? perf[pickerDim].myVote : null;
  const pickerOptions: VoteOption[] = pickerDimObj
    ? pickerDimObj.ticks.map((tick, i) => ({ key: String(i + 1), label: tick }))
    : [];

  if (displayDims.length === 0) return null;

  return (
    <Animated.View style={s.root} entering={FadeIn.duration(reduced ? 0 : 400)}>
      <View style={s.header}>
        <View style={s.headerRow}>
          <View style={s.headerBadge}>
            <Ionicons name="flash-outline" size={14} color={c.perfInk} />
          </View>
          <Text style={s.title}>Tenue & sillage</Text>
        </View>
      </View>

      <View style={[s.list, { gap: 18 }]}>
        {displayDims.map((d, i) => (
          <DimensionRow
            key={d.dim.key}
            dim={d.dim}
            rank={i}
            active={active}
            userVotes={d.userVotes}
            myVote={d.myVote}
            canVote={available}
            onSelect={handleSelect}
            onOpenPicker={() => handleOpenPicker(d.dim.key)}
            reduced={reduced}
          />
        ))}
      </View>

      <VotePickerSheet
        visible={pickerDim !== null}
        title={pickerDimObj ? `Ton avis · ${pickerDimObj.label}` : 'Ton avis'}
        options={pickerOptions}
        currentKey={pickerMyVote !== null ? String(pickerMyVote) : null}
        accent={c.perf}
        onPick={handlePickerPick}
        onRemove={handlePickerRemove}
        onClose={handleClosePicker}
      />
    </Animated.View>
  );
}

interface RowProps {
  dim: PerfDimension;
  rank: number;
  active: string | null;
  userVotes: number;
  myVote: number | null;
  canVote: boolean;
  onSelect: (key: string) => void;
  onOpenPicker: () => void;
  reduced: boolean;
}

function DimensionRow({ dim, rank, active, userVotes, myVote, canVote, onSelect, onOpenPicker, reduced }: RowProps) {
  const { theme } = useTheme();
  const c = theme.colors;

  const isActive = active === dim.key;
  const anyActive = active !== null;

  const emph = useSharedValue(isActive ? 1 : anyActive ? -1 : 0);

  useEffect(() => {
    emph.value = withTiming(isActive ? 1 : anyActive ? -1 : 0, { duration: reduced ? 0 : 250 });
  }, [isActive, anyActive]);

  const blockStyle = useAnimatedStyle(() => ({
    opacity: interpolate(emph.value, [-1, 0, 1], [0.4, 1, 1]),
  }));

  const labelStyle = useAnimatedStyle(() => ({
    fontSize: interpolate(emph.value, [-1, 0, 1], [13, 14, 16], Extrapolation.CLAMP),
    color: interpolateColor(emph.value, [-1, 0, 1], [c.textMuted, c.text, c.perfInk]),
  }));

  const handleFocus = useCallback(() => onSelect(dim.key), [onSelect, dim.key]);
  const litColor = alpha(c.perf, 0.4);

  return (
    <Animated.View entering={FadeIn.delay(reduced ? 0 : rank * 110).duration(reduced ? 0 : 380)}>
      <Animated.View style={blockStyle}>
        <View style={sHeadRow}>
          <Pressable
            onPress={handleFocus}
            style={sHeadFocus}
            accessibilityRole="button"
            accessibilityLabel={`${dim.label} : ${dim.valueLabel}${dim.hours ? ', ' + dim.hours : ''}, ${dim.ticks[dim.level - 1]}`}
            accessibilityState={{ selected: isActive }}
          >
            <View style={[sIcon, { backgroundColor: c.perfSoft }]}>
              <Ionicons name={dim.icon as never} size={14} color={c.perfInk} />
            </View>
            <Animated.Text numberOfLines={1} style={[sDimLabel, labelStyle]}>
              {dim.label}
            </Animated.Text>
            {userVotes > 0 ? (
              <View style={[sCountChip, { backgroundColor: c.perfSoft }]}>
                <Text allowFontScaling={false} style={[sCountText, { color: c.perfInk }]}>
                  {userVotes}
                </Text>
              </View>
            ) : null}
            <Text allowFontScaling={false} numberOfLines={1} style={[sValue, { color: c.perfInk }]}>
              {dim.hours ? `${dim.valueLabel} · ${dim.hours}` : dim.valueLabel}
            </Text>
          </Pressable>

          {canVote ? (
            <Pressable
              onPress={onOpenPicker}
              style={[sVoteBtn, { backgroundColor: c.perfSoft }]}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={`Donner mon avis sur ${dim.label}`}
            >
              <Ionicons name="thumbs-up-outline" size={14} color={c.perfInk} />
            </Pressable>
          ) : null}
        </View>

        <View style={sScale}>
          {dim.ticks.map((tick, i) => (
            <Crank
              key={tick}
              index={i}
              lit={i < dim.level}
              reached={i === dim.level - 1}
              isMyVote={myVote === i + 1}
              litColor={i === dim.level - 1 ? c.perf : litColor}
              trackColor={c.surface2}
              perfColor={c.perf}
              label={tick}
              labelLit={i < dim.level}
              labelInk={c.perfInk}
              labelMuted={c.textMuted}
              reduced={reduced}
              onFocus={handleFocus}
            />
          ))}
        </View>

        {isActive ? (
          <Animated.View entering={FadeInDown.duration(reduced ? 0 : 220)} style={sEmanation}>
            <View style={[sEmanBar, { backgroundColor: c.perf }]} />
            <Text maxFontSizeMultiplier={1.3} style={[sEmanText, { color: c.textMuted }]}>
              {dim.emanation}
            </Text>
          </Animated.View>
        ) : null}
      </Animated.View>
    </Animated.View>
  );
}

interface CrankProps {
  index: number;
  lit: boolean;
  reached: boolean;
  isMyVote: boolean;
  litColor: string;
  trackColor: string;
  perfColor: string;
  label: string;
  labelLit: boolean;
  labelInk: string;
  labelMuted: string;
  reduced: boolean;
  onFocus: () => void;
}

function Crank({ index, lit, reached, isMyVote, litColor, trackColor, perfColor, label, labelLit, labelInk, labelMuted, reduced, onFocus }: CrankProps) {
  const enter = useSharedValue(lit && !reduced ? 0 : 1);
  const pop = useSharedValue(1);

  useEffect(() => {
    if (reduced) {
      enter.value = 1;
      pop.value = 1;
      return;
    }
    enter.value = withDelay(index * 120, withTiming(lit ? 1 : 0.0001, { duration: 380 }));
    if (lit && reached) {
      pop.value = 1;
      pop.value = withDelay(
        index * 120 + 320,
        withSequence(withTiming(1.3, { duration: 130 }), withSpring(1, { damping: 6, stiffness: 320 })),
      );
    }
  }, [lit, reached, reduced]);

  const segStyle = useAnimatedStyle(() => ({
    opacity: lit ? enter.value : 1,
    backgroundColor: lit ? litColor : trackColor,
    transform: [{ scaleX: reached ? pop.value : 1 }],
  }));

  const labStyle = useAnimatedStyle(() => ({
    opacity: lit ? enter.value : 0.5,
  }));

  return (
    <Pressable
      onPress={onFocus}
      accessibilityRole="button"
      accessibilityLabel={isMyVote ? `${label}, ton vote` : label}
      style={sCrank}
    >
      <View style={sCrankInner}>
        <Animated.View style={[sSeg, segStyle]} />
        {isMyVote ? <View style={[sMyVoteDot, { backgroundColor: perfColor }]} /> : null}
        <Animated.Text
          allowFontScaling={false}
          numberOfLines={1}
          style={[
            sCrankLabel,
            { color: labelLit ? labelInk : labelMuted, fontFamily: reached ? 'Inter_600SemiBold' : 'Inter_400Regular' },
            labStyle,
          ]}
        >
          {label}
        </Animated.Text>
      </View>
    </Pressable>
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
      backgroundColor: c.perfSoft,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
    },
    title: { fontFamily: 'PlayfairDisplay_600SemiBold', fontSize: 18, color: c.text },
    list: {},
  } as const;
}

const sHeadRow = {
  flexDirection: 'row' as const,
  alignItems: 'center' as const,
  marginBottom: 8,
} as const;

const sHeadFocus = {
  flex: 1,
  flexDirection: 'row' as const,
  alignItems: 'center' as const,
} as const;

const sVoteBtn = {
  width: 30,
  height: 30,
  borderRadius: 15,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
  marginLeft: 8,
} as const;

const sIcon = {
  width: 26,
  height: 26,
  borderRadius: 13,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
  marginRight: 8,
} as const;

const sDimLabel = {
  flex: 1,
  fontFamily: 'Inter_500Medium',
  lineHeight: 20,
} as const;

const sValue = {
  marginLeft: 10,
  fontFamily: 'Inter_600SemiBold',
  fontSize: 13,
} as const;

const sCountChip = {
  minWidth: 20,
  height: 18,
  borderRadius: 9,
  paddingHorizontal: 5,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
  marginRight: 6,
} as const;

const sCountText = {
  fontFamily: 'Inter_700Bold',
  fontSize: 10,
} as const;

const sScale = {
  flexDirection: 'row' as const,
  gap: 4,
  marginLeft: 34,
} as const;

const sCrank = {
  flex: 1,
} as const;

const sCrankInner = {
  alignItems: 'center' as const,
  paddingTop: 8,
  minHeight: 44,
} as const;

const sSeg = {
  height: 8,
  width: '100%',
  borderRadius: 4,
} as const;

const sMyVoteDot = {
  position: 'absolute' as const,
  top: 0,
  alignSelf: 'center' as const,
  width: 6,
  height: 6,
  borderRadius: 3,
} as const;

const sCrankLabel = {
  marginTop: 6,
  fontSize: 10,
  textAlign: 'center' as const,
} as const;

const sEmanation = {
  flexDirection: 'row' as const,
  alignItems: 'flex-start' as const,
  gap: 8,
  marginTop: 12,
  marginLeft: 34,
} as const;

const sEmanBar = {
  width: 2,
  alignSelf: 'stretch' as const,
  borderRadius: 1,
} as const;

const sEmanText = {
  flex: 1,
  fontFamily: 'Inter_400Regular',
  fontSize: 13,
  lineHeight: 19,
} as const;
