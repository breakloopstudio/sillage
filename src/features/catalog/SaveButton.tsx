// src/features/catalog/SaveButton.tsx — Bouton « Enregistrer » à état (barre flottante + flux)

import { useMemo } from 'react';
import { Text, Pressable } from 'react-native';
import Ionicons from '@react-native-vector-icons/ionicons/static';
import { useTheme, type Theme } from '../../theme/ThemeContext';

interface Props {
  label: string | null;
  onPress: () => void;
  variant?: 'bar' | 'flow';
}

export default function SaveButton({ label, onPress, variant = 'bar' }: Props) {
  const { theme } = useTheme();
  const s = useMemo(() => getStyles(theme), [theme]);
  const saved = label !== null;
  const tint = saved ? theme.colors.primaryInk : theme.colors.text;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        s.base,
        variant === 'flow' ? s.flow : s.bar,
        saved ? s.saved : s.empty,
        pressed && s.pressed,
      ]}
      hitSlop={variant === 'bar' ? 4 : 0}
      accessibilityRole="button"
      accessibilityLabel={saved ? `Enregistré : ${label}. Modifier` : 'Enregistrer ce parfum'}
    >
      <Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={16} color={tint} />
      <Text style={[s.label, saved ? s.labelSaved : s.labelEmpty]} numberOfLines={1}>
        {saved ? label : 'Enregistrer'}
      </Text>
      {variant === 'flow' ? (
        <Ionicons name="chevron-up" size={14} color={saved ? theme.colors.primaryInk : theme.colors.textMuted} />
      ) : null}
    </Pressable>
  );
}

function getStyles(t: Theme) {
  return {
    base: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      gap: 6,
      borderRadius: t.radius.base,
      borderWidth: 1,
    },
    bar: {
      flex: 1,
      minWidth: 96,
      height: 44,
      paddingHorizontal: 10,
    },
    flow: {
      height: 48,
      paddingHorizontal: 14,
      marginTop: 2,
      marginBottom: 8,
    },
    empty: {
      backgroundColor: t.colors.surface2,
      borderColor: t.colors.border,
    },
    saved: {
      backgroundColor: t.colors.primarySoft,
      borderColor: t.colors.primary,
    },
    pressed: { opacity: 0.85 },
    label: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 13,
      flexShrink: 1,
    },
    labelEmpty: { color: t.colors.text },
    labelSaved: { color: t.colors.primaryInk },
  } as const;
}
