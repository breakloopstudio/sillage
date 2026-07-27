// app/(tabs)/communaute.tsx — Placeholder Communauté (v8.3 : en attente de création)

import { useMemo } from 'react';
import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@react-native-vector-icons/ionicons/static';
import { useTheme, type Theme } from '../../src/theme/ThemeContext';

export default function CommunautePage() {
  const { theme } = useTheme();
  const s = useMemo(() => getStyles(theme), [theme]);

  return (
    <SafeAreaView edges={['bottom']} style={s.container}>
      <View style={s.header}>
        <Text style={s.title}>Communauté</Text>
      </View>
      <View style={s.body}>
        <View style={s.iconCircle}>
          <Ionicons name="people-outline" size={32} color={theme.colors.primary} />
        </View>
        <Text style={s.heading}>La communauté arrive</Text>
        <Text style={s.desc}>
          Suis des nez aux goûts proches des tiens, partage ta parfumerie et découvre
          les coups de cœur des autres membres.
        </Text>
        <View style={s.soonChip}>
          <Ionicons name="hourglass-outline" size={13} color={theme.colors.primaryInk} />
          <Text style={s.soonChipText} allowFontScaling={false}>Bientôt disponible</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

function getStyles(t: Theme) {
  return {
    container: { flex: 1, backgroundColor: t.colors.background },
    header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
    title: { fontFamily: 'PlayfairDisplay_700Bold', fontSize: 22, color: t.colors.text },
    body: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, paddingBottom: 40 },
    iconCircle: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: t.colors.primarySoft,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 20,
    },
    heading: {
      fontFamily: 'PlayfairDisplay_700Bold',
      fontSize: 22,
      color: t.colors.text,
      textAlign: 'center',
      marginBottom: 10,
    },
    desc: {
      fontFamily: 'Inter_400Regular',
      fontSize: 14,
      color: t.colors.textMuted,
      textAlign: 'center',
      lineHeight: 21,
      maxWidth: 300,
      marginBottom: 24,
    },
    soonChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: t.colors.primarySoft,
    },
    soonChipText: { fontFamily: 'Inter_600SemiBold', fontSize: 12, color: t.colors.primaryInk },
  } as const;
}
