// src/features/wardrobe/FilterBar.tsx

import { useMemo, useCallback } from 'react';
import { View, Text, TextInput, ScrollView, Pressable } from 'react-native';
import Ionicons from '@react-native-vector-icons/ionicons/static';
import { useTheme, type Theme } from '../../theme/ThemeContext';
import { statusLabel } from '../catalog/useSaveController';
import { SEASON_META } from '../../utils/season';
import {
  type FavoritesFilters,
  buildActiveChips,
  removeActiveChip,
} from '../../utils/favori-filters';
import type { Shelf, UserParfumStatus } from '../../models/user-parfum.interface';

const SORT_OPTIONS: { key: string; label: string }[] = [
  { key: 'weather', label: 'Météo' },
  { key: 'recent', label: 'Récents' },
  { key: 'rating', label: 'Mieux notés' },
  { key: 'az', label: 'A–Z' },
  { key: 'za', label: 'Z–A' },
];

const STATUS_KEYS: UserParfumStatus[] = ['have', 'had'];

interface Props {
  shelves: Shelf[];
  activeOwnership: string | null;
  activeShelfId: string | null;
  activeSort: string;
  searchQuery: string;
  ownershipCounts: Record<string, number>;
  onOwnershipChange: (o: string | null) => void;
  onShelfChange: (id: string | null) => void;
  onSortChange: (s: string) => void;
  onSearchChange: (q: string) => void;
  onManageShelves: () => void;
  attrFilters: FavoritesFilters;
  attrCount: number;
  onOpenAttrSheet: () => void;
  onAttrFiltersChange: (next: FavoritesFilters) => void;
}

export default function FilterBar({
  shelves,
  activeOwnership,
  activeShelfId,
  activeSort,
  searchQuery,
  ownershipCounts,
  onOwnershipChange,
  onShelfChange,
  onSortChange,
  onSearchChange,
  onManageShelves,
  attrFilters,
  attrCount,
  onOpenAttrSheet,
  onAttrFiltersChange,
}: Props) {
  const { theme, resolvedMode } = useTheme();
  const s = useMemo(() => getStyles(theme), [theme]);
  const keyboardAppearance = resolvedMode === 'dark' ? 'dark' : 'light';

  const currentSortLabel = SORT_OPTIONS.find(o => o.key === activeSort)?.label ?? 'Tri';

  const handleOwnershipTap = (key: string) => {
    onShelfChange(null);
    onOwnershipChange(activeOwnership === key ? null : key);
  };

  const handleShelfTap = (id: string) => {
    onOwnershipChange(null);
    onShelfChange(activeShelfId === id ? null : id);
  };

  const handleAllTap = () => {
    onOwnershipChange(null);
    onShelfChange(null);
  };

  const isAllActive = activeOwnership === null && activeShelfId === null;

  const activeAttrChips = useMemo(() => buildActiveChips(attrFilters), [attrFilters]);

  return (
    <View style={s.container}>
      <View style={s.searchRow}>
        <View style={s.searchWrap}>
          <Ionicons name="search-outline" size={16} color={theme.colors.textMuted} />
          <TextInput
            style={s.searchInput}
            placeholder="Nom, marque ou note..."
            placeholderTextColor={theme.colors.textMuted}
            value={searchQuery}
            onChangeText={onSearchChange}
            keyboardAppearance={keyboardAppearance}
          />
        </View>
        <Pressable style={s.filterBtn} onPress={onOpenAttrSheet} accessibilityLabel="Ouvrir les filtres">
          <Ionicons name="options-outline" size={16} color={attrCount > 0 ? theme.colors.primary : theme.colors.textMuted} />
          <Text style={[s.filterLabel, attrCount > 0 && s.filterLabelActive]}>Filtres</Text>
          {attrCount > 0 && (
            <View style={s.filterBadge}>
              <Text style={s.filterBadgeText} allowFontScaling={false}>{attrCount}</Text>
            </View>
          )}
        </Pressable>
        <Pressable
          style={s.sortBtn}
          onPress={() => {
            const idx = SORT_OPTIONS.findIndex(o => o.key === activeSort);
            const next = SORT_OPTIONS[(idx + 1) % SORT_OPTIONS.length];
            onSortChange(next.key);
          }}
          hitSlop={8}
        >
          <Ionicons name="swap-vertical-outline" size={16} color={theme.colors.primary} />
          <Text style={s.sortLabel}>{currentSortLabel}</Text>
        </Pressable>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.pillsRow}
      >
        <Pressable
          style={[s.pill, isAllActive && s.pillActive]}
          onPress={handleAllTap}
        >
          <Text style={[s.pillText, isAllActive && s.pillTextActive]}>Tous</Text>
        </Pressable>

        {STATUS_KEYS.map(key => (
          <Pressable
            key={key}
            style={[s.pill, activeOwnership === key && s.pillActive]}
            onPress={() => handleOwnershipTap(key)}
          >
            <Text style={[s.pillText, activeOwnership === key && s.pillTextActive]}>
              {statusLabel(key)} · {ownershipCounts[key] ?? 0}
            </Text>
          </Pressable>
        ))}

        {shelves.map(sh => (
          <Pressable
            key={sh.id}
            style={[s.pill, activeShelfId === sh.id && s.pillActive]}
            onPress={() => handleShelfTap(sh.id)}
          >
            {sh.icon && (
              <Ionicons
                name={sh.icon as never}
                size={12}
                color={activeShelfId === sh.id ? theme.colors.primaryInk : theme.colors.textMuted}
              />
            )}
            <Text style={[s.pillText, activeShelfId === sh.id && s.pillTextActive]}>
              {sh.name}
            </Text>
          </Pressable>
        ))}

        <Pressable style={s.pillManage} onPress={onManageShelves}>
          <Ionicons name="add" size={14} color={theme.colors.textMuted} />
        </Pressable>
      </ScrollView>

      {activeAttrChips.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.attrChipsRow}
        >
          {activeAttrChips.map(chip => {
            const isSeason = !!chip.season;
            const seasonToken = isSeason ? SEASON_META[chip.season!].token : null;
            const bg = isSeason && seasonToken ? (theme.colors as Record<string, string>)[`${seasonToken}Soft`] : theme.colors.primarySoft;
            const ink = isSeason && seasonToken ? (theme.colors as Record<string, string>)[seasonToken] : theme.colors.primaryInk;
            return (
              <Pressable
                key={chip.key}
                style={[s.attrChip, { backgroundColor: bg }]}
                onPress={() => onAttrFiltersChange(removeActiveChip(attrFilters, chip))}
              >
                {chip.icon && <Ionicons name={chip.icon as never} size={14} color={ink} />}
                <Text style={[s.attrChipText, { color: ink }]} allowFontScaling={false}>{chip.label}</Text>
                <Ionicons name="close-circle" size={14} color={ink} />
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

function getStyles(t: Theme) {
  return {
    container: {
      paddingHorizontal: 12,
      paddingBottom: 4,
    },
    searchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 8,
    },
    searchWrap: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: t.colors.surface2,
      borderRadius: 20,
      paddingHorizontal: 12,
      height: 38,
      gap: 8,
    },
    searchInput: {
      flex: 1,
      fontFamily: 'Inter_400Regular',
      fontSize: 14,
      color: t.colors.text,
    },
    sortBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
      paddingHorizontal: 8,
      paddingVertical: 6,
    },
    sortLabel: {
      fontFamily: 'Inter_500Medium',
      fontSize: 12,
      color: t.colors.primary,
    },
    filterBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 6,
      minHeight: 44,
      borderRadius: 20,
      backgroundColor: t.colors.surface,
      borderWidth: 1,
      borderColor: t.colors.border,
    },
    filterLabel: {
      fontFamily: 'Inter_500Medium',
      fontSize: 11,
      color: t.colors.textMuted,
    },
    filterLabelActive: {
      color: t.colors.primaryInk,
      fontFamily: 'Inter_600SemiBold',
    },
    filterBadge: {
      width: 16,
      height: 16,
      borderRadius: 8,
      backgroundColor: t.colors.primary,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
    },
    filterBadgeText: {
      fontFamily: 'Inter_700Bold',
      fontSize: 10,
      color: '#FFFFFF',
    },
    attrChipsRow: {
      gap: 8,
      paddingVertical: 6,
      paddingHorizontal: 4,
    },
    attrChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 7,
      borderRadius: 20,
    },
    attrChipText: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 12,
    },
    pillsRow: {
      paddingHorizontal: 4,
      gap: 8,
      alignItems: 'center',
      minHeight: 36,
    },
    pill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 20,
      backgroundColor: t.colors.surface2,
      borderWidth: 1,
      borderColor: 'transparent',
    },
    pillActive: {
      backgroundColor: t.colors.primarySoft,
      borderColor: t.colors.primary,
    },
    pillText: {
      fontFamily: 'Inter_500Medium',
      fontSize: 12,
      color: t.colors.textMuted,
    },
    pillTextActive: {
      color: t.colors.primaryInk,
      fontFamily: 'Inter_600SemiBold',
    },
    pillManage: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: t.colors.surface2,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: t.colors.border,
      borderStyle: 'dashed',
    },
  } as const;
}
