// src/features/wardrobe/WardrobeGrid.tsx

import { useMemo, useCallback } from 'react';
import { FlatList, ActivityIndicator, View } from 'react-native';
import { useTheme, type Theme } from '../../theme/ThemeContext';
import WardrobeCard from './WardrobeCard';
import type { WardrobeItem } from '../../models/wardrobe.interface';

interface Props {
  items: WardrobeItem[];
  loading?: boolean;
  onItemPress: (item: WardrobeItem) => void;
  onScroll?: (y: number) => void;
}

const CARD_HEIGHT = 212;

export default function WardrobeGrid({ items, loading, onItemPress, onScroll }: Props) {
  const { theme, resolvedMode } = useTheme();
  const s = useMemo(() => getStyles(theme), [theme]);

  const renderItem = useCallback(({ item }: { item: WardrobeItem }) => (
    <WardrobeCard item={item} onPress={() => onItemPress(item)} />
  ), [onItemPress]);

  const getItemLayout = useCallback((_data: unknown, index: number) => ({
    length: CARD_HEIGHT,
    offset: CARD_HEIGHT * Math.floor(index / 2),
    index,
  }), []);

  if (loading) {
    return (
      <View style={s.centered}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <FlatList
      data={items}
      numColumns={2}
      keyExtractor={item => item.parfumId}
      extraData={resolvedMode}
      renderItem={renderItem}
      columnWrapperStyle={s.row}
      contentContainerStyle={s.content}
      showsVerticalScrollIndicator={false}
      onScroll={onScroll ? (e) => onScroll(e.nativeEvent.contentOffset.y) : undefined}
      scrollEventThrottle={16}
      getItemLayout={getItemLayout}
      windowSize={5}
      maxToRenderPerBatch={10}
    />
  );
}

function getStyles(_t: Theme) {
  return {
    centered: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingTop: 40,
    },
    row: {
      gap: 8,
      marginBottom: 8,
    },
    content: {
      paddingHorizontal: 16,
      paddingBottom: 88,
    },
  } as const;
}
