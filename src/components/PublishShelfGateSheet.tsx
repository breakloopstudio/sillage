import { useMemo, useEffect, useState, useCallback } from 'react';
import { View, Text, Pressable, ScrollView, BackHandler, KeyboardAvoidingView } from 'react-native';
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
import PublicProfileCard from './PublicProfileCard';

interface Props {
  visible: boolean;
  uid: string;
  photoUrl: string | null;
  defaultPseudo: string;
  shelfName: string;
  onClose: () => void;
  onPublish: () => void;
}

export default function PublishShelfGateSheet({
  visible, uid, photoUrl, defaultPseudo, shelfName, onClose, onPublish,
}: Props) {
  const { theme } = useTheme();
  const s = useMemo(() => getStyles(theme), [theme]);
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const [gateCleared, setGateCleared] = useState(false);
  const [mounted, setMounted] = useState(visible);

  const translateY = useSharedValue(500);
  const backdropOpacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      setGateCleared(false);
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

  const handlePublicSaved = useCallback(() => setGateCleared(true), []);
  const handlePublish = useCallback(() => { hapticsLight(); onPublish(); }, [onPublish]);

  if (!mounted) return null;

  return (
    <KeyboardAvoidingView style={s.wrapper} behavior="padding">
      <Animated.View style={[s.backdrop, backdropStyle]}>
        <Pressable style={s.backdropTouch} onPress={onClose} />
      </Animated.View>
      <Animated.View style={[s.sheet, { paddingBottom: insets.bottom + 16 }, sheetStyle]}>
        <View style={s.handle} />
        <View style={s.header}>
          <View style={s.headerIcon}>
            <Ionicons name="globe-outline" size={18} color={theme.colors.primaryInk} />
          </View>
          <View style={s.headerTexts}>
            <Text style={s.title} numberOfLines={1}>Rendre « {shelfName} » publique</Text>
            <Text style={s.subtitle}>
              Pour partager une étagère, ton profil doit être public. Choisis un pseudo, active la visibilité, enregistre — puis publie l’étagère.
            </Text>
          </View>
          <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Fermer">
            <Ionicons name="close" size={22} color={theme.colors.text} />
          </Pressable>
        </View>

        <ScrollView style={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <PublicProfileCard
            uid={uid}
            photoUrl={photoUrl}
            defaultPseudo={defaultPseudo}
            embedded
            onPublicSaved={handlePublicSaved}
          />
        </ScrollView>

        <Pressable
          style={[s.publishBtn, !gateCleared && s.publishBtnDisabled]}
          onPress={handlePublish}
          disabled={!gateCleared}
          accessibilityRole="button"
          accessibilityLabel={gateCleared ? `Publier l’étagère ${shelfName}` : 'Enregistre d’abord ton profil public'}
        >
          <Ionicons
            name={gateCleared ? 'globe-outline' : 'lock-closed-outline'}
            size={18}
            color={gateCleared ? '#FFFFFF' : theme.colors.textMuted}
          />
          <Text style={[s.publishBtnText, !gateCleared && s.publishBtnTextDisabled]} allowFontScaling={false}>
            {gateCleared ? 'Publier l’étagère' : 'Profil public requis'}
          </Text>
        </Pressable>
      </Animated.View>
    </KeyboardAvoidingView>
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
      maxHeight: '90%' as const,
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
    headerTexts: { flex: 1, gap: 4 },
    title: { fontFamily: 'PlayfairDisplay_600SemiBold', fontSize: 17, color: t.colors.text },
    subtitle: { fontFamily: 'Inter_400Regular', fontSize: 12, color: t.colors.textMuted, lineHeight: 18 },
    scroll: { flexShrink: 1 },
    publishBtn: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      gap: 8,
      marginTop: 12,
      backgroundColor: t.colors.primary,
      borderRadius: t.radius.base,
      paddingVertical: 14,
      minHeight: 48,
    },
    publishBtnDisabled: { backgroundColor: t.colors.surface2, borderWidth: 1, borderColor: t.colors.border },
    publishBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: '#FFFFFF' },
    publishBtnTextDisabled: { color: t.colors.textMuted },
  } as const;
}
