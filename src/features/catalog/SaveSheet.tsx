import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { View, Text, Pressable, Modal, ScrollView, KeyboardAvoidingView } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
  runOnJS,
  Easing,
  useReducedMotion,
} from 'react-native-reanimated';
import Ionicons from '@react-native-vector-icons/ionicons/static';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, type Theme } from '../../theme/ThemeContext';
import { hapticsSuccess } from '../../services/haptics';
import { VERDICT_OPTIONS } from '../../utils/verdicts';
import { STATUS_CHIPS, chipForStatus } from '../../utils/status-chips';
import type { UserParfum, UserParfumStatus, ScentVerdict, PossessionType } from '../../models/user-parfum.interface';

const POSSESSION_OPTIONS: { type: PossessionType; label: string }[] = [
  { type: 'bottle', label: 'Flacon' },
  { type: 'decant', label: 'Décant' },
  { type: 'sample', label: 'Échantillon' },
];

interface Props {
  visible: boolean;
  parfumName: string;
  parfumBrand: string;
  parfumImageUrl: string | null;
  item: UserParfum | null;
  onClose: () => void;
  onSetStatus: (status: UserParfumStatus) => void;
  onSetVerdict: (verdict: ScentVerdict) => void;
  onRemove: () => void;
  onOpenFullNotes: () => void;
  onAddPossession: (type: PossessionType, sizeMl?: number | null) => void;
}

export default function SaveSheet({
  visible, parfumName, parfumBrand, parfumImageUrl,
  item,
  onClose, onSetStatus, onSetVerdict, onRemove, onOpenFullNotes, onAddPossession,
}: Props) {
  const { theme, resolvedMode } = useTheme();
  const s = useMemo(() => getStyles(theme), [theme]);
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();

  const [imgFailed, setImgFailed] = useState(false);
  const closingRef = useRef(false);
  const progress = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      closingRef.current = false;
      progress.value = withTiming(1, { duration: reduced ? 150 : 250, easing: Easing.out(Easing.cubic) });
    }
  }, [visible, reduced]);

  const requestClose = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    progress.value = withTiming(0, { duration: reduced ? 100 : 200, easing: Easing.in(Easing.ease) }, (finished) => {
      if (finished) runOnJS(onClose)();
    });
  }, [progress, reduced, onClose]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: progress.value }));
  const sheetStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: interpolate(progress.value, [0, 1], [reduced ? 0 : 320, 0]) }],
  }));

  const handleStatus = useCallback((st: UserParfumStatus) => {
    if (chipForStatus(item?.status) === chipForStatus(st)) return;
    onSetStatus(st);
    hapticsSuccess();
  }, [item?.status, onSetStatus]);

  const handleVerdict = useCallback((v: ScentVerdict) => {
    onSetVerdict(v);
    hapticsSuccess();
  }, [onSetVerdict]);

  const handlePossession = useCallback((type: PossessionType) => {
    onAddPossession(type);
    hapticsSuccess();
  }, [onAddPossession]);

  const showVerdict = item !== null && item.status !== 'to_try' && item.status !== 'want';
  const showPossessions = item?.status === 'have';

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={requestClose}>
      <View style={s.root}>
        <Animated.View style={[s.backdrop, backdropStyle]}>
          <Pressable style={s.backdropTouch} onPress={requestClose} />
        </Animated.View>
        <KeyboardAvoidingView behavior="padding" style={s.kav}>
          <Animated.View style={[s.sheet, { paddingBottom: insets.bottom + 16 }, sheetStyle]}>
            <ScrollView bounces={false} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <View style={s.handle} />

              <View style={s.header}>
                {parfumImageUrl && !imgFailed ? (
                  <Image source={{ uri: parfumImageUrl }} style={s.image} contentFit="cover" transition={200} onError={() => setImgFailed(true)} />
                ) : (
                  <View style={s.imagePlaceholder}>
                    <Ionicons name="bookmark-outline" size={20} color={theme.colors.textMuted} />
                  </View>
                )}
                <View style={s.headerText}>
                  <Text style={s.brand} numberOfLines={1}>{parfumBrand}</Text>
                  <Text style={s.name} numberOfLines={2}>{parfumName}</Text>
                </View>
                <Pressable onPress={requestClose} hitSlop={12} style={s.closeBtn} accessibilityRole="button" accessibilityLabel="Fermer">
                  <Ionicons name="close" size={22} color={theme.colors.textMuted} />
                </Pressable>
              </View>

              <Text style={s.sectionLabel}>Où en es-tu ?</Text>
              <View style={s.chips}>
                {STATUS_CHIPS.map(chip => {
                  const active = chipForStatus(item?.status) === chip.id;
                  return (
                    <Pressable
                      key={chip.id}
                      style={[s.chip, active && s.chipActive]}
                      onPress={() => handleStatus(chip.status)}
                      hitSlop={{ top: 4, bottom: 4 }}
                      accessibilityRole="button"
                      accessibilityLabel={active ? `${chip.label} (sélectionné)` : chip.label}
                    >
                      <Ionicons name={chip.icon as never} size={14} color={active ? theme.colors.primaryInk : theme.colors.textMuted} />
                      <Text style={[s.chipText, active && s.chipTextActive]} allowFontScaling={false}>
                        {chip.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {showVerdict ? (
                <>
                  <Text style={s.subLabel}>Ton verdict</Text>
                  <View style={s.chips}>
                    {VERDICT_OPTIONS.map(opt => {
                      const active = item?.verdict === opt.key;
                      const color = (theme.colors as Record<string, string>)[opt.token];
                      const soft = `${opt.token}Soft`;
                      return (
                        <Pressable
                          key={opt.key}
                          style={[
                            s.chip,
                            active
                              ? { backgroundColor: (theme.colors as Record<string, string>)[soft], borderColor: color }
                              : null,
                          ]}
                          onPress={() => handleVerdict(opt.key)}
                          hitSlop={{ top: 4, bottom: 4 }}
                          accessibilityRole="button"
                          accessibilityLabel={opt.label}
                        >
                          <Ionicons name={opt.icon as never} size={14} color={active ? color : theme.colors.textMuted} />
                          <Text style={[s.chipText, active ? { color } : null]} allowFontScaling={false}>{opt.label}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </>
              ) : null}

              {showPossessions ? (
                <>
                  <Text style={s.subLabel}>Ajouter une possession</Text>
                  <View style={s.chips}>
                    {POSSESSION_OPTIONS.map(opt => (
                      <Pressable
                        key={opt.type}
                        style={s.chip}
                        onPress={() => handlePossession(opt.type)}
                        hitSlop={{ top: 4, bottom: 4 }}
                        accessibilityRole="button"
                        accessibilityLabel={`Ajouter ${opt.label.toLowerCase()}`}
                      >
                        <Ionicons name="add" size={14} color={theme.colors.textMuted} />
                        <Text style={s.chipText} allowFontScaling={false}>{opt.label}</Text>
                      </Pressable>
                    ))}
                  </View>
                </>
              ) : null}

              {item ? (
                <View style={s.links}>
                  {showVerdict ? (
                    <Pressable onPress={onOpenFullNotes} style={s.linkBtn} hitSlop={6} accessibilityRole="button" accessibilityLabel="Notes détaillées">
                      <Ionicons name="create-outline" size={16} color={theme.colors.textMuted} />
                      <Text style={s.linkText}>Notes détaillées…</Text>
                    </Pressable>
                  ) : null}
                  <Pressable onPress={onRemove} style={s.linkBtn} hitSlop={6} accessibilityRole="button" accessibilityLabel="Retirer">
                    <Ionicons name="trash-outline" size={16} color={theme.colors.overpriced} />
                    <Text style={[s.linkText, s.linkDestructive]}>Retirer</Text>
                  </Pressable>
                </View>
              ) : null}
            </ScrollView>
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

function getStyles(t: Theme) {
  return {
    root: { flex: 1 },
    backdrop: {
      ...({ position: 'absolute', inset: 0 } as const),
      backgroundColor: 'rgba(0,0,0,0.4)',
    },
    backdropTouch: { flex: 1 },
    kav: { flex: 1, justifyContent: 'flex-end' as const },
    sheet: {
      backgroundColor: t.colors.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: 20,
      paddingTop: 4,
      maxHeight: '85%',
    },
    handle: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: t.colors.textMuted,
      opacity: 0.4,
      alignSelf: 'center' as const,
      marginTop: 8,
      marginBottom: 14,
    },
    header: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: 12,
      marginBottom: 18,
    },
    image: {
      width: 48,
      height: 48,
      borderRadius: 10,
      backgroundColor: t.colors.surface2,
    },
    imagePlaceholder: {
      width: 48,
      height: 48,
      borderRadius: 10,
      backgroundColor: t.colors.surface2,
      justifyContent: 'center' as const,
      alignItems: 'center' as const,
    },
    headerText: { flex: 1 },
    brand: {
      fontFamily: 'Inter_400Regular',
      fontSize: 11,
      textTransform: 'uppercase' as const,
      letterSpacing: 1.2,
      color: t.colors.textMuted,
      marginBottom: 2,
    },
    name: {
      fontFamily: 'PlayfairDisplay_600SemiBold',
      fontSize: 18,
      color: t.colors.text,
    },
    closeBtn: { padding: 4 },
    sectionLabel: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 11,
      textTransform: 'uppercase' as const,
      letterSpacing: 0.8,
      color: t.colors.textMuted,
      marginBottom: 10,
    },
    subLabel: {
      fontFamily: 'Inter_500Medium',
      fontSize: 13,
      color: t.colors.textMuted,
      marginTop: 16,
      marginBottom: 8,
    },
    chips: {
      flexDirection: 'row' as const,
      flexWrap: 'wrap' as const,
      gap: 8,
    },
    chip: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: 4,
      paddingHorizontal: 14,
      paddingVertical: 9,
      borderRadius: 20,
      backgroundColor: t.colors.surface2,
      borderWidth: 1,
      borderColor: 'transparent',
    },
    chipActive: {
      backgroundColor: t.colors.primarySoft,
      borderColor: t.colors.primary,
    },
    chipText: {
      fontFamily: 'Inter_500Medium',
      fontSize: 13,
      color: t.colors.textMuted,
    },
    chipTextActive: {
      color: t.colors.primaryInk,
      fontFamily: 'Inter_600SemiBold',
    },
    links: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      flexWrap: 'wrap' as const,
      gap: 18,
      marginTop: 16,
    },
    linkBtn: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: 5,
      paddingVertical: 2,
    },
    linkText: {
      fontFamily: 'Inter_500Medium',
      fontSize: 13,
      color: t.colors.textMuted,
    },
    linkDestructive: { color: t.colors.overpriced },
  } as const;
}
