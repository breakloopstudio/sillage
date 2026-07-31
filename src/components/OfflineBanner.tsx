// src/components/OfflineBanner.tsx — Bannière réseau mode hors-ligne

import { useEffect, useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import Ionicons from '@react-native-vector-icons/ionicons/static';
import { useTheme, type Theme } from '../theme/ThemeContext';

export const OFFLINE_BANNER_BAND = 32;

interface Props {
  visible: boolean;
  variant?: 'offline' | 'reconnected';
}

export default function OfflineBanner({ visible, variant = 'offline' }: Props) {
  const { theme } = useTheme();
  const s = useMemo(() => getStyles(theme), [theme]);
  const insets = useSafeAreaInsets();
  const totalHeight = OFFLINE_BANNER_BAND + insets.top;
  const hidden = -totalHeight;
  const translateY = useSharedValue(hidden);

  useEffect(() => {
    translateY.value = withTiming(visible ? 0 : hidden, { duration: 300 });
  }, [visible, hidden]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const isReconnect = variant === 'reconnected';
  const bg = isReconnect ? theme.colors.dealSoft : theme.colors.fairSoft;
  const ink = isReconnect ? theme.colors.dealInk : theme.colors.fairInk;
  const borderColor = isReconnect ? theme.colors.deal : theme.colors.fair;
  const icon = isReconnect ? 'checkmark-circle-outline' : 'wifi-outline';
  const label = isReconnect ? 'Connexion rétablie' : 'Mode hors-ligne';

  return (
    <Animated.View style={[s.banner, { height: totalHeight, paddingTop: insets.top, backgroundColor: bg, borderBottomColor: borderColor }, animatedStyle]}>
      <Ionicons name={icon} size={14} color={ink} />
      <Text style={[s.text, { color: ink }]}>{label}</Text>
    </Animated.View>
  );
}

function getStyles(t: Theme) {
  return {
    banner: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 100,
      elevation: 10,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      borderBottomWidth: StyleSheet.hairlineWidth,
    },
    text: {
      fontFamily: 'Inter_500Medium',
      fontSize: 12,
    },
  } as const;
}
