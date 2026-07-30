// src/components/FilterSheet.tsx — Bottom sheet multi-facettes pour les filtres
// Famille / Saison / Tenue / Sillage — chips multi-sélection, compteurs, application live
// Partagé entre Favoris et Parfumerie

import { useState, useMemo, useEffect, useCallback } from 'react';
import { View, Text, Pressable, ScrollView, useWindowDimensions, BackHandler } from 'react-native';
import Ionicons from '@react-native-vector-icons/ionicons/static';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withSpring, cancelAnimation, runOnJS, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, type Theme } from '../theme/ThemeContext';
import { translateNote } from '../utils/translate-note';
import { SEASON_ORDER, SEASON_META, SEASON_MATCH_THRESHOLD, type SeasonKey } from '../utils/season';
import {
  type FavoritesFilters,
  type LongevityBucket,
  type SillageFilterId,
  type FilterableItem,
  LONGEVITY_OPTIONS,
  SILLAGE_OPTIONS,
  longevityBucket,
  sillageBucket,
  hasActiveFilters,
} from '../utils/favori-filters';

interface FilterSheetProps {
  visible: boolean;
  items: FilterableItem[];
  filters: FavoritesFilters;
  resultCount: number;
  onFiltersChange: (next: FavoritesFilters) => void;
  onReset: () => void;
  onClose: () => void;
}

interface FilterChipProps {
  label: string;
  count: number;
  active: boolean;
  onPress: () => void;
  icon?: string;
  activeBg?: string;
  activeInk?: string;
}

function toggleValue<T>(arr: readonly T[], v: T): T[] {
  return arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v];
}

function FilterChip({ label, count, active, onPress, icon, activeBg, activeInk }: FilterChipProps) {
  const { theme } = useTheme();
  const s = useMemo(() => getStyles(theme), [theme]);
  const chipActiveBg = activeBg ?? theme.colors.primarySoft;
  const chipActiveInk = activeInk ?? theme.colors.primaryInk;
  const bg = active ? chipActiveBg : theme.colors.surface2;
  const ink = active ? chipActiveInk : theme.colors.text;
  const iconColor = active ? chipActiveInk : theme.colors.textMuted;
  const countColor = active ? chipActiveInk : theme.colors.textMuted;

  return (
    <Pressable style={[s.chip, { backgroundColor: bg }]} onPress={onPress}>
      {icon ? <Ionicons name={icon as never} size={14} color={iconColor} /> : null}
      <Text style={[s.chipLabel, { color: ink }]} allowFontScaling={false}>{label}</Text>
      <Text style={[s.chipCount, { color: countColor }]} allowFontScaling={false}>{count}</Text>
    </Pressable>
  );
}

export default function FilterSheet({ visible, items, filters, resultCount, onFiltersChange, onReset, onClose }: FilterSheetProps) {
  const { theme } = useTheme();
  const s = useMemo(() => getStyles(theme), [theme]);
  const insets = useSafeAreaInsets();
  const { height: winH } = useWindowDimensions();
  const reduced = useReducedMotion();

  const translateY = useSharedValue(300);
  const backdropOpacity = useSharedValue(0);
  const [mounted, setMounted] = useState(visible);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      backdropOpacity.value = withTiming(1, { duration: reduced ? 0 : 200 });
      translateY.value = reduced ? withTiming(0, { duration: 0 }) : withSpring(0, { damping: 22, stiffness: 280, mass: 0.8 });
    } else if (mounted) {
      backdropOpacity.value = withTiming(0, { duration: reduced ? 0 : 150 });
      translateY.value = withTiming(300, { duration: reduced ? 0 : 200 }, (finished) => {
        if (finished) runOnJS(setMounted)(false);
      });
    }
    return () => {
      cancelAnimation(backdropOpacity);
      cancelAnimation(translateY);
    };
  }, [visible, reduced]);

  useEffect(() => {
    if (!visible) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { onClose(); return true; });
    return () => sub.remove();
  }, [visible, onClose]);

  const backdropAnim = useAnimatedStyle(() => ({ opacity: backdropOpacity.value }));
  const sheetAnim = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));

  const counts = useMemo(() => {
    const families = new Map<string, number>();
    const seasons: Record<SeasonKey, number> = { spring: 0, summer: 0, fall: 0, winter: 0 };
    const longevities: Record<LongevityBucket, number> = { weak: 0, moderate: 0, long: 0, eternal: 0 };
    const sillages: Record<SillageFilterId, number> = { intimate: 0, moderate: 0, powerful: 0 };
    for (const f of items) {
      if (f.familleOlactive) {
        families.set(f.familleOlactive, (families.get(f.familleOlactive) ?? 0) + 1);
      }
      const scores = f.seasonScores;
      if (scores) {
        for (const k of SEASON_ORDER) {
          if ((scores[k] ?? 0) >= SEASON_MATCH_THRESHOLD) seasons[k]++;
        }
      }
      const lb = longevityBucket(f.longevity);
      if (lb) longevities[lb]++;
      const sb = sillageBucket(f.sillage);
      if (sb) {
        const opt = SILLAGE_OPTIONS.find(o => o.buckets.includes(sb));
        if (opt) sillages[opt.id]++;
      }
    }
    return {
      families: [...families.entries()].sort((a, b) => b[1] - a[1]),
      seasons,
      longevities,
      sillages,
    };
  }, [items]);

  const handleClose = useCallback(() => onClose(), [onClose]);
  const handleReset = useCallback(() => onReset(), [onReset]);

  const toggleFamily = useCallback((fam: string) => {
    onFiltersChange({ ...filters, families: toggleValue(filters.families, fam) });
  }, [filters, onFiltersChange]);

  const toggleSeason = useCallback((k: SeasonKey) => {
    onFiltersChange({ ...filters, seasons: toggleValue(filters.seasons, k) });
  }, [filters, onFiltersChange]);

  const toggleLongevity = useCallback((b: LongevityBucket) => {
    onFiltersChange({ ...filters, longevity: toggleValue(filters.longevity, b) });
  }, [filters, onFiltersChange]);

  const toggleSillage = useCallback((id: SillageFilterId) => {
    onFiltersChange({ ...filters, sillage: toggleValue(filters.sillage, id) });
  }, [filters, onFiltersChange]);

  const showReset = hasActiveFilters(filters);
  const footerLabel = resultCount === 0 ? 'Aucun résultat' : `Voir les ${resultCount} résultat${resultCount > 1 ? 's' : ''}`;

  if (!mounted) return null;

  return (
    <View style={s.wrapper}>
      <Animated.View style={[s.backdrop, backdropAnim]}>
        <Pressable style={s.backdropTouch} onPress={handleClose} />
      </Animated.View>
      <Animated.View style={[s.sheet, { maxHeight: winH * 0.75, paddingBottom: insets.bottom + 12 }, sheetAnim]}>
        <View style={s.handle} />

        <View style={s.header}>
          <Text style={s.title}>Filtres</Text>
          {showReset ? (
            <Pressable onPress={handleReset} hitSlop={8}>
              <Text style={s.resetLabel}>Réinitialiser</Text>
            </Pressable>
          ) : null}
        </View>

        <ScrollView showsVerticalScrollIndicator={false} style={s.scroll} contentContainerStyle={s.scrollContent}>
          <Text style={s.sectionLabel}>Famille</Text>
          <View style={s.chipsWrap}>
            {counts.families.map(([fam, cnt]) => (
              <FilterChip
                key={fam}
                label={translateNote(fam)}
                count={cnt}
                active={filters.families.includes(fam)}
                onPress={() => toggleFamily(fam)}
              />
            ))}
          </View>

          <Text style={s.sectionLabel}>Saison</Text>
          <View style={s.chipsWrap}>
            {SEASON_ORDER.map(k => {
              const meta = SEASON_META[k];
              const cnt = counts.seasons[k];
              const active = filters.seasons.includes(k);
              return (
                <FilterChip
                  key={k}
                  label={meta.label}
                  count={cnt}
                  active={active}
                  onPress={() => toggleSeason(k)}
                  icon={meta.icon}
                  activeBg={theme.colors[meta.tokenSoft]}
                  activeInk={theme.colors[meta.token]}
                />
              );
            })}
          </View>

          <Text style={s.sectionLabel}>Tenue</Text>
          <View style={s.chipsWrap}>
            {LONGEVITY_OPTIONS.map(opt => (
              <FilterChip
                key={opt.bucket}
                label={opt.label}
                count={counts.longevities[opt.bucket]}
                active={filters.longevity.includes(opt.bucket)}
                onPress={() => toggleLongevity(opt.bucket)}
              />
            ))}
          </View>

          <Text style={s.sectionLabel}>Sillage</Text>
          <View style={s.chipsWrap}>
            {SILLAGE_OPTIONS.map(opt => (
              <FilterChip
                key={opt.id}
                label={opt.label}
                count={counts.sillages[opt.id]}
                active={filters.sillage.includes(opt.id)}
                onPress={() => toggleSillage(opt.id)}
              />
            ))}
          </View>
        </ScrollView>

        <Pressable style={[s.footerBtn, { backgroundColor: theme.colors.primary }]} onPress={handleClose}>
          <Text style={s.footerLabel}>{footerLabel}</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

function getStyles(t: Theme) {
  return {
    wrapper: {
      position: 'absolute' as const,
      inset: 0,
      zIndex: 100,
      justifyContent: 'flex-end' as const,
    },
    backdrop: {
      ...({ position: 'absolute' as const, inset: 0, backgroundColor: 'rgba(0,0,0,0.4)' } as const),
    },
    backdropTouch: {
      flex: 1,
    },
    sheet: {
      backgroundColor: t.colors.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingTop: 12,
      paddingHorizontal: 16,
      gap: 4,
      ...t.shadow.elevated,
    },
    handle: {
      alignSelf: 'center' as const,
      width: 36,
      height: 5,
      borderRadius: 3,
      backgroundColor: t.colors.border,
      marginBottom: 12,
    },
    header: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'space-between' as const,
      paddingBottom: 12,
      borderBottomWidth: 0.5,
      borderBottomColor: t.colors.border,
      marginBottom: 4,
    },
    title: {
      fontFamily: 'PlayfairDisplay_600SemiBold',
      fontSize: 17,
      color: t.colors.text,
    },
    resetLabel: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 13,
      color: t.colors.primary,
    },
    scroll: {
      flexShrink: 1,
    },
    scrollContent: {
      paddingTop: 4,
      gap: 4,
    },
    sectionLabel: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 13,
      color: t.colors.text,
      marginTop: 16,
      marginBottom: 8,
    },
    chipsWrap: {
      flexDirection: 'row' as const,
      flexWrap: 'wrap' as const,
      gap: 8,
    },
    chip: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: 5,
      paddingHorizontal: 12,
      paddingVertical: 10,
      minHeight: 44,
      borderRadius: 20,
    },
    chipLabel: {
      fontFamily: 'Inter_500Medium',
      fontSize: 12,
    },
    chipCount: {
      fontFamily: 'Inter_400Regular',
      fontSize: 11,
    },
    footerBtn: {
      marginTop: 16,
      height: 50,
      borderRadius: t.radius.base,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      ...t.shadow.button,
    },
    footerLabel: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 15,
      color: '#FFFFFF',
    },
  } as const;
}
