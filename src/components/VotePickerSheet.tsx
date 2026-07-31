import { useMemo, useEffect, useState, useCallback } from 'react';
import { View, Text, Pressable, BackHandler } from 'react-native';
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

export interface VoteOption {
  key: string;
  label: string;
  icon?: string;
  color?: string;
}

interface Props {
  visible: boolean;
  title: string;
  options: VoteOption[];
  currentKey: string | null;
  accent: string;
  onPick: (key: string) => void;
  onRemove?: (() => void) | null;
  onClose: () => void;
}

export default function VotePickerSheet({ visible, title, options, currentKey, accent, onPick, onRemove, onClose }: Props) {
  const { theme } = useTheme();
  const s = useMemo(() => getStyles(theme), [theme]);
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
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
      translateY.value = withTiming(300, { duration: reduced ? 0 : 200 }, finished => {
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
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [visible, onClose]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdropOpacity.value }));
  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));

  const handlePick = useCallback(
    (key: string) => {
      onPick(key);
      onClose();
    },
    [onPick, onClose],
  );

  const handleRemove = useCallback(() => {
    onRemove?.();
    onClose();
  }, [onRemove, onClose]);

  if (!mounted) return null;

  return (
    <View style={s.wrapper}>
      <Animated.View style={[s.backdrop, backdropStyle]}>
        <Pressable style={s.backdropTouch} onPress={onClose} />
      </Animated.View>
      <Animated.View style={[s.sheet, { paddingBottom: insets.bottom + 20 }, sheetStyle]}>
        <View style={s.handle} />
        <View style={s.header}>
          <Text style={s.title} numberOfLines={1}>
            {title}
          </Text>
        </View>

        {options.map((opt, i) => {
          const isCurrent = currentKey === opt.key;
          return (
            <Pressable
              key={opt.key}
              style={[s.row, i < options.length - 1 && s.rowBorder]}
              onPress={() => handlePick(opt.key)}
              accessibilityRole="button"
              accessibilityState={{ selected: isCurrent }}
            >
              {opt.icon ? (
                <Ionicons name={opt.icon as never} size={20} color={opt.color ?? theme.colors.text} />
              ) : opt.color ? (
                <View style={[s.dot, { backgroundColor: opt.color }]} />
              ) : (
                <View style={s.dotSpacer} />
              )}
              <Text style={[s.rowLabel, isCurrent && { color: accent, fontFamily: 'Inter_600SemiBold' }]}>
                {opt.label}
              </Text>
              {isCurrent ? <Ionicons name="checkmark-circle" size={20} color={accent} /> : null}
            </Pressable>
          );
        })}

        {currentKey !== null && onRemove ? (
          <Pressable style={[s.removeRow, s.rowBorder]} onPress={handleRemove}>
            <Ionicons name="close-circle-outline" size={20} color={theme.colors.danger} />
            <Text style={s.removeLabel}>Retirer mon vote</Text>
          </Pressable>
        ) : null}

        <Pressable style={s.cancelBtn} onPress={onClose}>
          <Text style={s.cancelText}>Annuler</Text>
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
    handle: {
      alignSelf: 'center' as const,
      width: 36,
      height: 5,
      borderRadius: 3,
      backgroundColor: t.colors.border,
      marginBottom: 12,
    },
    header: {
      paddingBottom: 12,
      borderBottomWidth: 0.5,
      borderBottomColor: t.colors.border,
      marginBottom: 4,
    },
    title: {
      fontFamily: 'PlayfairDisplay_600SemiBold',
      fontSize: 17,
      color: t.colors.text,
      textAlign: 'center' as const,
    },
    row: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      paddingVertical: 14,
      paddingHorizontal: 8,
      gap: 14,
      borderRadius: t.radius.base,
    },
    rowBorder: {
      borderBottomWidth: 0.5,
      borderBottomColor: t.colors.border,
    },
    rowLabel: {
      flex: 1,
      fontFamily: 'Inter_500Medium',
      fontSize: 15,
      color: t.colors.text,
    },
    dot: {
      width: 12,
      height: 12,
      borderRadius: 6,
      marginLeft: 4,
      marginRight: 4,
    },
    dotSpacer: { width: 20 },
    removeRow: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      paddingVertical: 14,
      paddingHorizontal: 8,
      gap: 14,
      borderRadius: t.radius.base,
      marginTop: 4,
    },
    removeLabel: {
      flex: 1,
      fontFamily: 'Inter_500Medium',
      fontSize: 15,
      color: t.colors.danger,
    },
    cancelBtn: {
      marginTop: 12,
      paddingVertical: 14,
      alignItems: 'center' as const,
      borderRadius: t.radius.base,
      backgroundColor: t.colors.surface2,
    },
    cancelText: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 15,
      color: t.colors.textMuted,
    },
  } as const;
}
