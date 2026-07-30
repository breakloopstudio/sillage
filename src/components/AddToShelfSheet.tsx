import { useMemo, useEffect, useState, useCallback } from 'react';
import { View, Text, Pressable, TextInput, ScrollView, BackHandler } from 'react-native';
import { Image } from 'expo-image';
import Ionicons from '@react-native-vector-icons/ionicons/static';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  cancelAnimation,
  useReducedMotion,
  runOnJS,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, type Theme } from '../theme/ThemeContext';
import { hapticsLight } from '../services/haptics';
import { brandColor } from '../utils/brand-color';
import type { UserParfum } from '../models/user-parfum.interface';

interface Props {
  visible: boolean;
  shelfName: string;
  candidates: UserParfum[];
  onClose: () => void;
  onAdd: (parfumId: string) => Promise<boolean>;
}

export default function AddToShelfSheet({ visible, shelfName, candidates, onClose, onAdd }: Props) {
  const { theme, resolvedMode } = useTheme();
  const s = useMemo(() => getStyles(theme), [theme]);
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const keyboardAppearance = resolvedMode === 'dark' ? 'dark' : 'light';
  const [query, setQuery] = useState('');
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [mounted, setMounted] = useState(visible);

  const translateY = useSharedValue(400);
  const backdropOpacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      backdropOpacity.value = withTiming(1, { duration: reduced ? 0 : 200 });
      translateY.value = reduced ? withTiming(0, { duration: 0 }) : withSpring(0, { damping: 22, stiffness: 280, mass: 0.8 });
    } else if (mounted) {
      backdropOpacity.value = withTiming(0, { duration: reduced ? 0 : 150 });
      translateY.value = withTiming(400, { duration: reduced ? 0 : 200 }, (finished) => {
        if (finished) runOnJS(setMounted)(false);
      });
      setQuery('');
      setAdded(new Set());
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

  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdropOpacity.value }));
  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return candidates.filter((c) => {
      if (added.has(c.parfumId)) return false;
      if (!q) return true;
      return (c.nom ?? '').toLowerCase().includes(q) || (c.marque ?? '').toLowerCase().includes(q);
    });
  }, [candidates, query, added]);

  const handleAdd = useCallback(async (parfumId: string) => {
    hapticsLight();
    setAdded((prev) => { const n = new Set(prev); n.add(parfumId); return n; });
    const ok = await onAdd(parfumId);
    if (!ok) setAdded((prev) => { const n = new Set(prev); n.delete(parfumId); return n; });
  }, [onAdd]);

  if (!mounted) return null;

  return (
    <View style={s.wrapper}>
      <Animated.View style={[s.backdrop, backdropStyle]}>
        <Pressable style={s.backdropTouch} onPress={onClose} />
      </Animated.View>
      <Animated.View style={[s.sheet, { paddingBottom: insets.bottom + 16 }, sheetStyle]}>
        <View style={s.handle} />
        <View style={s.header}>
          <View style={s.headerTexts}>
            <Text style={s.title} numberOfLines={1}>Ajouter à {shelfName}</Text>
            <Text style={s.subtitle}>Choisis un parfum de ta parfumerie</Text>
          </View>
          <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Fermer">
            <Ionicons name="close" size={22} color={theme.colors.text} />
          </Pressable>
        </View>

        <View style={s.searchWrap}>
          <Ionicons name="search-outline" size={16} color={theme.colors.textMuted} />
          <TextInput
            style={s.searchInput}
            placeholder="Rechercher un parfum…"
            placeholderTextColor={theme.colors.textMuted}
            value={query}
            onChangeText={setQuery}
            keyboardAppearance={keyboardAppearance}
          />
        </View>

        <ScrollView style={s.list} showsVerticalScrollIndicator={false}>
          {filtered.length === 0 ? (
            <View style={s.empty}>
              <Ionicons name="checkmark-circle-outline" size={28} color={theme.colors.textMuted} />
              <Text style={s.emptyText}>
                {candidates.length === 0 ? 'Tous tes parfums y sont déjà' : 'Aucun parfum ne correspond'}
              </Text>
            </View>
          ) : (
            filtered.map((c) => {
              const tint = brandColor(c.marque ?? '');
              return (
                <Pressable
                  key={c.parfumId}
                  style={s.row}
                  onPress={() => handleAdd(c.parfumId)}
                  accessibilityRole="button"
                  accessibilityLabel={`Ajouter ${c.marque ?? ''} ${c.nom ?? ''}`}
                >
                  {c.imageUrl ? (
                    <Image source={{ uri: c.imageUrl }} style={s.rowImg} contentFit="contain" />
                  ) : (
                    <View style={[s.rowImgPlaceholder, { backgroundColor: tint }]}>
                      <Text style={s.rowInit} allowFontScaling={false}>{(c.marque ?? '?').charAt(0).toUpperCase()}</Text>
                    </View>
                  )}
                  <View style={s.rowTexts}>
                    <Text style={s.rowBrand} numberOfLines={1}>{c.marque ?? ''}</Text>
                    <Text style={s.rowName} numberOfLines={1}>{c.nom ?? ''}</Text>
                  </View>
                  <Ionicons name="add-circle-outline" size={22} color={theme.colors.primary} />
                </Pressable>
              );
            })
          )}
        </ScrollView>
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
    backdropTouch: { flex: 1 },
    sheet: {
      backgroundColor: t.colors.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingTop: 12,
      paddingHorizontal: 16,
      maxHeight: '85%' as const,
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
    },
    headerTexts: { flex: 1, gap: 2, paddingRight: 8 },
    title: { fontFamily: 'PlayfairDisplay_600SemiBold', fontSize: 18, color: t.colors.text },
    subtitle: { fontFamily: 'Inter_400Regular', fontSize: 12, color: t.colors.textMuted },
    searchWrap: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      backgroundColor: t.colors.surface2,
      borderRadius: 20,
      paddingHorizontal: 12,
      height: 40,
      gap: 8,
      marginBottom: 8,
    },
    searchInput: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 14, color: t.colors.text },
    list: { flexShrink: 1 },
    row: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: 12,
      paddingVertical: 8,
      minHeight: 52,
    },
    rowImg: { width: 32, height: 42 },
    rowImgPlaceholder: {
      width: 32,
      height: 42,
      borderRadius: t.radius.sm,
      justifyContent: 'center' as const,
      alignItems: 'center' as const,
    },
    rowInit: { fontFamily: 'Inter_700Bold', fontSize: 16, color: '#FFFFFF', opacity: 0.5 },
    rowTexts: { flex: 1, gap: 1 },
    rowBrand: {
      fontFamily: 'Inter_400Regular',
      fontSize: 10,
      textTransform: 'uppercase' as const,
      letterSpacing: 1,
      color: t.colors.textMuted,
    },
    rowName: { fontFamily: 'Inter_500Medium', fontSize: 14, color: t.colors.text },
    empty: { alignItems: 'center' as const, paddingVertical: 32, gap: 8 },
    emptyText: { fontFamily: 'Inter_400Regular', fontSize: 13, color: t.colors.textMuted, textAlign: 'center' as const },
  } as const;
}
