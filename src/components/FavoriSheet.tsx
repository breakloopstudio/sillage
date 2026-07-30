// src/components/FavoriSheet.tsx — Sheet long-press du tab Favoris
// Voir la fiche · Alerte prix · Envoyer dans ma parfumerie (statut) · Retirer des favoris

import { useMemo, useEffect, useState, useCallback } from 'react';
import { View, Text, Pressable, BackHandler } from 'react-native';
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
import { STATUS_CHIPS, chipForStatus } from '../utils/status-chips';
import type { UserParfumStatus } from '../models/user-parfum.interface';

interface Props {
  visible: boolean;
  nom: string;
  marque: string;
  imageUrl: string | null;
  status: UserParfumStatus | null;
  hasAlert: boolean;
  onClose: () => void;
  onView: () => void;
  onAlerte: () => void;
  onSetStatus: (status: UserParfumStatus) => void;
  onRemove: () => void;
}

export default function FavoriSheet({
  visible, nom, marque, imageUrl, status, hasAlert,
  onClose, onView, onAlerte, onSetStatus, onRemove,
}: Props) {
  const { theme } = useTheme();
  const s = useMemo(() => getStyles(theme), [theme]);
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const [imgFailed, setImgFailed] = useState(false);
  const [mounted, setMounted] = useState(visible);

  const translateY = useSharedValue(300);
  const backdropOpacity = useSharedValue(0);

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

  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdropOpacity.value }));
  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));

  const handleView = useCallback(() => { hapticsLight(); onView(); }, [onView]);
  const handleAlerte = useCallback(() => { hapticsLight(); onAlerte(); }, [onAlerte]);
  const handleStatus = useCallback((st: UserParfumStatus) => { hapticsLight(); onSetStatus(st); }, [onSetStatus]);
  const handleRemove = useCallback(() => { hapticsLight(); onRemove(); }, [onRemove]);

  if (!mounted) return null;

  const activeChip = chipForStatus(status);
  const sectionLabel = status === null ? 'Envoyer dans ma parfumerie' : 'Ton statut';

  return (
    <View style={s.wrapper}>
      <Animated.View style={[s.backdrop, backdropStyle]}>
        <Pressable style={s.backdropTouch} onPress={onClose} />
      </Animated.View>
      <Animated.View style={[s.sheet, { paddingBottom: insets.bottom + 20 }, sheetStyle]}>
        <View style={s.handle} />

        <View style={s.header}>
          {imageUrl && !imgFailed ? (
            <Image source={{ uri: imageUrl }} style={s.headerImg} contentFit="cover" transition={200} onError={() => setImgFailed(true)} />
          ) : (
            <View style={s.headerImgPlaceholder}>
              <Ionicons name="heart-outline" size={20} color={theme.colors.textMuted} />
            </View>
          )}
          <View style={s.headerText}>
            <Text style={s.headerBrand} numberOfLines={1}>{marque}</Text>
            <Text style={s.headerName} numberOfLines={2}>{nom}</Text>
          </View>
        </View>

        <Pressable style={s.actionRow} onPress={handleView} accessibilityRole="button" accessibilityLabel="Voir la fiche">
          <Ionicons name="eye-outline" size={20} color={theme.colors.text} />
          <Text style={s.actionLabel}>Voir la fiche</Text>
        </Pressable>

        <Pressable style={s.actionRow} onPress={handleAlerte} accessibilityRole="button" accessibilityLabel="Alerte prix">
          <Ionicons name={hasAlert ? 'notifications' : 'notifications-outline'} size={20} color={hasAlert ? theme.colors.primary : theme.colors.text} />
          <Text style={s.actionLabel}>Alerte prix</Text>
          {hasAlert ? <View style={s.alertDot} /> : null}
        </Pressable>

        <Text style={s.sectionLabel}>{sectionLabel}</Text>
        <View style={s.chips}>
          {STATUS_CHIPS.map(chip => {
            const active = activeChip === chip.id;
            return (
              <Pressable
                key={chip.id}
                style={[s.chip, active && s.chipActive]}
                onPress={() => handleStatus(chip.status)}
                accessibilityRole="button"
                accessibilityLabel={active ? `${chip.label} (sélectionné)` : chip.label}
              >
                <Ionicons name={chip.icon as never} size={14} color={active ? theme.colors.primaryInk : theme.colors.textMuted} />
                <Text style={[s.chipText, active && s.chipTextActive]} allowFontScaling={false}>{chip.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <Pressable style={s.actionRow} onPress={handleRemove} accessibilityRole="button" accessibilityLabel="Retirer des favoris">
          <Ionicons name="trash-outline" size={20} color={theme.colors.danger} />
          <Text style={s.actionLabelDanger}>Retirer des favoris</Text>
        </Pressable>

        <Pressable style={s.cancelBtn} onPress={onClose} accessibilityRole="button" accessibilityLabel="Annuler">
          <Text style={s.cancelText}>Annuler</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

function getStyles(t: Theme) {
  return {
    wrapper: { position: 'absolute' as const, inset: 0, zIndex: 100, justifyContent: 'flex-end' as const },
    backdrop: { ...({ position: 'absolute' as const, inset: 0, backgroundColor: 'rgba(0,0,0,0.4)' } as const) },
    backdropTouch: { flex: 1 },
    sheet: {
      backgroundColor: t.colors.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingTop: 12,
      paddingHorizontal: 16,
      gap: 4,
      ...t.shadow.elevated,
    },
    handle: { alignSelf: 'center' as const, width: 36, height: 5, borderRadius: 3, backgroundColor: t.colors.border, marginBottom: 12 },
    header: {
      flexDirection: 'row' as const, alignItems: 'center' as const, gap: 12,
      paddingBottom: 12, borderBottomWidth: 0.5, borderBottomColor: t.colors.border, marginBottom: 4,
    },
    headerImg: { width: 48, height: 48, borderRadius: 10, backgroundColor: t.colors.surface2 },
    headerImgPlaceholder: { width: 48, height: 48, borderRadius: 10, backgroundColor: t.colors.surface2, justifyContent: 'center' as const, alignItems: 'center' as const },
    headerText: { flex: 1 },
    headerBrand: { fontFamily: 'Inter_400Regular', fontSize: 11, textTransform: 'uppercase' as const, letterSpacing: 1.2, color: t.colors.textMuted, marginBottom: 2 },
    headerName: { fontFamily: 'PlayfairDisplay_600SemiBold', fontSize: 17, color: t.colors.text },
    actionRow: { flexDirection: 'row' as const, alignItems: 'center' as const, paddingVertical: 14, paddingHorizontal: 8, gap: 14, borderRadius: t.radius.base },
    actionLabel: { fontFamily: 'Inter_500Medium', fontSize: 15, color: t.colors.text, flex: 1 },
    actionLabelDanger: { fontFamily: 'Inter_500Medium', fontSize: 15, color: t.colors.danger, flex: 1 },
    alertDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: t.colors.primary },
    sectionLabel: {
      fontFamily: 'Inter_600SemiBold', fontSize: 11, textTransform: 'uppercase' as const, letterSpacing: 0.8,
      color: t.colors.textMuted, paddingHorizontal: 8, paddingTop: 8, paddingBottom: 4,
    },
    chips: { flexDirection: 'row' as const, gap: 8, paddingHorizontal: 8, paddingBottom: 8 },
    chip: {
      flex: 1, flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const, gap: 4,
      paddingHorizontal: 8, paddingVertical: 9, minHeight: 44, borderRadius: 20,
      backgroundColor: t.colors.surface2, borderWidth: 1, borderColor: 'transparent',
    },
    chipActive: { backgroundColor: t.colors.primarySoft, borderColor: t.colors.primary },
    chipText: { fontFamily: 'Inter_500Medium', fontSize: 12, color: t.colors.textMuted },
    chipTextActive: { color: t.colors.primaryInk, fontFamily: 'Inter_600SemiBold' },
    cancelBtn: { marginTop: 12, paddingVertical: 14, alignItems: 'center' as const, borderRadius: t.radius.base, backgroundColor: t.colors.surface2 },
    cancelText: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: t.colors.textMuted },
  } as const;
}
