import { useMemo, useEffect, useState, useCallback } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator, BackHandler } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
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
import type { PublicShelfItem } from '../models';

type Phase = 'idle' | 'loading' | 'done' | 'error';

interface Props {
  visible: boolean;
  shelfName: string;
  ownerPseudo: string;
  items: PublicShelfItem[];
  onClose: () => void;
  onConfirm: () => Promise<number>;
}

export default function InspireShelfSheet({ visible, shelfName, ownerPseudo, items, onClose, onConfirm }: Props) {
  const { theme } = useTheme();
  const s = useMemo(() => getStyles(theme), [theme]);
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const router = useRouter();

  const [phase, setPhase] = useState<Phase>('idle');
  const [addedCount, setAddedCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(visible);

  const translateY = useSharedValue(500);
  const backdropOpacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      setPhase('idle');
      setAddedCount(0);
      setError(null);
      backdropOpacity.value = withTiming(1, { duration: reduced ? 0 : 200 });
      translateY.value = reduced ? withTiming(0, { duration: 0 }) : withSpring(0, { damping: 22, stiffness: 280, mass: 0.8 });
    } else if (mounted) {
      backdropOpacity.value = withTiming(0, { duration: reduced ? 0 : 150 });
      translateY.value = withTiming(500, { duration: reduced ? 0 : 200 }, (finished) => {
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

  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdropOpacity.value }));
  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));

  const handleConfirm = useCallback(async () => {
    if (phase === 'loading') return;
    hapticsLight();
    setPhase('loading');
    setError(null);
    try {
      const n = await onConfirm();
      if (n > 0) {
        setAddedCount(n);
        setPhase('done');
      } else {
        setPhase('error');
        setError('Aucun parfum n’a pu être ajouté. Réessaie.');
      }
    } catch {
      setPhase('error');
      setError('L’ajout a échoué. Réessaie.');
    }
  }, [phase, onConfirm]);

  const handleViewParfumerie = useCallback(() => {
    onClose();
    router.push('/(tabs)/collection');
  }, [onClose, router]);

  if (!mounted) return null;

  const count = items.length;
  const title = phase === 'done' ? 'Ajouté à « À sentir »' : `S’inspirer de « ${shelfName} »`;
  const subtitle = phase === 'done'
    ? `${addedCount} parfum${addedCount > 1 ? 's' : ''} dans ta parfumerie`
    : `@${ownerPseudo} · ${count} parfum${count > 1 ? 's' : ''} à ajouter`;

  return (
    <View style={s.wrapper}>
      <Animated.View style={[s.backdrop, backdropStyle]}>
        <Pressable style={s.backdropTouch} onPress={onClose} />
      </Animated.View>
      <Animated.View style={[s.sheet, { paddingBottom: insets.bottom + 16 }, sheetStyle]}>
        <View style={s.handle} />

        <View style={s.header}>
          <View style={s.headerIcon}>
            <Ionicons
              name={phase === 'done' ? 'checkmark-circle' : 'sparkles-outline'}
              size={18}
              color={phase === 'done' ? theme.colors.dealInk : theme.colors.primaryInk}
            />
          </View>
          <View style={s.headerTexts}>
            <Text style={s.title} numberOfLines={1}>{title}</Text>
            <Text style={s.subtitle} numberOfLines={2}>{subtitle}</Text>
          </View>
          <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Fermer">
            <Ionicons name="close" size={22} color={theme.colors.text} />
          </Pressable>
        </View>

        {phase === 'done' ? (
          <View style={s.doneWrap}>
            <View style={s.doneIcon}>
              <Ionicons name="flask-outline" size={28} color={theme.colors.deal} />
            </View>
            <Text style={s.doneText}>Tu les retrouveras dans « À sentir », prêts à être essayés en boutique.</Text>
          </View>
        ) : (
          <ScrollView style={s.list} showsVerticalScrollIndicator={false}>
            {items.map((it) => {
              const tint = brandColor(it.marque ?? '');
              return (
                <View key={it.parfumId} style={s.row}>
                  {it.imageUrl ? (
                    <Image source={{ uri: it.imageUrl }} style={s.rowImg} contentFit="contain" cachePolicy="memory-disk" recyclingKey={it.parfumId} transition={200} />
                  ) : (
                    <View style={[s.rowImgPlaceholder, { backgroundColor: tint }]}>
                      <Text style={s.rowInit} allowFontScaling={false}>{(it.marque ?? '?').charAt(0).toUpperCase()}</Text>
                    </View>
                  )}
                  <View style={s.rowTexts}>
                    <Text style={s.rowBrand} numberOfLines={1}>{it.marque ?? ''}</Text>
                    <Text style={s.rowName} numberOfLines={1}>{it.nom ?? ''}</Text>
                  </View>
                </View>
              );
            })}
            {error ? <Text style={s.error}>{error}</Text> : null}
          </ScrollView>
        )}

        {phase === 'done' ? (
          <Pressable style={s.cta} onPress={handleViewParfumerie} accessibilityRole="button" accessibilityLabel="Voir ma parfumerie">
            <Ionicons name="flask-outline" size={18} color="#FFFFFF" />
            <Text style={s.ctaText} allowFontScaling={false}>Voir ma parfumerie</Text>
          </Pressable>
        ) : (
          <Pressable
            style={[s.cta, phase === 'loading' && s.ctaDisabled]}
            onPress={handleConfirm}
            disabled={phase === 'loading' || count === 0}
            accessibilityRole="button"
            accessibilityLabel={`Ajouter ${count} parfum${count > 1 ? 's' : ''} à À sentir`}
          >
            {phase === 'loading' ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="add-circle-outline" size={18} color="#FFFFFF" />
                <Text style={s.ctaText} allowFontScaling={false}>Ajouter {count} à « À sentir »</Text>
              </>
            )}
          </Pressable>
        )}
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
      alignItems: 'flex-start' as const,
      gap: 10,
      paddingBottom: 12,
    },
    headerIcon: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: t.colors.primarySoft,
      justifyContent: 'center' as const,
      alignItems: 'center' as const,
    },
    headerTexts: { flex: 1, gap: 3 },
    title: { fontFamily: 'PlayfairDisplay_600SemiBold', fontSize: 17, color: t.colors.text },
    subtitle: { fontFamily: 'Inter_400Regular', fontSize: 12, color: t.colors.textMuted, lineHeight: 17 },
    list: { flexShrink: 1, maxHeight: 320 },
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
    error: { fontFamily: 'Inter_500Medium', fontSize: 12, color: t.colors.overpriced, paddingVertical: 8 },
    doneWrap: { alignItems: 'center' as const, paddingVertical: 24, gap: 12 },
    doneIcon: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: t.colors.dealSoft,
      justifyContent: 'center' as const,
      alignItems: 'center' as const,
    },
    doneText: {
      fontFamily: 'Inter_400Regular',
      fontSize: 14,
      color: t.colors.textMuted,
      textAlign: 'center' as const,
      lineHeight: 21,
      paddingHorizontal: 16,
    },
    cta: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      gap: 8,
      marginTop: 12,
      backgroundColor: t.colors.primary,
      borderRadius: t.radius.base,
      paddingVertical: 14,
      minHeight: 48,
      ...t.shadow.button,
    },
    ctaDisabled: { opacity: 0.7 },
    ctaText: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: '#FFFFFF' },
  } as const;
}
