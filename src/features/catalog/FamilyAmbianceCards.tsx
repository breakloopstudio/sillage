// src/features/catalog/FamilyAmbianceCards.tsx — Cartes d'ambiance « Explorer par famille »
// 6 cartes visuelles avec dégradés theme-aware + icônes Ionicons

import { useMemo, useCallback } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import Ionicons from '@react-native-vector-icons/ionicons/static';
import SectionHeader from '../../components/SectionHeader';
import { useTheme, type Theme } from '../../theme/ThemeContext';

interface FamilyDef {
  key: string;
  label: string;
  query: string;
  icon: string;
  bgKey: keyof Theme['colors'];
  accentKey: keyof Theme['colors'];
}

const FAMILIES: FamilyDef[] = [
  { key: 'florale',   label: 'Florale',   query: 'floral',  icon: 'flower-outline',   bgKey: 'primarySoft',    accentKey: 'primary' },
  { key: 'orientale', label: 'Orientale', query: 'oriental',icon: 'moon-outline',     bgKey: 'rewardSoft',     accentKey: 'reward' },
  { key: 'boisee',    label: 'Boisée',    query: 'woody',   icon: 'leaf-outline',    bgKey: 'dealSoft',       accentKey: 'deal' },
  { key: 'fraiche',   label: 'Fraîche',   query: 'fresh',   icon: 'snow-outline',    bgKey: 'pyramidTopSoft', accentKey: 'pyramidTop' },
  { key: 'fougere',   label: 'Fougère',   query: 'fougere', icon: 'sparkles-outline',bgKey: 'violetSoft',     accentKey: 'violetInk' },
  { key: 'chypree',   label: 'Chyprée',   query: 'chypre',  icon: 'diamond-outline', bgKey: 'secondarySoft',  accentKey: 'secondary' },
];

interface Props {
  onFamilyTap: (query: string) => void;
}

export default function FamilyAmbianceCards({ onFamilyTap }: Props) {
  const { theme } = useTheme();
  const s = useMemo(() => getStyles(theme), [theme]);

  return (
    <View style={s.container}>
      <SectionHeader
        title="Explorer par famille"
        style={{ paddingHorizontal: 16 }}
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.scrollContent}
      >
        {FAMILIES.map(f => {
          const bg = theme.colors[f.bgKey] ?? theme.colors.surface2;
          const accent = theme.colors[f.accentKey] ?? theme.colors.primary;
          return (
            <Pressable
              key={f.key}
              style={[s.card, { backgroundColor: bg }]}
              onPress={() => onFamilyTap(f.query)}
            >
              <View style={[s.iconWrap, { backgroundColor: accent + '20' }]}>
                <Ionicons name={f.icon as never} size={22} color={accent} />
              </View>
              <Text style={s.label}>{f.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

function getStyles(t: Theme) {
  return {
    container: { marginBottom: t.spacing.xl },
    scrollContent: { paddingHorizontal: t.spacing.md, gap: 10 },
    card: {
      width: 140,
      height: 80,
      borderRadius: t.radius.base,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 14,
      gap: 10,
      borderWidth: 1,
      borderColor: t.colors.border,
    },
    iconWrap: {
      width: 44,
      height: 44,
      borderRadius: t.radius.sm,
      justifyContent: 'center',
      alignItems: 'center',
    },
    label: {
      fontFamily: 'PlayfairDisplay_600SemiBold',
      fontSize: 14,
      color: t.colors.text,
    },
  } as const;
}
