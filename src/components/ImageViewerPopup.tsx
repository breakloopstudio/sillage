// src/components/ImageViewerPopup.tsx — Popup lightbox plein écran pour voir la photo du parfum
// Fond sombre invariant (light + dark), image maximisée en contain, close ancré safe-area top-right
// Couleurs invariantes documentées : design-guide.md §2.3
//
// Constantes invariantes lightbox — sombre dans les deux thèmes (cf. design-guide.md §2.3)
const LIGHTBOX_BG = 'rgba(11,7,18,0.96)';
const CLOSE_FILL = 'rgba(255,255,255,0.12)';
const CLOSE_BORDER = 'rgba(255,255,255,0.22)';
const CLOSE_ICON = '#FFFFFF';
const BRAND_COLOR = 'rgba(237,232,245,0.75)';
const NAME_COLOR = '#EDE8F5';
const CLOSE_ZONE = 68;
const INFO_ZONE = 56;
const BREATHING = 24;

import { useMemo, useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, useWindowDimensions, BackHandler } from 'react-native';
import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import Ionicons from '@react-native-vector-icons/ionicons/static';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, cancelAnimation, useReducedMotion, runOnJS } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, type Theme } from '../theme/ThemeContext';

interface Props {
  visible: boolean;
  imageUrl: string;
  imageUrl2x?: string | null;
  brand: string;
  name: string;
  onClose: () => void;
}

export default function ImageViewerPopup({ visible, imageUrl, imageUrl2x, brand, name, onClose }: Props) {
  const { theme } = useTheme();
  const s = useMemo(() => getStyles(theme), [theme]);
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const [mounted, setMounted] = useState(visible);

  const backdropOpacity = useSharedValue(0);
  const cardOpacity = useSharedValue(0);
  const scale = useSharedValue(0.92);

  useEffect(() => {
    const dur = reduced ? 0 : 250;
    if (visible) {
      setMounted(true);
      backdropOpacity.value = withTiming(1, { duration: dur });
      cardOpacity.value = withTiming(1, { duration: dur });
      scale.value = withTiming(1, { duration: dur });
    } else if (mounted) {
      backdropOpacity.value = withTiming(0, { duration: dur });
      cardOpacity.value = withTiming(0, { duration: dur }, (finished) => {
        if (finished) runOnJS(setMounted)(false);
      });
      scale.value = withTiming(0.92, { duration: dur });
    }
    return () => {
      cancelAnimation(backdropOpacity);
      cancelAnimation(cardOpacity);
      cancelAnimation(scale);
    };
  }, [visible, reduced]);

  useEffect(() => {
    if (!visible) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { onClose(); return true; });
    return () => sub.remove();
  }, [visible, onClose]);

  const backdropAnim = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const cardAnim = useAnimatedStyle(() => ({
    opacity: cardOpacity.value,
    transform: [{ scale: scale.value }],
  }));

  if (!mounted) return null;

  const imageWidth = screenWidth - 32;
  const imageHeight = screenHeight - insets.top - insets.bottom - CLOSE_ZONE - INFO_ZONE - BREATHING;

  return (
    <View style={s.root}>
      <StatusBar style="light" />

      <Animated.View style={[s.backdrop, backdropAnim]}>
        <Pressable
          style={s.backdropTouch}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Fermer l'aperçu de la photo"
        />
      </Animated.View>

      <Pressable
        onPress={onClose}
        style={[s.closeBtn, { top: insets.top + 12 }]}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Fermer"
      >
        <Ionicons name="close" size={22} color={CLOSE_ICON} />
      </Pressable>

      <Animated.View style={[s.card, cardAnim]}>
        <View style={{ width: imageWidth, height: imageHeight }}>
          <Image
            source={{ uri: imageUrl }}
            style={{ width: imageWidth, height: imageHeight }}
            contentFit="contain"
            transition={300}
          />
          {imageUrl2x ? (
            <Image
              key={imageUrl2x}
              source={{ uri: imageUrl2x }}
              style={s.imageHd}
              contentFit="contain"
              transition={250}
            />
          ) : null}
        </View>
        <Text allowFontScaling={false} style={s.brand}>{brand}</Text>
        <Text allowFontScaling={false} style={s.name}>{name}</Text>
      </Animated.View>
    </View>
  );
}

function getStyles(_t: Theme) {
  return {
    root: {
      position: 'absolute' as const,
      inset: 0,
      zIndex: 200,
      justifyContent: 'center' as const,
      alignItems: 'center' as const,
    },
    backdrop: {
      ...StyleSheet.absoluteFill,
      zIndex: 0,
    } as const,
    backdropTouch: {
      ...StyleSheet.absoluteFill,
      backgroundColor: LIGHTBOX_BG,
    } as const,
    closeBtn: {
      position: 'absolute' as const,
      right: 16,
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: CLOSE_FILL,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: CLOSE_BORDER,
      justifyContent: 'center' as const,
      alignItems: 'center' as const,
      zIndex: 10,
    },
    card: {
      alignItems: 'center' as const,
      zIndex: 1,
    },
    imageHd: {
      position: 'absolute' as const,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
    },
    brand: {
      fontFamily: 'Inter_400Regular',
      fontSize: 12,
      textTransform: 'uppercase' as const,
      letterSpacing: 1.5,
      color: BRAND_COLOR,
      marginTop: 12,
    },
    name: {
      fontFamily: 'PlayfairDisplay_600SemiBold',
      fontSize: 18,
      color: NAME_COLOR,
      marginTop: 2,
      textAlign: 'center' as const,
    },
  } as const;
}
