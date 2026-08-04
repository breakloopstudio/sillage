// src/features/wardrobe/SOTDPicker.tsx

import { useState, useMemo, useEffect } from 'react';
import { View, Text, Pressable, TextInput, FlatList, useWindowDimensions, BackHandler } from 'react-native';
import { Image } from 'expo-image';
import Ionicons from '@react-native-vector-icons/ionicons/static';
import { useTheme, type Theme } from '../../theme/ThemeContext';
import { scoreWardrobeItemForWeather } from '../../utils/weather-scoring';
import type { WeatherData } from '../../services/weather';
import type { UserParfum } from '../../models/user-parfum.interface';

interface Props {
  visible: boolean;
  haveItems: UserParfum[];
  currentSotdId: string | null;
  anchorTop: number;
  weather?: WeatherData | null;
  onSelect: (parfumId: string) => void;
  onClose: () => void;
}

export default function SOTDPicker({ visible, haveItems, currentSotdId, anchorTop, weather, onSelect, onClose }: Props) {
  const { theme, resolvedMode } = useTheme();
  const { height: windowHeight } = useWindowDimensions();
  const s = useMemo(() => getStyles(theme), [theme]);
  const keyboardAppearance = resolvedMode === 'dark' ? 'dark' : 'light';
  const [query, setQuery] = useState('');

  const maxSheetHeight = Math.min(360, windowHeight - anchorTop - 80);

  const sorted = useMemo(() => {
    if (!weather) return haveItems;
    return [...haveItems].sort((a, b) => scoreWardrobeItemForWeather(b, weather) - scoreWardrobeItemForWeather(a, weather));
  }, [haveItems, weather]);

  const filtered = useMemo(() => {
    if (!query.trim()) return sorted;
    const q = query.trim().toLowerCase();
    return sorted.filter(i =>
      (i.nom ?? '').toLowerCase().includes(q) ||
      (i.marque ?? '').toLowerCase().includes(q) ||
      (i.parfumId ?? '').replace(/_/g, ' ').toLowerCase().includes(q)
    );
  }, [sorted, query]);

  useEffect(() => {
    if (!visible) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { onClose(); return true; });
    return () => sub.remove();
  }, [visible, onClose]);

  if (!visible) return null;

  return (
    <View style={s.backdrop}>
      <Pressable style={s.backdropTouch} onPress={onClose} />
      <View style={[s.sheet, { top: anchorTop + 4, maxHeight: maxSheetHeight }]}>
        <View style={s.handle} />
        <Text style={s.title}>Parfum du jour</Text>

        <View style={s.searchWrap}>
          <Ionicons name="search-outline" size={18} color={theme.colors.textMuted} />
          <TextInput
            style={s.searchInput}
            placeholder="Rechercher…"
            placeholderTextColor={theme.colors.textMuted}
            value={query}
            onChangeText={setQuery}
            keyboardAppearance={keyboardAppearance}
          />
        </View>

        <FlatList
          data={filtered}
          keyExtractor={item => item.parfumId}
          renderItem={({ item }) => {
            const isCurrent = item.parfumId === currentSotdId;
            const score = weather ? scoreWardrobeItemForWeather(item, weather) : null;
            const scoreColor = score !== null
              ? score >= 75 ? theme.colors.deal
              : score >= 50 ? theme.colors.fair
              : theme.colors.textMuted
              : undefined;

            return (
              <Pressable
                style={s.item}
                onPress={() => {
                  onSelect(item.parfumId);
                }}
              >
                <ImageOrPlaceholder imageUrl={item.imageUrl ?? undefined} recyclingKey={item.parfumId} t={theme} />
                <View style={s.itemText}>
                  <Text style={s.itemName}>{item.nom ?? item.parfumId.replace(/_/g, ' ')}</Text>
                  {item.marque && (
                    <View style={s.brandRow}>
                      <Text style={s.itemBrand}>{item.marque}</Text>
                      {score !== null && (
                        <Text allowFontScaling={false} style={[s.scoreBadge, { color: scoreColor }]}>
                          {' · '}{score}%
                        </Text>
                      )}
                    </View>
                  )}
                </View>
                {isCurrent && (
                  <Ionicons name="checkmark-circle" size={22} color={theme.colors.primary} />
                )}
              </Pressable>
            );
          }}
          style={s.list}
        />
      </View>
    </View>
  );
}

function ImageOrPlaceholder({ imageUrl, recyclingKey, t }: { imageUrl?: string; recyclingKey?: string; t: Theme }) {
  const [failed, setFailed] = useState(false);
  if (!imageUrl || failed) {
    return (
      <View style={{ width: 44, height: 44, borderRadius: 8, backgroundColor: t.colors.surface2, justifyContent: 'center', alignItems: 'center' }}>
        <Ionicons name="flask-outline" size={20} color={t.colors.textMuted} />
      </View>
    );
  }
  return (
    <Image
      source={{ uri: imageUrl }}
      style={{ width: 44, height: 44, borderRadius: 8, backgroundColor: t.colors.surface2 }}
      contentFit="cover"
      cachePolicy="memory-disk"
      recyclingKey={recyclingKey ?? null}
      transition={200}
      onError={() => setFailed(true)}
    />
  );
}

function getStyles(t: Theme) {
  return {
    backdrop: {
      position: 'absolute',
      inset: 0,
      zIndex: 100,
    } as const,
    backdropTouch: {
      ...({ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)' } as const),
    },
    sheet: {
      position: 'absolute',
      left: 16,
      right: 16,
      backgroundColor: t.colors.surface,
      borderRadius: t.radius.card,
      paddingHorizontal: 12,
      paddingBottom: 8,
      ...t.shadow.elevated,
    },
    handle: {
      width: 36,
      height: 5,
      borderRadius: 3,
      backgroundColor: t.colors.border,
      alignSelf: 'center',
      marginTop: 10,
      marginBottom: 12,
    },
    title: {
      fontFamily: 'PlayfairDisplay_600SemiBold',
      fontSize: 18,
      color: t.colors.text,
      marginBottom: 10,
    },
    searchWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: t.colors.surface2,
      borderRadius: t.radius.base,
      paddingHorizontal: 12,
      height: 40,
      gap: 8,
      marginBottom: 6,
    },
    searchInput: {
      flex: 1,
      fontFamily: 'Inter_400Regular',
      fontSize: 14,
      color: t.colors.text,
    },
    list: {
      maxHeight: 260,
    },
    item: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 10,
      gap: 12,
      borderBottomWidth: 0.5,
      borderBottomColor: t.colors.border,
    },
    itemText: {
      flex: 1,
    },
    itemName: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 14,
      color: t.colors.text,
    },
    itemBrand: {
      fontFamily: 'Inter_400Regular',
      fontSize: 12,
      color: t.colors.textMuted,
      marginTop: 1,
    },
    brandRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    scoreBadge: {
      fontFamily: 'Inter_500Medium',
      fontSize: 11,
    },
  } as const;
}
