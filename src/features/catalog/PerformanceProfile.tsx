import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, type LayoutChangeEvent } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import Ionicons from '@react-native-vector-icons/ionicons/static';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSpring,
  cancelAnimation,
  interpolate,
  interpolateColor,
  Extrapolation,
  Easing,
  FadeIn,
  FadeInDown,
  useReducedMotion,
} from 'react-native-reanimated';
import { useTheme, type Theme } from '../../theme/ThemeContext';
import { hapticsLight, hapticsSuccess } from '../../services/haptics';
import { tintLuminous, tintStructural } from '../../utils/alpha';
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
  }, [isActive, anyActive, reduced, emph]);

  const blockStyle = useAnimatedStyle(() => ({
    opacity: interpolate(emph.value, [-1, 0, 1], [0.4, 1, 1]),
  }));

  const labelStyle = useAnimatedStyle(() => ({
    fontSize: interpolate(emph.value, [-1, 0, 1], [13, 14, 16], Extrapolation.CLAMP),
    color: interpolateColor(emph.value, [-1, 0, 1], [c.textMuted, c.text, c.perfInk]),
  }));

  const handleFocus = useCallback(() => onSelect(dim.key), [onSelect, dim.key]);

  return (
    <Animated.View entering={FadeIn.delay(reduced ? 0 : rank * 110).duration(reduced ? 0 : 380)}>
      <Animated.View style={blockStyle}>
        <View style={sHeadRow}>
          <Pressable
            onPress={handleFocus}
            style={sHeadFocus}
            accessibilityRole="button"
            accessibilityLabel={`${dim.label} : ${dim.valueLabel}${dim.hours ? ', ' + dim.hours : ''}, cran ${dim.level} sur ${dim.ticks.length}`}
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

        <ArrowScale dim={dim} myVote={myVote} rank={rank} reduced={reduced} onFocus={handleFocus} />

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

interface ScaleProps {
  dim: PerfDimension;
  myVote: number | null;
  rank: number;
  reduced: boolean;
  onFocus: () => void;
}

function ArrowScale({ dim, myVote, rank, reduced, onFocus }: ScaleProps) {
  const { theme, resolvedMode } = useTheme();
  const c = theme.colors;
  const n = dim.ticks.length;
  const level = Math.min(Math.max(dim.level, 1), n);
  const target = (level - 0.5) / n;
  const trackColor = resolvedMode === 'dark' ? c.border : c.surface2;

  const progress = useSharedValue(reduced ? target : 0);
  const width = useSharedValue(0);
  const mounted = useRef(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (reduced) {
      progress.value = target;
      return;
    }
    if (!mounted.current) {
      mounted.current = true;
      progress.value = withDelay(rank * 110 + 120, withTiming(target, { duration: 400, easing: Easing.out(Easing.cubic) }));
    } else {
      progress.value = withSpring(target, { damping: 22, stiffness: 280 });
    }
  }, [target, reduced, rank, progress]);

  useEffect(() => () => cancelAnimation(progress), [progress]);

  const handleLayout = useCallback(
    (e: LayoutChangeEvent) => {
      width.value = e.nativeEvent.layout.width;
      setReady(true);
    },
    [width],
  );

  const needleStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.value * width.value - 1.5 }],
  }));

  const fillStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: Math.min(progress.value, target) }],
  }));

  return (
    <View style={sScaleWrap} onLayout={handleLayout}>
      <View style={sScaleCols}>
        {dim.ticks.map((tick, i) => (
          <Pressable
            key={tick}
            onPress={onFocus}
            accessibilityRole="button"
            accessibilityLabel={myVote === i + 1 ? `${tick}, ton vote` : tick}
            style={sCol}
          >
            <View style={sColInner}>
              <View style={sSlotSpacer} />
              <Text
                allowFontScaling={false}
                numberOfLines={1}
                style={[
                  sTickLabel,
                  {
                    color: i < level ? c.perfInk : c.textMuted,
                    fontFamily: i === level - 1 ? 'Inter_600SemiBold' : 'Inter_400Regular',
                  },
                ]}
              >
                {tick}
              </Text>
            </View>
          </Pressable>
        ))}
      </View>

      {myVote !== null ? (
        <View
          pointerEvents="none"
          style={[sMyVoteDot, { left: `${((myVote - 0.5) / n) * 100}%`, backgroundColor: c.perf }]}
        />
      ) : null}

      {ready ? (
        <View style={sOverlay} pointerEvents="none" accessible={false}>
          <View style={[sRail, { backgroundColor: trackColor }]} />
          <Animated.View style={[sFill, fillStyle]}>
            <LinearGradient
              colors={[tintStructural(c.perf, 'veil'), c.perf]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={sGradient}
            />
          </Animated.View>
          <View style={[sArrowHead, { borderLeftColor: tintStructural(c.perf, 'dim') }]} />
          {dim.ticks.map((tick, i) =>
            i === level - 1 ? null : (
              <View
                key={tick}
                style={[
                  sDot,
                  { left: `${((i + 0.5) / n) * 100}%`, backgroundColor: i < level ? c.perf : trackColor },
                  resolvedMode === 'dark' && i >= dim.level ? theme.cardBorder : null,
                ]}
              />
            ),
          )}
          <Animated.View style={[sNeedleGroup, needleStyle]}>
            <View style={[sHaloOuter, { backgroundColor: tintLuminous(c.perf, 'hint', resolvedMode) }]} />
            <View style={[sHaloInner, { backgroundColor: tintLuminous(c.perf, 'veil', resolvedMode) }]} />
            <View style={[sNeedle, { backgroundColor: c.perf }]} />
          </Animated.View>
        </View>
      ) : null}
    </View>
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
  fontVariant: ['tabular-nums'] as import('react-native').FontVariant[],
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

const sScaleWrap = {
  marginLeft: 34,
} as const;

const sScaleCols = {
  flexDirection: 'row' as const,
} as const;

const sCol = {
  flex: 1,
} as const;

const sColInner = {
  alignItems: 'center' as const,
  minHeight: 44,
} as const;

const sSlotSpacer = {
  height: 24,
} as const;

const sTickLabel = {
  marginTop: 6,
  fontSize: 10,
  textAlign: 'center' as const,
} as const;

const sMyVoteDot = {
  position: 'absolute' as const,
  top: 0,
  width: 6,
  height: 6,
  borderRadius: 3,
  marginLeft: -3,
} as const;

const sOverlay = {
  position: 'absolute' as const,
  top: 8,
  left: 0,
  right: 0,
  height: 16,
} as const;

const sRail = {
  position: 'absolute' as const,
  top: 6,
  left: 0,
  right: 8,
  height: 4,
  borderRadius: 2,
} as const;

const sFill = {
  position: 'absolute' as const,
  top: 6,
  left: 0,
  width: '100%',
  height: 4,
  borderRadius: 2,
  transformOrigin: 'left center' as const,
  overflow: 'hidden' as const,
} as const;

const sGradient = {
  width: '100%',
  height: 4,
} as const;

const sArrowHead = {
  position: 'absolute' as const,
  right: 1,
  top: 3,
  width: 0,
  height: 0,
  borderLeftWidth: 7,
  borderTopWidth: 5,
  borderBottomWidth: 5,
  borderTopColor: 'transparent',
  borderBottomColor: 'transparent',
} as const;

const sDot = {
  position: 'absolute' as const,
  top: 5,
  width: 6,
  height: 6,
  borderRadius: 3,
  marginLeft: -3,
} as const;

const sNeedleGroup = {
  position: 'absolute' as const,
  top: 0,
  left: 0,
  width: 3,
  height: 16,
} as const;

const sNeedle = {
  width: 3,
  height: 16,
  borderRadius: 1.5,
} as const;

const sHaloOuter = {
  position: 'absolute' as const,
  width: 28,
  height: 28,
  borderRadius: 14,
  left: -12.5,
  top: -6,
} as const;

const sHaloInner = {
  position: 'absolute' as const,
  width: 14,
  height: 14,
  borderRadius: 7,
  left: -5.5,
  top: 1,
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
