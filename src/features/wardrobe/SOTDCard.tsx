// src/features/wardrobe/SOTDCard.tsx — Ligne éditoriale météo + Parfum du jour
// Outrepassage guide assumé : plus de carte primarySoft. La feature devient une
// ligne de métadonnée (filet hairline) ; la couleur vit sur les objets, pas sur un fond.

import { useMemo, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import Ionicons from '@react-native-vector-icons/ionicons/static';
import { useTheme, type Theme } from '../../theme/ThemeContext';
import { getWmoMeta } from '../../utils/weather-codes';
import type { WeatherData } from '../../services/weather';
import type { SotdEntry } from '../../models/user-parfum.interface';

const NIGHT_ICON: Record<string, string> = {
  sunny: 'moon',
  'partly-sunny': 'cloudy-night',
};

interface Props {
  sotd: SotdEntry | null;
  weather: WeatherData | null;
  weatherLoading: boolean;
  sotdScore?: number | null;
  streak?: number | null;
  onPress: () => void;
  onChangePress: () => void;
  onShare?: () => void;
  /** Tap sur le segment météo quand la météo est absente (opt-in localisation). */
  onWeatherEnablePress?: () => void;
}

function scoreColor(score: number | null | undefined, t: Theme) {
  if (score === null || score === undefined) return t.colors.textMuted;
  if (score >= 70) return t.colors.deal;
  if (score >= 40) return t.colors.fair;
  return t.colors.textMuted;
}

function scoreBg(score: number | null | undefined, t: Theme) {
  if (score === null || score === undefined) return t.colors.surface2;
  if (score >= 70) return t.colors.dealSoft;
  if (score >= 40) return t.colors.fairSoft;
  return t.colors.surface2;
}

export default function SOTDCard({ sotd, weather, weatherLoading, sotdScore, streak, onPress, onChangePress, onShare, onWeatherEnablePress }: Props) {
  const { theme } = useTheme();
  const s = useMemo(() => getStyles(theme), [theme]);
  const [imgFailed, setImgFailed] = useState(false);

  const showWeather = weather !== null && !weatherLoading;
  const showWeatherEnable = !weather && !weatherLoading && !!onWeatherEnablePress;
  const showScore = typeof sotdScore === 'number' && !isNaN(sotdScore) && sotdScore >= 50;
  const showStreak = typeof streak === 'number' && streak >= 2;
  const scColor = scoreColor(sotdScore, theme);
  const scBg = scoreBg(sotdScore, theme);

  const wmo = showWeather ? getWmoMeta((weather as WeatherData).weatherCode) : null;
  const iconName = wmo
    ? (weather as WeatherData).isDay
      ? wmo.icon
      : NIGHT_ICON[wmo.icon] ?? wmo.icon
    : null;

  if (!weather && !sotd && !showWeatherEnable) return null;

  return (
    <View style={s.line}>
      {weatherLoading ? (
        <ActivityIndicator size="small" color={theme.colors.primary} />
      ) : null}

      {showWeather && wmo && iconName ? (
        <>
          <View style={s.weatherSeg}>
            <Ionicons name={iconName as never} size={14} color={theme.colors.primary} accessible={false} />
            <Text allowFontScaling={false} style={s.temp}>
              {Math.round((weather as WeatherData).temperature)}
              <Text style={s.degree}>°</Text>
            </Text>
            {!sotd ? (
              <Text style={s.weatherLabel} numberOfLines={1}>{wmo.label}</Text>
            ) : null}
          </View>
          {sotd ? <Text allowFontScaling={false} style={s.sep}>·</Text> : null}
        </>
      ) : showWeatherEnable ? (
        <>
          <Pressable
            style={s.weatherEnableSeg}
            onPress={onWeatherEnablePress}
            hitSlop={{ top: 7, bottom: 7 }}
            accessibilityRole="button"
            accessibilityLabel="Activer la météo locale"
          >
            <Ionicons name="partly-sunny-outline" size={14} color={theme.colors.textMuted} accessible={false} />
            <Text style={s.weatherEnableLabel} numberOfLines={1}>Météo</Text>
          </Pressable>
          {sotd ? <Text allowFontScaling={false} style={s.sep}>·</Text> : null}
        </>
      ) : null}

      {sotd ? (
        <Pressable
          style={s.sotdSeg}
          onPress={onPress}
          onLongPress={onShare}
          delayLongPress={400}
          hitSlop={{ top: 7, bottom: 7 }}
          accessibilityRole="button"
          accessibilityLabel={`Parfum du jour : ${sotd.nom} ${sotd.marque}${showStreak ? `, porté ${streak} jours de suite` : ''}`}
          accessibilityHint="Appuyez longuement pour partager"
        >
          <View style={s.thumbWrap}>
            {sotd.imageUrl && !imgFailed ? (
              <Image
                source={{ uri: sotd.imageUrl }}
                style={s.thumb}
                contentFit="contain"
                transition={200}
                onError={() => setImgFailed(true)}
              />
            ) : (
              <Ionicons name="flask-outline" size={11} color={theme.colors.primaryInk} accessible={false} />
            )}
          </View>
          <Text style={s.name} numberOfLines={1}>{sotd.nom}</Text>
          {showStreak ? (
            <View style={s.streakChip}>
              <Text allowFontScaling={false} style={s.streakText}>{streak} j</Text>
            </View>
          ) : null}
          {showScore ? (
            <View style={[s.scoreBadge, { backgroundColor: scBg }]}>
              <Text allowFontScaling={false} style={[s.scoreText, { color: scColor }]}>{sotdScore}%</Text>
            </View>
          ) : null}
        </Pressable>
      ) : (
        <Pressable
          style={s.emptySeg}
          onPress={onChangePress}
          hitSlop={{ top: 7, bottom: 7 }}
          accessibilityRole="button"
          accessibilityLabel="Choisir le parfum du jour"
        >
          <Text style={s.emptyTitle} numberOfLines={1}>Parfum du jour ?</Text>
          <Ionicons name="add-circle-outline" size={14} color={theme.colors.primary} accessible={false} />
        </Pressable>
      )}

      {sotd ? (
        <Pressable
          onPress={onChangePress}
          hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
          style={s.changeBtn}
          accessibilityRole="button"
          accessibilityLabel="Changer le parfum du jour"
        >
          <Ionicons name="swap-horizontal-outline" size={14} color={theme.colors.primary} accessible={false} />
        </Pressable>
      ) : null}
    </View>
  );
}

function getStyles(t: Theme) {
  return {
    line: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      marginHorizontal: 16,
      marginTop: 2,
      marginBottom: 4,
      paddingVertical: 7,
      gap: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.border,
      minHeight: 30,
    },
    weatherSeg: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: 3,
      flexShrink: 0,
    },
    temp: {
      fontFamily: 'Inter_700Bold',
      fontSize: 13,
      color: t.colors.text,
      fontVariant: ['tabular-nums'] as import('react-native').FontVariant[],
    },
    degree: {
      fontFamily: 'Inter_500Medium',
      fontSize: 11,
      color: t.colors.textMuted,
    },
    weatherLabel: {
      fontFamily: 'Inter_400Regular',
      fontSize: 11,
      color: t.colors.textMuted,
      marginLeft: 2,
      maxWidth: 100,
    },
    weatherEnableSeg: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: 4,
      flexShrink: 0,
    },
    weatherEnableLabel: {
      fontFamily: 'Inter_500Medium',
      fontSize: 11,
      color: t.colors.textMuted,
    },
    sep: {
      fontFamily: 'Inter_400Regular',
      fontSize: 12,
      color: t.colors.textMuted,
      opacity: 0.6,
    },
    sotdSeg: {
      flex: 1,
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: 6,
      minWidth: 0,
    },
    thumbWrap: {
      width: 22,
      height: 22,
      borderRadius: 5,
      backgroundColor: t.colors.primarySoft,
      justifyContent: 'center' as const,
      alignItems: 'center' as const,
      overflow: 'hidden' as const,
    },
    thumb: {
      width: 22,
      height: 22,
      borderRadius: 5,
    },
    name: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 12,
      color: t.colors.text,
      flexShrink: 1,
    },
    scoreBadge: {
      borderRadius: 6,
      paddingHorizontal: 5,
      paddingVertical: 2,
    },
    scoreText: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 9,
    },
    streakChip: {
      borderRadius: 6,
      paddingHorizontal: 4,
      paddingVertical: 2,
      backgroundColor: t.colors.surface2,
    },
    streakText: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 9,
      color: t.colors.textMuted,
      fontVariant: ['tabular-nums'] as import('react-native').FontVariant[],
    },
    changeBtn: {
      padding: 4,
      flexShrink: 0,
    },
    emptySeg: {
      flex: 1,
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'space-between' as const,
      gap: 6,
    },
    emptyTitle: {
      flex: 1,
      fontFamily: 'Inter_500Medium',
      fontSize: 12,
      color: t.colors.primaryInk,
    },
  } as const;
}
