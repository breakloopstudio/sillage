// src/components/SectionHeader.tsx — Titre + sous-titre + action optionnelle

import { useMemo } from 'react';
import { View, Text, Pressable, type ViewStyle } from 'react-native';
import Ionicons from '@react-native-vector-icons/ionicons/static';
import { useTheme, type Theme } from '../theme/ThemeContext';

interface Props {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
  style?: ViewStyle;
  /** Pastille éditoriale §4.9 — icône + teinte. Opt-in : absente si `icon` non fourni. */
  icon?: string;
  tint?: keyof Theme['colors'];
  tintBg?: keyof Theme['colors'];
}

export default function SectionHeader({ title, subtitle, actionLabel, onAction, style, icon, tint, tintBg }: Props) {
  const { theme } = useTheme();
  const s = useMemo(() => getStyles(theme), [theme]);
  const showPastille = !!icon && !!tint && !!tintBg;
  return (
    <View style={[s.container, style]}>
      {showPastille ? (
        <View style={[s.pastille, { backgroundColor: theme.colors[tintBg as keyof Theme['colors']] }]}>
          <Ionicons name={icon as never} size={14} color={theme.colors[tint as keyof Theme['colors']]} accessible={false} />
        </View>
      ) : null}
      <View style={s.texts}>
        <Text style={s.title}>{title}</Text>
        {subtitle ? <Text style={s.subtitle}>{subtitle}</Text> : null}
      </View>
      {actionLabel && onAction ? (
        <Pressable onPress={onAction} hitSlop={12} style={s.action}>
          <Text style={s.actionLabel}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function getStyles(t: Theme) {
  return {
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 8,
    },
    pastille: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      marginRight: 10,
    },
    texts: {
      flex: 1,
    },
    title: {
      fontFamily: 'PlayfairDisplay_700Bold',
      fontSize: t.fonts.size.lg,
      color: t.colors.text,
    },
    subtitle: {
      fontFamily: 'Inter_400Regular',
      fontSize: 13,
      color: t.colors.textMuted,
      marginTop: 2,
    },
    action: {
      paddingVertical: 4,
      paddingHorizontal: 8,
    },
    actionLabel: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 14,
      color: t.colors.primary,
    },
  } as const;
}