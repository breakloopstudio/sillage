// src/features/scan/ScanCollectionStaging.tsx — Staging multi-section :
// l'utilisateur photographie sa collection section par section (3-4 flacons par
// photo — à l'échelle d'une étagère entière les étiquettes sont illisibles),
// puis lance l'analyse sur l'ensemble des photos.

import { useMemo, useCallback } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';
import Ionicons from '@react-native-vector-icons/ionicons/static';
import { useTranslation } from 'react-i18next';
import { useTheme, type Theme } from '../../theme/ThemeContext';
import { hapticsLight } from '../../services/haptics';
import { textOn } from '../../utils/contrast';
import { COLLECTION_MAX_PHOTOS } from '../../hooks/useScanReducer';

interface Props {
  images: string[];
  onAddSection: () => void;
  onRemovePhoto: (index: number) => void;
  onAnalyze: (images: string[]) => void;
  onClose: (imageCount: number) => void;
}

export function ScanCollectionStaging({ images, onAddSection, onRemovePhoto, onAnalyze, onClose }: Props) {
  const { theme } = useTheme();
  const s = useMemo(() => getStyles(theme), [theme]);
  const { t } = useTranslation('common');
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();

  const full = images.length >= COLLECTION_MAX_PHOTOS;

  const handleRemove = useCallback((index: number) => {
    hapticsLight();
    onRemovePhoto(index);
  }, [onRemovePhoto]);

  const handleAnalyze = useCallback(() => {
    hapticsLight();
    onAnalyze(images);
  }, [onAnalyze, images]);

  const handleClose = useCallback(() => {
    onClose(images.length);
  }, [onClose, images.length]);

  return (
    <View style={[s.container, { paddingTop: insets.top + 16 }]}>
      <View style={s.header}>
        <Pressable onPress={handleClose} style={s.closeBtn} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('scan.closeScanA11y')}>
          <Ionicons name="close" size={20} color={theme.colors.textMuted} />
        </Pressable>
        <View style={s.headerText}>
          <Text style={s.title}>{t('scan.stagingTitle')}</Text>
          <Text style={s.subtitle}>{t('scan.stagingHint')}</Text>
        </View>
        <View style={s.closeBtn} />
      </View>

      <ScrollView contentContainerStyle={s.thumbs} showsVerticalScrollIndicator={false}>
        {images.map((uri, i) => (
          <Animated.View key={uri} style={s.thumbWrap} entering={reduced ? undefined : FadeInDown.delay(i * 60).duration(240)}>
            <Image source={{ uri }} style={s.thumb} contentFit="cover" transition={200} accessibilityLabel={t('scan.stagingThumbA11y', { index: i + 1, count: images.length })} />
            <Pressable
              onPress={() => handleRemove(i)}
              style={s.thumbRemove}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={t('scan.stagingRemoveA11y', { index: i + 1, count: images.length })}
            >
              <Ionicons name="close-circle" size={22} color={theme.colors.text} />
            </Pressable>
            <View style={s.thumbBadge}>
              <Text style={s.thumbBadgeText} allowFontScaling={false}>{i + 1}</Text>
            </View>
          </Animated.View>
        ))}
        {!full && (
          <Pressable onPress={onAddSection} style={s.thumbAdd} accessibilityRole="button" accessibilityLabel={t('scan.stagingAddSection')}>
            <Ionicons name="camera-outline" size={24} color={theme.colors.primary} />
            <Text style={s.thumbAddText}>{t('scan.stagingAddShort')}</Text>
          </Pressable>
        )}
      </ScrollView>

      <View style={[s.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
        <Pressable onPress={handleAnalyze} style={s.cta} accessibilityRole="button" accessibilityLabel={t('scan.stagingAnalyze', { count: images.length })}>
          <Ionicons name="sparkles-outline" size={20} color={textOn(theme.colors.primary)} style={{ marginRight: 8 }} />
          <Text style={s.ctaText}>{t('scan.stagingAnalyze', { count: images.length })}</Text>
        </Pressable>
        {!full && (
          <Pressable onPress={onAddSection} style={s.addSectionBtn} hitSlop={8} accessibilityRole="button">
            <Ionicons name="add-outline" size={16} color={theme.colors.primary} style={{ marginRight: 6 }} />
            <Text style={s.addSectionText}>{t('scan.stagingAddSection')}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

function getStyles(t: Theme) {
  return {
    container: { flex: 1, backgroundColor: t.colors.background },

    header: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 16, marginBottom: 16, gap: 8 },
    headerText: { flex: 1 },
    title: { fontFamily: 'PlayfairDisplay_600SemiBold', fontSize: 22, color: t.colors.text },
    subtitle: { fontFamily: 'Inter_400Regular', fontSize: 13, color: t.colors.textMuted, marginTop: 4, lineHeight: 19 },
    closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: t.colors.surface2, borderWidth: StyleSheet.hairlineWidth, borderColor: t.colors.border, justifyContent: 'center', alignItems: 'center' },

    // ScrollView (contentContainerStyle) : flexGrow pour centrer verticalement quand
    // peu de photos, scroll dès que la grille dépasse l'écran (petits écrans).
    thumbs: { flexGrow: 1, flexDirection: 'row', flexWrap: 'wrap', alignContent: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 8 },
    thumbWrap: { width: 150, height: 150, borderRadius: t.radius.card, overflow: 'visible' },
    thumb: {
      width: 150,
      height: 150,
      borderRadius: t.radius.card,
      backgroundColor: t.colors.surface2,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border,
    },
    thumbRemove: { position: 'absolute', top: -8, right: -8, zIndex: 2, width: 26, height: 26, justifyContent: 'center', alignItems: 'center' },
    thumbBadge: { position: 'absolute', bottom: 8, left: 8, backgroundColor: t.colors.surface, borderRadius: 9, paddingHorizontal: 7, paddingVertical: 2, borderWidth: StyleSheet.hairlineWidth, borderColor: t.colors.border },
    thumbBadgeText: { fontFamily: 'Inter_700Bold', fontSize: 11, color: t.colors.text, fontVariant: ['tabular-nums'] as import('react-native').FontVariant[] },
    thumbAdd: {
      width: 150,
      height: 150,
      borderRadius: t.radius.card,
      borderWidth: 1.5,
      borderColor: t.colors.primary,
      borderStyle: 'dashed',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 6,
    },
    thumbAddText: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: t.colors.primary },

    bottomBar: { paddingHorizontal: 16, paddingTop: 8, gap: 10, alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.colors.border },
    cta: {
      flexDirection: 'row',
      backgroundColor: t.colors.primary,
      borderRadius: t.radius.base,
      height: 52,
      width: '100%',
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 24,
      ...t.shadow.button,
    },
    ctaText: { color: textOn(t.colors.primary), fontFamily: 'Inter_600SemiBold', fontSize: 16 },
    addSectionBtn: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 6, paddingHorizontal: 12 },
    addSectionText: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: t.colors.primary },
  } as const;
}
