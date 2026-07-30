import { useMemo, useCallback, useState } from 'react';
import { View, Text, Pressable, useWindowDimensions } from 'react-native';
import Ionicons from '@react-native-vector-icons/ionicons/static';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';
import { useTheme, type Theme } from '../../theme/ThemeContext';
import { tintLuminous, tintStructural } from '../../utils/alpha';
import BottleThumb from './BottleThumb';

export interface ShelfCardItem {
  parfumId: string;
  nom: string | null;
  marque: string | null;
  imageUrl: string | null;
  familleOlactive?: string | null;
  addedAt?: Date | null;
}

export type ShelfCardVariant = 'user' | 'system';

export type ShelfSortKey = 'custom' | 'name' | 'brand' | 'family' | 'recent';

const SORT_LABEL: Record<ShelfSortKey, string> = {
  custom: 'Perso',
  name: 'Nom',
  brand: 'Maison',
  family: 'Famille',
  recent: 'Récents',
};

const DEFAULT_SORT_USER: ShelfSortKey[] = ['custom', 'name', 'brand', 'family', 'recent'];
const DEFAULT_SORT_SYSTEM: ShelfSortKey[] = ['recent', 'name', 'brand', 'family'];

const ROWS_COLLAPSED = 2;
const THUMB_SIZE = 64;
const THUMB_GAP = 6;

interface Props {
  name: string;
  icon?: string | null;
  accent?: string | null;
  tagline?: string | null;
  items: ShelfCardItem[];
  variant: ShelfCardVariant;
  expanded: boolean;
  isPublic?: boolean;
  showSort?: boolean;
  sortOptions?: ShelfSortKey[];
  onToggleExpand: () => void;
  onPressBottle: (item: ShelfCardItem) => void;
  onLongPressBottle?: (item: ShelfCardItem) => void;
  onAdd?: () => void;
  onOpenMenu?: () => void;
  onPressEmblem?: () => void;
  emblemAccessibilityLabel?: string;
  drag?: () => void;
  isDragging?: boolean;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function sortItems(items: ShelfCardItem[], key: ShelfSortKey): ShelfCardItem[] {
  if (key === 'custom') return items;
  const copy = [...items];
  const ln = (s: string | null | undefined) => (s ?? '').toLowerCase();
  switch (key) {
    case 'name':
      return copy.sort((a, b) => ln(a.nom).localeCompare(ln(b.nom)));
    case 'brand':
      return copy.sort((a, b) => ln(a.marque).localeCompare(ln(b.marque)) || ln(a.nom).localeCompare(ln(b.nom)));
    case 'family':
      return copy.sort((a, b) => ln(a.familleOlactive).localeCompare(ln(b.familleOlactive)) || ln(a.nom).localeCompare(ln(b.nom)));
    case 'recent':
      return copy.sort((a, b) => {
        const ta = a.addedAt ? a.addedAt.getTime() : -1;
        const tb = b.addedAt ? b.addedAt.getTime() : -1;
        return tb - ta;
      });
    default:
      return copy;
  }
}

export default function ShelfCard({
  name,
  icon,
  accent,
  tagline,
  items,
  variant,
  expanded,
  isPublic = false,
  showSort = true,
  sortOptions,
  onToggleExpand,
  onPressBottle,
  onLongPressBottle,
  onAdd,
  onOpenMenu,
  onPressEmblem,
  emblemAccessibilityLabel,
  drag,
  isDragging,
}: Props) {
  const { theme, resolvedMode } = useTheme();
  const s = useMemo(() => getStyles(theme), [theme]);
  const reduced = useReducedMotion();
  const { width } = useWindowDimensions();

  const options = sortOptions ?? (variant === 'user' ? DEFAULT_SORT_USER : DEFAULT_SORT_SYSTEM);
  const [sortKey, setSortKey] = useState<ShelfSortKey>(options[0]);

  const dyn = useMemo(() => ({
    headerBg: accent ? tintLuminous(accent, 'hint', resolvedMode) : 'transparent',
    ray: accent ? tintStructural(accent, 'dim') : theme.colors.border,
    emblemBg: accent ? tintLuminous(accent, 'veil', resolvedMode) : theme.colors.primarySoft,
    emblemIcon: accent ?? theme.colors.primaryInk,
  }), [accent, resolvedMode, theme]);

  const innerWidth = Math.max(120, width - 32 - 24);
  const cols = Math.max(3, Math.floor((innerWidth + THUMB_GAP) / (Math.round(THUMB_SIZE * 0.78) + THUMB_GAP)));

  const sorted = useMemo(() => sortItems(items, sortKey), [items, sortKey]);
  const visible = expanded ? sorted : sorted.slice(0, cols * ROWS_COLLAPSED);
  const rows = useMemo(() => chunk(visible, cols), [visible, cols]);

  const handleMenu = useCallback(() => { if (onOpenMenu) onOpenMenu(); }, [onOpenMenu]);
  const handleAdd = useCallback(() => { if (onAdd) onAdd(); }, [onAdd]);
  const handleCycleSort = useCallback(() => {
    const idx = options.indexOf(sortKey);
    setSortKey(options[(idx + 1) % options.length]);
  }, [options, sortKey]);

  const toggleLabel = `${name}, ${items.length} parfum${items.length > 1 ? 's' : ''}${isPublic ? ', publique' : ''}, ${expanded ? 'réduire' : 'déplier'}`;
  const showSortBtn = showSort && !isPublic && options.length > 1;
  const sortActive = sortKey !== options[0];
  const canCollapse = items.length > cols * ROWS_COLLAPSED;
  const toggleA11yLabel = canCollapse ? toggleLabel : drag ? `Réorganiser ${name}` : undefined;

  const emblemNode = (
    <View style={[s.emblem, { backgroundColor: dyn.emblemBg }]}>
      <Ionicons name={(icon ?? 'albums-outline') as never} size={15} color={dyn.emblemIcon} />
    </View>
  );
  const emblemPressable = onPressEmblem ? (
    <Pressable
      onPress={onPressEmblem}
      hitSlop={{ top: 9, bottom: 9, left: 9, right: 4 }}
      style={s.emblemHit}
      accessibilityRole="button"
      accessibilityLabel={emblemAccessibilityLabel ?? name}
    >
      {emblemNode}
    </Pressable>
  ) : null;

  return (
    <View style={s.card}>
      <View style={[s.header, { backgroundColor: dyn.headerBg }]}>
        {emblemPressable}
        <Pressable
          style={s.toggleZone}
          onPress={!isDragging && canCollapse ? onToggleExpand : undefined}
          onLongPress={drag}
          delayLongPress={250}
          accessibilityRole={canCollapse || drag ? 'button' : undefined}
          accessibilityLabel={toggleA11yLabel}
          accessibilityHint={drag ? 'Maintiens pour réorganiser' : undefined}
        >
          {onPressEmblem ? null : emblemNode}
          <View style={s.titles}>
            <Text style={s.name} numberOfLines={1}>{name}</Text>
            {tagline ? <Text style={s.tagline} numberOfLines={1}>{tagline}</Text> : null}
          </View>
          {isPublic ? (
            <Ionicons name="globe-outline" size={14} color={theme.colors.primary} accessible={false} />
          ) : null}
          <Text style={s.count} allowFontScaling={false}>{items.length}</Text>
        </Pressable>
        {showSortBtn ? (
          <Pressable
            onPress={handleCycleSort}
            hitSlop={8}
            style={s.sortBtn}
            accessibilityRole="button"
            accessibilityLabel={`Trier par ${SORT_LABEL[sortKey]}`}
          >
            <Ionicons name="swap-vertical-outline" size={14} color={sortActive ? theme.colors.primary : theme.colors.textMuted} />
            <Text style={[s.sortLabel, sortActive && s.sortLabelActive]} allowFontScaling={false}>{SORT_LABEL[sortKey]}</Text>
          </Pressable>
        ) : null}
        {variant === 'user' && onAdd ? (
          <Pressable
            onPress={handleAdd}
            hitSlop={10}
            style={s.headerBtn}
            accessibilityRole="button"
            accessibilityLabel={`Ajouter un parfum à ${name}`}
          >
            <Ionicons name="add-circle-outline" size={20} color={theme.colors.primary} />
          </Pressable>
        ) : null}
        {variant === 'user' && onOpenMenu ? (
          <Pressable
            onPress={handleMenu}
            hitSlop={10}
            style={s.headerBtn}
            accessibilityRole="button"
            accessibilityLabel={`Options de ${name}`}
          >
            <Ionicons name="ellipsis-horizontal" size={18} color={theme.colors.textMuted} />
          </Pressable>
        ) : null}
        {canCollapse ? (
          <Pressable onPress={isDragging ? undefined : onToggleExpand} hitSlop={10} style={s.headerBtn} accessible={false}>
            <Ionicons
              name={expanded ? 'chevron-down' : 'chevron-forward'}
              size={18}
              color={theme.colors.textMuted}
            />
          </Pressable>
        ) : null}
      </View>

      <View style={s.body}>
        {sorted.length === 0 ? (
          <Text style={s.empty}>{variant === 'system' ? 'Rien ici pour l’instant' : 'Étagère vide'}</Text>
        ) : (
          rows.map((row, ri) => (
            <View key={row.map((it) => it.parfumId).join('|')} style={[s.rayRow, { borderBottomColor: dyn.ray }]}>
              {row.map((item, bi) => {
                const gi = ri * cols + bi;
                return (
                  <Animated.View
                    key={item.parfumId}
                    entering={expanded && !reduced ? FadeInDown.delay(Math.min(gi, 12) * 30).duration(200) : undefined}
                  >
                    <BottleThumb
                      item={item}
                      size={THUMB_SIZE}
                      onPress={() => onPressBottle(item)}
                      onLongPress={onLongPressBottle ? () => onLongPressBottle(item) : undefined}
                    />
                  </Animated.View>
                );
              })}
            </View>
          ))
        )}
      </View>
    </View>
  );
}

function getStyles(t: Theme) {
  return {
    card: {
      backgroundColor: t.colors.surface,
      borderRadius: t.radius.card,
      overflow: 'hidden' as const,
      marginBottom: t.spacing.md,
      ...t.shadow.card,
    },
    header: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: 4,
      paddingHorizontal: 12,
      paddingVertical: 12,
    },
    toggleZone: {
      flex: 1,
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: 10,
    },
    emblem: {
      width: 26,
      height: 26,
      borderRadius: 13,
      justifyContent: 'center' as const,
      alignItems: 'center' as const,
    },
    emblemHit: {
      marginRight: 6,
    },
    titles: {
      flex: 1,
      gap: 1,
    },
    name: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 15,
      color: t.colors.text,
    },
    tagline: {
      fontFamily: 'PlayfairDisplay_700Bold_Italic',
      fontSize: 13,
      color: t.colors.textMuted,
    },
    count: {
      fontFamily: 'Inter_700Bold',
      fontSize: 12,
      color: t.colors.textMuted,
      fontVariant: ['tabular-nums'] as import('react-native').FontVariant[],
    },
    sortBtn: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: 3,
      paddingHorizontal: 7,
      paddingVertical: 5,
      borderRadius: 12,
      backgroundColor: t.colors.surface2,
    },
    sortLabel: {
      fontFamily: 'Inter_500Medium',
      fontSize: 10,
      color: t.colors.textMuted,
    },
    sortLabelActive: {
      color: t.colors.primary,
      fontFamily: 'Inter_600SemiBold',
    },
    headerBtn: {
      width: 30,
      height: 30,
      borderRadius: 15,
      justifyContent: 'center' as const,
      alignItems: 'center' as const,
    },
    body: {
      paddingHorizontal: 12,
      paddingTop: 6,
      paddingBottom: 12,
    },
    rayRow: {
      flexDirection: 'row' as const,
      alignItems: 'flex-end' as const,
      gap: THUMB_GAP,
      borderBottomWidth: 1,
      paddingBottom: 2,
      paddingTop: 4,
    },
    empty: {
      fontFamily: 'Inter_400Regular',
      fontSize: 12,
      color: t.colors.textMuted,
      paddingVertical: 8,
    },
  } as const;
}
