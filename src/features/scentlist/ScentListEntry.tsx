// src/features/scentlist/ScentListEntry.tsx — Carte d'entrée compacte pour la Parfumerie

import { useMemo } from 'react';
import { View, Text, Pressable } from 'react-native';
import Ionicons from '@react-native-vector-icons/ionicons/static';
import { useTheme, type Theme } from '../../theme/ThemeContext';

interface Props {
  toTryCount: number;
  triedCount: number;
  onPress: () => void;
}

export default function ScentListEntry({ toTryCount, triedCount, onPress }: Props) {
  const { theme } = useTheme();
  const s = useMemo(() => getStyles(theme), [theme]);

  return (
    <Pressable style={({ pressed }) => [s.card, pressed && s.cardPressed]} onPress={onPress}>
      <View style={[s.iconCircle, { backgroundColor: theme.colors.primarySoft }]}>
        <Ionicons name="eyedrop-outline" size={18} color={theme.colors.primary} />
      </View>
      <View style={s.body}>
        <Text style={s.title}>Carnet d'essais</Text>
        <Text style={s.subtitle}>
          {toTryCount > 0 ? `${toTryCount} à sentir` : 'Tout senti'}
          {triedCount > 0 ? ` · ${triedCount} senti${triedCount > 1 ? 's' : ''}` : ''}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={theme.colors.textMuted} />
    </Pressable>
  );
}

function getStyles(t: Theme) {
  return {
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: t.colors.surface,
      borderRadius: t.radius.card,
      paddingHorizontal: 12,
      paddingVertical: 10,
      marginHorizontal: t.spacing.md,
      marginBottom: 6,
      ...t.shadow.card,
    },
    cardPressed: {
      opacity: 0.85,
    },
    iconCircle: {
      width: 36,
      height: 36,
      borderRadius: 18,
      justifyContent: 'center',
      alignItems: 'center',
    },
    body: {
      flex: 1,
    },
    title: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 14,
      color: t.colors.text,
    },
    subtitle: {
      fontFamily: 'Inter_400Regular',
      fontSize: 12,
      color: t.colors.textMuted,
      marginTop: 1,
    },
  } as const;
}
