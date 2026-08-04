import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Ionicons from '@react-native-vector-icons/ionicons/static';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
  Extrapolation,
  FadeIn,
  FadeInDown,
  useReducedMotion,
} from 'react-native-reanimated';
import { useTheme, type Theme } from '../../theme/ThemeContext';
import { hapticsLight } from '../../services/haptics';
import { tintLuminous } from '../../utils/alpha';
import { getAccordDescription } from '../../utils/note-descriptions';
import { buildAccords, ribbonWidths, type AccordRow } from '../../utils/accord-profile';

interface Props {
  accords: string[] | undefined;
  percentages?: Record<string, string>;
}

export default function AccordProfile({ accords, percentages }: Props) {
  const { theme } = useTheme();
  const c = theme.colors;
  const s = useMemo(() => getStyles(theme), [theme]);
  const reduced = useReducedMotion();

  const rows = useMemo(() => buildAccords(accords, percentages), [accords, percentages]);
  const widths = useMemo(() => ribbonWidths(rows), [rows]);

  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    setActive(prev => (prev !== null && !rows.some(r => r.raw === prev) ? null : prev));
  }, [rows]);

  const colorOf = useCallback(
    (i: number) => c[`accord${i}`] ?? c.primary,
    [c],
  );

  const handleSelect = useCallback((raw: string) => {
    hapticsLight();
    setActive(prev => (prev === raw ? null : raw));
  }, []);

  if (rows.length === 0) return null;

  return (
    <Animated.View style={s.root} entering={FadeIn.duration(reduced ? 0 : 400)}>
      <View style={s.header}>
        <View style={s.headerRow}>
          <View style={s.headerBadge}>
            <Ionicons name="color-filter-outline" size={14} color={c.primaryInk} />
          </View>
          <Text style={s.title}>Accords principaux</Text>
        </View>
      </View>

      <View
        style={[sRibbon, { backgroundColor: c.surface2 }]}
        pointerEvents="none"
        accessible={false}
        importantForAccessibility="no-hide-descendants"
      >
        {rows.map((row, i) => (
          <RibbonSegment
            key={row.raw}
            raw={row.raw}
            width={widths[i]}
            color={colorOf(row.colorIndex)}
            active={active}
            rank={i}
            reduced={reduced}
          />
        ))}
      </View>

      <View>
        {rows.map((row, i) => (
          <AccordRow
            key={row.raw}
            row={row}
            rank={i}
            isChar={i === 0}
            first={i === 0}
            color={colorOf(row.colorIndex)}
            active={active}
            onSelect={handleSelect}
            reduced={reduced}
          />
        ))}
      </View>
    </Animated.View>
  );
}

interface SegmentProps {
  raw: string;
  width: number;
  color: string;
  active: string | null;
  rank: number;
  reduced: boolean;
}

function RibbonSegment({ raw, width, color, active, rank, reduced }: SegmentProps) {
  const isActive = active === raw;
  const anyActive = active !== null;

  const emph = useSharedValue(isActive ? 1 : anyActive ? -1 : 0);

  useEffect(() => {
    emph.value = withTiming(isActive ? 1 : anyActive ? -1 : 0, { duration: reduced ? 0 : 250 });
  }, [isActive, anyActive, reduced, emph]);

  const segStyle = useAnimatedStyle(() => ({
    opacity: interpolate(emph.value, [-1, 0, 1], [0.4, 1, 1]),
  }));

  return (
    <Animated.View
      entering={FadeIn.delay(reduced ? 0 : rank * 70).duration(reduced ? 0 : 300)}
      style={[sSegment, { flex: width, backgroundColor: color }, segStyle]}
    />
  );
}

interface RowProps {
  row: AccordRow;
  rank: number;
  isChar: boolean;
  first: boolean;
  color: string;
  active: string | null;
  onSelect: (raw: string) => void;
  reduced: boolean;
}

function AccordRow({ row, rank, isChar, first, color, active, onSelect, reduced }: RowProps) {
  const { theme, resolvedMode } = useTheme();
  const c = theme.colors;

  const isActive = active === row.raw;
  const anyActive = active !== null;

  const emph = useSharedValue(isActive ? 1 : anyActive ? -1 : 0);

  useEffect(() => {
    emph.value = withTiming(isActive ? 1 : anyActive ? -1 : 0, { duration: reduced ? 0 : 250 });
  }, [isActive, anyActive, reduced, emph]);

  const rowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(emph.value, [-1, 0, 1], [0.4, 1, 1]),
  }));

  const haloStyle = useAnimatedStyle(() => ({
    opacity: interpolate(emph.value, [0, 1], [0, 1], Extrapolation.CLAMP),
    transform: [{ scale: interpolate(emph.value, [0, 1], [1, 1.25], Extrapolation.CLAMP) }],
  }));

  const chevStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${interpolate(emph.value, [0, 1], [0, 180], Extrapolation.CLAMP)}deg` }],
  }));

  const description = getAccordDescription(row.raw);
  const hasDesc = !!description && description.trim().length > 0;

  const handlePress = useCallback(() => onSelect(row.raw), [onSelect, row.raw]);

  return (
    <Animated.View entering={FadeIn.delay(reduced ? 0 : rank * 90).duration(reduced ? 0 : 380)}>
      <Pressable
        onPress={handlePress}
        accessibilityRole="button"
        accessibilityLabel={`${row.display}, ${row.pct} %${row.label ? ', ' + row.label : ''}`}
        accessibilityState={{ selected: isActive, expanded: isActive && hasDesc }}
        accessibilityHint={hasDesc ? 'Affiche ou masque la description de l’accord' : undefined}
        style={[sRow, !first && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border }]}
      >
        <Animated.View style={[sRowLine, rowStyle]}>
          <View style={sDotWrap}>
            <Animated.View
              style={[sDotHalo, { backgroundColor: tintLuminous(color, 'hint', resolvedMode) }, haloStyle]}
            />
            <View style={[sDot, { backgroundColor: color }]} />
          </View>
          <Text numberOfLines={1} style={[isChar ? sLabelChar : sLabelNuance, { color: c.text }]}>
            {row.display}
          </Text>
          {row.label ? (
            <Text allowFontScaling={false} style={[sQual, { color: c.textMuted }]}>
              {row.label}
            </Text>
          ) : null}
          {hasDesc ? (
            <Animated.View style={[sChev, chevStyle]}>
              <Ionicons name="chevron-down-outline" size={14} color={c.textMuted} />
            </Animated.View>
          ) : null}
        </Animated.View>

        {isActive && hasDesc ? (
          <Animated.View entering={FadeInDown.duration(reduced ? 0 : 220)} style={sEmanation}>
            <View style={[sEmanBar, { backgroundColor: color }]} />
            <Text maxFontSizeMultiplier={1.3} style={[sEmanText, { color: c.textMuted }]}>
              {description}
            </Text>
          </Animated.View>
        ) : null}
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
  } as const;
}

const sRibbon = {
  flexDirection: 'row' as const,
  height: 16,
  borderRadius: 8,
  overflow: 'hidden' as const,
  gap: 2,
  marginBottom: 6,
} as const;

const sSegment = {
  height: 16,
} as const;

const sRow = {
  minHeight: 44,
  justifyContent: 'center' as const,
} as const;

const sRowLine = {
  flexDirection: 'row' as const,
  alignItems: 'center' as const,
  gap: 10,
  paddingVertical: 10,
} as const;

const sDotWrap = {
  width: 16,
  height: 16,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
} as const;

const sDotHalo = {
  position: 'absolute' as const,
  width: 16,
  height: 16,
  borderRadius: 8,
} as const;

const sDot = {
  width: 8,
  height: 8,
  borderRadius: 4,
} as const;

const sLabelChar = {
  flex: 1,
  fontFamily: 'PlayfairDisplay_600SemiBold',
  fontSize: 15,
  lineHeight: 22,
} as const;

const sLabelNuance = {
  flex: 1,
  fontFamily: 'Inter_500Medium',
  fontSize: 13,
  lineHeight: 20,
} as const;

const sQual = {
  fontFamily: 'Inter_600SemiBold',
  fontSize: 11,
} as const;

const sChev = {
  marginLeft: 2,
} as const;

const sEmanation = {
  flexDirection: 'row' as const,
  alignItems: 'flex-start' as const,
  gap: 8,
  paddingTop: 2,
  paddingBottom: 10,
  paddingLeft: 2,
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
