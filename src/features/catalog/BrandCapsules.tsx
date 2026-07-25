// src/features/catalog/BrandCapsules.tsx — Pastilles marques rectangulaires en scroll horizontal

import { useMemo, useCallback } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import Ionicons from '@react-native-vector-icons/ionicons/static';
import SectionHeader from '../../components/SectionHeader';
import { useTheme, type Theme } from '../../theme/ThemeContext';

const TOP_BRANDS = [
  'Dior', 'Chanel', 'Tom Ford', 'Hermès', 'Yves Saint Laurent',
  'Guerlain', 'Creed', 'Le Labo', 'Byredo', 'Maison Francis Kurkdjian',
];

interface Props {
  onViewAll: () => void;
  onBrandTap: (brand: string) => void;
}

export default function BrandCapsules({ onViewAll, onBrandTap }: Props) {
  const { theme } = useTheme();
  const s = useMemo(() => getStyles(theme), [theme]);

  return (
    <View style={s.container}>
      <SectionHeader
        title="Maisons iconiques"
        actionLabel="Toutes →"
        onAction={onViewAll}
        style={{ paddingHorizontal: 16 }}
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.scrollContent}
      >
        {TOP_BRANDS.map(brand => (
          <Pressable
            key={brand}
            style={({ pressed }) => [s.capsule, pressed && s.capsulePressed]}
            onPress={() => onBrandTap(brand)}
          >
            <Text style={s.capsuleText} numberOfLines={1}>{brand}</Text>
          </Pressable>
        ))}
        <Pressable
          style={({ pressed }) => [s.capsuleAll, pressed && s.capsuleAllPressed]}
          onPress={onViewAll}
        >
          <Text style={s.capsuleAllText}>Toutes</Text>
          <Ionicons name="arrow-forward" size={14} color={theme.colors.primaryInk} />
        </Pressable>
      </ScrollView>
    </View>
  );
}

function getStyles(t: Theme) {
  return {
    container: { marginBottom: t.spacing.xl, paddingTop: 4 },
    scrollContent: { paddingHorizontal: t.spacing.md, gap: 10 },
    capsule: {
      height: 42,
      maxWidth: 180,
      paddingHorizontal: 16,
      backgroundColor: t.colors.surface,
      borderWidth: 1,
      borderColor: t.colors.border,
      borderRadius: 21,
      justifyContent: 'center',
      alignItems: 'center',
    },
    capsulePressed: {
      borderColor: t.colors.primary,
      backgroundColor: t.colors.primarySoft,
    },
    capsuleText: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 14,
      color: t.colors.text,
    },
    capsuleAll: {
      height: 42,
      paddingHorizontal: 16,
      backgroundColor: t.colors.primarySoft,
      borderRadius: 21,
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 6,
    },
    capsuleAllPressed: {
      opacity: 0.7,
    },
    capsuleAllText: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 14,
      color: t.colors.primaryInk,
    },
  } as const;
}
