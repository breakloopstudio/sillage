// src/features/wardrobe/SOTDCard.tsx — Bannière unifiée météo + Parfum du jour

import { useMemo, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
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
  onPress: () => void;
  onChangePress: () => void;
  /** Long-press sur le segment SOTD → partager « Aujourd'hui je porte… ». */
  onShare?: () => void;
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

export default function SOTDCard({ sotd, weather, weatherLoading, sotdScore, onPress, onChangePress, onShare }: Props) {
  const { theme } = useTheme();
  const s = useMemo(() => getStyles(theme), [theme]);
  const [imgFailed, setImgFailed] = useState(false);

  const showWeather = weather !== null && !weatherLoading;
  const showScore = typeof sotdScore === 'number' && !isNaN(sotdScore) && sotdScore >= 50;
  const scColor = scoreColor(sotdScore, theme);
  const scBg = scoreBg(sotdScore, theme);

  if (!weather && !sotd) return null;

  return (
    <View style={s.container}>
      <View style={s.card}>
        {weatherLoading && (
          <ActivityIndicator size="small" color={theme.colors.primary} style={s.weatherSpinner} />
        )}

        {showWeather && (
          <>
            {(() => {
              const wmo = getWmoMeta(weather.weatherCode);
              const iconName = weather.isDay ? wmo.icon : NIGHT_ICON[wmo.icon] ?? wmo.icon;
              return (
                <View style={s.weatherSeg}>
                  <Ionicons name={iconName as never} size={14} color={theme.colors.primary} />
                  <Text allowFontScaling={false} style={s.temp}>
                    {Math.round(weather.temperature)}
                    <Text style={s.degree}>°C</Text>
                  </Text>
                  {!sotd && (
                    <Text style={s.weatherLabel} numberOfLines={1}>{wmo.label}</Text>
                  )}
                </View>
              );
            })()}
            <View style={s.dot} />
          </>
        )}

        {sotd ? (
          <Pressable style={s.sotdSeg} onPress={onPress} onLongPress={onShare} delayLongPress={400} accessibilityHint="Appuyez longuement pour partager votre parfum du jour">
            {sotd.imageUrl && !imgFailed ? (
              <Image
                source={{ uri: sotd.imageUrl }}
                style={s.image}
                contentFit="cover"
                transition={200}
                onError={() => setImgFailed(true)}
              />
            ) : (
              <View style={s.placeholder}>
                <Ionicons name="flask-outline" size={13} color={theme.colors.primaryInk} />
              </View>
            )}
            <View style={s.info}>
              <Text style={s.name} numberOfLines={1}>{sotd.nom}</Text>
              <Text style={s.brand} numberOfLines={1}>{sotd.marque}</Text>
            </View>
            {showScore && (
              <View style={[s.scoreBadge, { backgroundColor: scBg }]}>
                <Text allowFontScaling={false} style={[s.scoreText, { color: scColor }]}>
                  {sotdScore}%
                </Text>
              </View>
            )}
            <Pressable onPress={onChangePress} hitSlop={10} style={s.changeBtn}>
              <Ionicons name="swap-horizontal-outline" size={16} color={theme.colors.primary} />
            </Pressable>
          </Pressable>
        ) : (
          <Pressable style={s.emptySeg} onPress={onChangePress}>
            <Text style={s.emptyTitle}>Parfum du jour ?</Text>
            <Ionicons name="add-circle-outline" size={16} color={theme.colors.primary} />
          </Pressable>
        )}
      </View>
    </View>
  );
}

function getStyles(t: Theme) {
  return {
    container: {
      marginHorizontal: 16,
      marginTop: 2,
      marginBottom: 6,
    },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: t.colors.primarySoft,
      borderRadius: t.radius.base,
      paddingVertical: 6,
      paddingHorizontal: 10,
      gap: 6,
      minHeight: 42,
    },
    weatherSpinner: {
      marginRight: 4,
    },
    weatherSeg: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      flexShrink: 0,
    },
    temp: {
      fontFamily: 'Inter_700Bold',
      fontSize: 13,
      color: t.colors.primaryInk,
    },
    degree: {
      fontFamily: 'Inter_400Regular',
      fontSize: 11,
      color: t.colors.primaryInk,
    },
    weatherLabel: {
      fontFamily: 'Inter_400Regular',
      fontSize: 12,
      color: t.colors.primaryInk,
      marginLeft: 2,
    },
    dot: {
      width: 3,
      height: 3,
      borderRadius: 2,
      backgroundColor: t.colors.primaryInk,
      opacity: 0.4,
    },
    sotdSeg: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    emptySeg: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    image: {
      width: 26,
      height: 26,
      borderRadius: 5,
      backgroundColor: t.colors.surface2,
    },
    placeholder: {
      width: 26,
      height: 26,
      borderRadius: 5,
      backgroundColor: t.colors.primarySoft,
      justifyContent: 'center',
      alignItems: 'center',
    },
    info: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      minWidth: 0,
    },
    name: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 12,
      color: t.colors.text,
    },
    brand: {
      fontFamily: 'Inter_400Regular',
      fontSize: 11,
      color: t.colors.textMuted,
    },
    scoreBadge: {
      borderRadius: 6,
      paddingHorizontal: 6,
      paddingVertical: 3,
      marginLeft: 2,
    },
    scoreText: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 10,
    },
    changeBtn: {
      padding: 6,
    },
    emptyTitle: {
      flex: 1,
      fontFamily: 'Inter_500Medium',
      fontSize: 12,
      color: t.colors.primaryInk,
    },
  } as const;
}
