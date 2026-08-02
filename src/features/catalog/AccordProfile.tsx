import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import Ionicons from '@react-native-vector-icons/ionicons/static';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
  interpolateColor,
  Extrapolation,
  FadeIn,
  FadeInDown,
  FadeInLeft,
  useReducedMotion,
} from 'react-native-reanimated';
import { useTheme, type Theme } from '../../theme/ThemeContext';
import { hapticsLight } from '../../services/haptics';
import { alpha } from '../../utils/alpha';
import { getAccordDescription } from '../../utils/note-descriptions';
import { buildAccords, type AccordRow } from '../../utils/accord-profile';

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

  const [active, setActive] = useState<string | null>(null);

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

      <View style={[s.list, { gap: 14 }]}>
        {rows.map((row, i) => (
          <AccordRow
            key={row.raw}
            row={row}
            rank={i}
            isChar={i === 0}
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

interface RowProps {
  row: AccordRow;
  rank: number;
  isChar: boolean;
  color: string;
  active: string | null;
  onSelect: (raw: string) => void;
  reduced: boolean;
}

function AccordRow({ row, rank, isChar, color, active, onSelect, reduced }: RowProps) {
  const { theme } = useTheme();
  const c = theme.colors;

  const isActive = active === row.raw;
  const anyActive = active !== null;

  const emph = useSharedValue(isActive ? 1 : anyActive ? -1 : 0);

  useEffect(() => {
    emph.value = withTiming(isActive ? 1 : anyActive ? -1 : 0, { duration: reduced ? 0 : 250 });
  }, [isActive, anyActive]);

  const ringColor = alpha(color, 0.4);

  const labelStyle = useAnimatedStyle(() => ({
    fontSize: isChar
      ? interpolate(emph.value, [-1, 0, 1], [18, 20, 23], Extrapolation.CLAMP)
      : interpolate(emph.value, [-1, 0, 1], [13, 14, 16], Extrapolation.CLAMP),
    color: isChar
      ? interpolateColor(emph.value, [-1, 0, 1], [c.textMuted, color, color])
      : interpolateColor(emph.value, [-1, 0, 1], [c.textMuted, c.text, color]),
  }));

  const fillStyle = useAnimatedStyle(() => ({
    opacity: interpolate(emph.value, [-1, 0, 1], [0.3, 1, 1]),
    borderWidth: interpolate(emph.value, [0, 1], [0, 1.5], Extrapolation.CLAMP),
    borderColor: interpolateColor(emph.value, [0, 1], ['transparent', ringColor]),
  }));

  const qualStyle = useAnimatedStyle(() => ({
    opacity: interpolate(emph.value, [-1, 0, 1], [0.35, 1, 1]),
  }));

  const handlePress = useCallback(() => onSelect(row.raw), [onSelect, row.raw]);

  const description = getAccordDescription(row.raw);
  const hasDesc = !!description && description.trim().length > 0;

  const barH = isChar ? 10 : 6;

  return (
    <Animated.View entering={FadeIn.delay(reduced ? 0 : rank * 90).duration(reduced ? 0 : 380)}>
      <Pressable
        onPress={handlePress}
        accessibilityRole="button"
        accessibilityLabel={`${row.display}, ${row.pct} %${row.label ? ', ' + row.label : ''}`}
        accessibilityState={{ selected: isActive }}
        style={sRow}
      >
        <View style={sHeaderRow}>
          <Animated.Text
            numberOfLines={1}
            style={[
              isChar ? sLabelChar : sLabelNuance,
              labelStyle,
            ]}
          >
            {row.display}
          </Animated.Text>
          {row.label ? (
            <Animated.Text allowFontScaling={false} style={[sQual, { color: isActive ? color : c.textMuted }, qualStyle]}>
              {row.label}
            </Animated.Text>
          ) : null}
        </View>

        <View style={[sTrack, { height: barH, backgroundColor: c.surface2 }]}>
          <Animated.View
            entering={reduced ? FadeInLeft.duration(0) : FadeInLeft.delay(rank * 90 + 120).duration(520)}
            style={[
              sFill,
              { height: barH, width: `${row.pct}%`, backgroundColor: color },
              fillStyle,
            ]}
          />
        </View>

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
    list: {},
  } as const;
}

const sRow = {
  minHeight: 44,
  justifyContent: 'center' as const,
} as const;

const sHeaderRow = {
  flexDirection: 'row' as const,
  alignItems: 'center' as const,
  marginBottom: 6,
} as const;

const sLabelChar = {
  flex: 1,
  fontFamily: 'PlayfairDisplay_600SemiBold',
  lineHeight: 26,
} as const;

const sLabelNuance = {
  flex: 1,
  fontFamily: 'Inter_500Medium',
  lineHeight: 20,
} as const;

const sQual = {
  marginLeft: 10,
  fontFamily: 'Inter_600SemiBold',
  fontSize: 11,
} as const;

const sTrack = {
  borderRadius: 4,
  overflow: 'hidden' as const,
} as const;

const sFill = {
  borderRadius: 4,
} as const;

const sEmanation = {
  flexDirection: 'row' as const,
  alignItems: 'flex-start' as const,
  gap: 8,
  marginTop: 10,
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
