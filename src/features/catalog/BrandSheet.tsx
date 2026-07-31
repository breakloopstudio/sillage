// src/features/catalog/BrandSheet.tsx — Bottom sheet alphabétique des marques
// Refonte : strip latérale en colonne sibling (plus d'overlay), offsets exacts,
// loupe Reanimated (zéro re-render pendant le scrub), highlight de la lettre visible.

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { View, Text, Pressable, Modal, FlatList, TextInput, StyleSheet, PanResponder } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@react-native-vector-icons/ionicons/static';
import { useTheme, type Theme } from '../../theme/ThemeContext';
import { textOn } from '../../utils/contrast';
import { hapticsLight } from '../../services/haptics';

const ALL_BRANDS = [
  'Acqua di Parma', 'Amouage', 'Armani', 'Armaf',
  'Bentley', 'Burberry', 'Byredo',
  'Calvin Klein', 'Carolina Herrera', 'Cartier', 'Cerruti', 'Chanel', 'Chloé', 'Creed',
  'Davidoff', 'Diptyque', 'Dior', 'Dolce & Gabbana',
  'Essential Parfums',
  'Givenchy', 'Gucci', 'Guerlain',
  'Hermès', 'Hugo Boss',
  'Issey Miyake',
  'Jean Paul Gaultier', 'Jo Malone',
  'Kenzo',
  'Lalique', 'Lancôme', 'Lattafa', 'Le Labo', 'Loewe',
  'Maison Francis Kurkdjian', 'Maison Margiela', 'Mancera', 'Montblanc', 'Mugler',
  'Narciso Rodriguez', 'Nishane',
  'Paco Rabanne', 'Parfums de Marly', 'Penhaligon\'s', 'Prada',
  'Ralph Lauren', 'Rasasi', 'Roja Dove',
  'Salvatore Ferragamo', 'Serge Lutens',
  'Tom Ford', 'Tommy Hilfiger',
  'Valentino', 'Van Cleef & Arpels', 'Versace', 'Viktor & Rolf',
  'Xerjoff',
  'Yves Saint Laurent',
  'Zadig & Voltaire', 'Zara',
];

// Hauteurs fixes → offsets exacts, zéro dérive
const ROW_H = 48;
const HEADER_H = 40;
const SECTION_GAP = 12;
const LOUPE_SIZE = 56;

interface Section { letter: string; brands: string[] }

function groupByLetter(brands: string[]): Section[] {
  const groups: Section[] = [];
  for (const brand of brands) {
    const letter = brand.charAt(0).toUpperCase();
    const last = groups[groups.length - 1];
    if (last && last.letter === letter) {
      last.brands.push(brand);
    } else {
      groups.push({ letter, brands: [brand] });
    }
  }
  return groups;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  onSelectBrand: (brand: string) => void;
}

export default function BrandSheet({ visible, onClose, onSelectBrand }: Props) {
  const { theme, resolvedMode } = useTheme();
  const s = useMemo(() => getStyles(theme), [theme]);
  const insets = useSafeAreaInsets();
  const keyboardAppearance = resolvedMode === 'dark' ? 'dark' : 'light';

  const [search, setSearch] = useState('');
  const [scrubLetter, setScrubLetter] = useState<string | null>(null);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [visibleLetter, setVisibleLetter] = useState<string | null>(null);

  const stripRef = useRef<View>(null);
  const stripHeightRef = useRef(0);
  const stripPageYRef = useRef(0);
  const stripOffsetYRef = useRef(0);
  const lastLetterRef = useRef<string | null>(null);
  const visibleLetterRef = useRef<string | null>(null);
  const listRef = useRef<FlatList<Section>>(null);

  // Loupe animée sur le UI thread — zéro re-render JS pendant le scrub
  const loupeY = useSharedValue(0);

  const filtered = useMemo(() => {
    if (!search.trim()) return ALL_BRANDS;
    const q = search.trim().toLowerCase();
    return ALL_BRANDS.filter(b => b.toLowerCase().includes(q));
  }, [search]);

  const sections = useMemo(() => groupByLetter(filtered), [filtered]);
  const letterIndex = useMemo(() => sections.map(sec => sec.letter), [sections]);
  const listContent = useMemo(() => ({ paddingBottom: insets.bottom + 20 }), [insets.bottom]);

  // Offsets exacts par lettre (hauteurs fixes)
  const offsets = useMemo(() => {
    const map: Record<string, number> = {};
    let y = 0;
    for (const sec of sections) {
      map[sec.letter] = y;
      y += HEADER_H + sec.brands.length * ROW_H + SECTION_GAP;
    }
    return map;
  }, [sections]);

  const activeLetter = scrubLetter ?? visibleLetter;

  const handleSelect = useCallback((brand: string) => {
    onSelectBrand(brand);
    setSearch('');
    onClose();
  }, [onSelectBrand, onClose]);

  const handleClose = useCallback(() => {
    setSearch('');
    onClose();
  }, [onClose]);

  const scrollToLetter = useCallback((letter: string) => {
    const y = offsets[letter];
    if (y !== undefined) {
      listRef.current?.scrollToOffset({ offset: Math.max(0, y - 4), animated: false });
    }
  }, [offsets]);

  // Reset scroll quand la recherche change
  useEffect(() => {
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
    visibleLetterRef.current = null;
    setVisibleLetter(null);
  }, [search]);

  // Highlight de la lettre visible pendant le scroll normal
  const handleScroll = useCallback((e: { nativeEvent: { contentOffset: { y: number } } }) => {
    const y = e.nativeEvent.contentOffset.y;
    let current: string | null = null;
    for (const letter of letterIndex) {
      if (offsets[letter] <= y + 4) current = letter;
      else break;
    }
    if (current !== visibleLetterRef.current) {
      visibleLetterRef.current = current;
      setVisibleLetter(current);
    }
  }, [letterIndex, offsets]);

  // Cellules flex:1 → mapping exact y → lettre ; loupe clampée dans les bornes
  const handleScrubY = useCallback((pageY: number) => {
    const h = stripHeightRef.current;
    const n = letterIndex.length;
    if (h <= 0 || n === 0) return;

    const relativeY = pageY - stripPageYRef.current;
    const clamped = Math.min(Math.max(relativeY, 0), h);

    loupeY.value = stripOffsetYRef.current + Math.min(Math.max(relativeY, LOUPE_SIZE / 2), h - LOUPE_SIZE / 2);

    const cell = h / n;
    const idx = Math.max(0, Math.min(n - 1, Math.floor(clamped / cell)));
    const letter = letterIndex[idx];

    if (letter && letter !== lastLetterRef.current) {
      lastLetterRef.current = letter;
      setScrubLetter(letter);
      scrollToLetter(letter);
      hapticsLight();
    }
  }, [letterIndex, scrollToLetter, loupeY]);

  // PanResponder recréé quand la strip change (pas de refs-miroir)
  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (evt) => {
      setIsScrubbing(true);
      handleScrubY(evt.nativeEvent.pageY);
    },
    onPanResponderMove: (evt) => {
      handleScrubY(evt.nativeEvent.pageY);
    },
    onPanResponderRelease: () => {
      setIsScrubbing(false);
      setScrubLetter(null);
      lastLetterRef.current = null;
    },
    onPanResponderTerminate: () => {
      setIsScrubbing(false);
      setScrubLetter(null);
      lastLetterRef.current = null;
    },
  }), [handleScrubY]);

  const loupeStyle = useAnimatedStyle(() => ({
    top: loupeY.value - LOUPE_SIZE / 2,
  }));

  const renderSection = useCallback(({ item }: { item: Section }) => (
    <View style={s.section}>
      <Text style={s.letter}>{item.letter}</Text>
      {item.brands.map(brand => (
        <Pressable
          key={brand}
          style={({ pressed }) => [s.brandItem, pressed && s.brandItemPressed]}
          onPress={() => handleSelect(brand)}
        >
          <Text style={s.brandText}>{brand}</Text>
          <Ionicons name="chevron-forward" size={16} color={theme.colors.textMuted} />
        </Pressable>
      ))}
    </View>
  ), [s, theme, handleSelect]);

  const showStrip = letterIndex.length > 1 && !search.trim();

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <View style={[s.container, { paddingTop: insets.top }]}>
        <View style={s.handleBar}>
          <View style={s.handle} />
        </View>

        <View style={s.header}>
          <Text style={s.title}>Toutes les marques</Text>
          <Pressable onPress={handleClose} hitSlop={12}>
            <Ionicons name="close" size={24} color={theme.colors.textMuted} />
          </Pressable>
        </View>

        <View style={s.searchRow}>
          <View style={s.searchWrap}>
            <Ionicons name="search-outline" size={16} color={theme.colors.textMuted} />
            <TextInput
              style={s.searchInput}
              placeholder="Rechercher une marque..."
              placeholderTextColor={theme.colors.textMuted}
              value={search}
              onChangeText={setSearch}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardAppearance={keyboardAppearance}
            />
            {search.length > 0 && (
              <Pressable onPress={() => setSearch('')} hitSlop={8}>
                <Ionicons name="close-circle" size={16} color={theme.colors.textMuted} />
              </Pressable>
            )}
          </View>
        </View>

        <View style={s.listWrap}>
          {filtered.length === 0 ? (
            <View style={s.emptyWrap}>
              <Ionicons name="search-outline" size={32} color={theme.colors.textMuted} style={{ opacity: 0.5 }} />
              <Text style={s.emptyText}>Aucune marque trouvée</Text>
            </View>
          ) : (
            <FlatList<Section>
              style={s.list}
              ref={listRef}
              data={sections}
              keyExtractor={item => item.letter}
              getItemLayout={(_, index) => {
                const offset = sections.slice(0, index).reduce(
                  (acc, s2) => acc + HEADER_H + s2.brands.length * ROW_H + SECTION_GAP, 0,
                );
                return {
                  length: HEADER_H + sections[index].brands.length * ROW_H + SECTION_GAP,
                  offset,
                  index,
                };
              }}
              renderItem={renderSection}
              onScroll={handleScroll}
              scrollEventThrottle={32}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={listContent}
            />
          )}

          {showStrip && (
            <View
              ref={stripRef}
              style={s.strip}
              onLayout={(e) => {
                stripHeightRef.current = e.nativeEvent.layout.height;
                stripOffsetYRef.current = e.nativeEvent.layout.y;
                stripRef.current?.measureInWindow((_x, y) => {
                  stripPageYRef.current = y;
                });
              }}
              {...panResponder.panHandlers}
            >
              {letterIndex.map(letter => {
                const active = activeLetter === letter;
                return (
                  <View key={letter} style={s.stripCell}>
                    <View style={[s.stripPill, active && s.stripPillActive]}>
                      <Text
                        style={[s.stripText, active && s.stripTextActive]}
                        allowFontScaling={false}
                      >
                        {letter}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {isScrubbing && scrubLetter && (
            <Animated.View style={[s.loupe, loupeStyle]} pointerEvents="none">
              <Text style={s.loupeText} allowFontScaling={false}>{scrubLetter}</Text>
            </Animated.View>
          )}
        </View>
      </View>
    </Modal>
  );
}

function getStyles(t: Theme) {
  return {
    container: { flex: 1, backgroundColor: t.colors.background },
    handleBar: { alignItems: 'center', paddingVertical: 10 },
    handle: { width: 36, height: 4, backgroundColor: t.colors.border, borderRadius: 2 },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 20, paddingBottom: 14,
    },
    title: { fontFamily: 'PlayfairDisplay_700Bold', fontSize: 26, color: t.colors.text },
    searchRow: { paddingHorizontal: 16, paddingBottom: 12 },
    searchWrap: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: t.colors.surface2, borderRadius: 14,
      paddingHorizontal: 14, height: 44, gap: 10,
    },
    searchInput: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 15, color: t.colors.text, padding: 0 },
    listWrap: { flex: 1, flexDirection: 'row' },
    list: { flex: 1 },
    section: { paddingHorizontal: 20, marginBottom: SECTION_GAP },
    letter: {
      fontFamily: 'PlayfairDisplay_600SemiBold', fontSize: 17, color: t.colors.primary,
      height: HEADER_H, textAlignVertical: 'center',
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.colors.border,
    },
    brandItem: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      height: ROW_H, paddingHorizontal: 8, borderRadius: 8,
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.colors.surface2,
    },
    brandItemPressed: { backgroundColor: t.colors.surface2 },
    brandText: { fontFamily: 'Inter_500Medium', fontSize: 15, color: t.colors.text },
    emptyWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 10 },
    emptyText: { fontFamily: 'Inter_400Regular', fontSize: 14, color: t.colors.textMuted },
    // Strip latérale — colonne sibling, pas d'overlay sur la liste
    strip: {
      width: 30,
      marginRight: 4,
      borderRadius: 10,
      backgroundColor: t.colors.surface2,
      alignSelf: 'center',
      paddingVertical: 4,
    },
    stripCell: { width: 30, height: 17, justifyContent: 'center', alignItems: 'center' },
    stripPill: {
      minWidth: 18, height: 13, borderRadius: 7,
      justifyContent: 'center', alignItems: 'center',
      paddingHorizontal: 2,
    },
    stripPillActive: { backgroundColor: t.colors.primary },
    stripText: { fontFamily: 'Inter_600SemiBold', fontSize: 9, color: t.colors.textMuted },
    stripTextActive: { color: textOn(t.colors.primary) },
    loupe: {
      position: 'absolute',
      right: 44,
      width: LOUPE_SIZE, height: LOUPE_SIZE, borderRadius: LOUPE_SIZE / 2,
      backgroundColor: t.colors.primary,
      justifyContent: 'center', alignItems: 'center',
      ...t.shadow.elevated,
      zIndex: 20,
    },
    loupeText: {
      fontFamily: 'PlayfairDisplay_700Bold', fontSize: 24, color: textOn(t.colors.primary),
    },
  } as const;
}
