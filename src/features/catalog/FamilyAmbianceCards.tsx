// src/features/catalog/FamilyAmbianceCards.tsx — Cartes d'ambiance « Explorer par famille »
// v2 : flacon détouré (WebP transparent) qui flotte sur un fond teinté par famille,
// badge icône accent, tagline sensorielle, effectif. Tape → /search?family=<key>.

import { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import Ionicons from '@react-native-vector-icons/ionicons/static';
import SectionHeader from '../../components/SectionHeader';
import { useTheme, type Theme } from '../../theme/ThemeContext';
import { OLFACTORY_FAMILIES, type OlfactoryFamily } from '../../utils/olfactory-families';
import { getFamilyOverview } from '../../services/firestore';
import { textOn } from '../../utils/contrast';
import type { Parfum } from '../../models';

interface Props {
  onFamilyTap: (familyKey: string) => void;
}

export default function FamilyAmbianceCards({ onFamilyTap }: Props) {
  const { theme } = useTheme();
  const s = useMemo(() => getStyles(theme), [theme]);
  const [overviews, setOverviews] = useState<Record<string, { top: Parfum | null; count: number }>>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all(
      OLFACTORY_FAMILIES.map(async f => {
        const ov = await getFamilyOverview(f.values);
        return [f.key, ov] as const;
      }),
    ).then(entries => {
      if (cancelled) return;
      setOverviews(Object.fromEntries(entries));
      setLoaded(true);
    });
    return () => { cancelled = true; };
  }, []);

  const handlePress = useCallback((key: string) => {
    onFamilyTap(key);
  }, [onFamilyTap]);

  if (!loaded) return null;

  const cards = OLFACTORY_FAMILIES
    .map(f => ({ family: f, overview: overviews[f.key] }))
    .filter(c => c.overview?.top?.imageUrl);

  if (cards.length === 0) return null;

  return (
    <View style={s.container}>
      <SectionHeader
        title="Explorer par famille"
        subtitle="Trouve ton sillage"
        style={{ paddingHorizontal: 16 }}
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.scrollContent}
      >
        {cards.map(({ family, overview }) => (
          <FamilyCard
            key={family.key}
            family={family}
            top={overview!.top!}
            count={overview!.count}
            onPress={() => handlePress(family.key)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

function FamilyCard({ family, top, count, onPress }: {
  family: OlfactoryFamily;
  top: Parfum;
  count: number;
  onPress: () => void;
}) {
  const { theme } = useTheme();
  const s = useMemo(() => getStyles(theme), [theme]);
  const accent = theme.colors[family.accent];
  const accentSoft = theme.colors[family.accentSoft];

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        s.card,
        { backgroundColor: accentSoft },
        pressed && s.cardPressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${family.label}, ${family.tagline}, ${count} parfums`}
    >
      <View style={[s.iconBadge, { backgroundColor: accent }]}>
        <Ionicons name={family.icon as never} size={14} color={textOn(accent)} />
      </View>
      <View style={s.imageZone}>
        <Image
          source={{ uri: top.imageUrl }}
          style={s.bottle}
          contentFit="contain"
          transition={300}
        />
      </View>
      <View style={s.textBlock}>
        <Text style={s.label}>{family.label}</Text>
        <Text style={s.tagline} numberOfLines={1}>{family.tagline}</Text>
        <View style={s.countRow}>
          <View style={[s.countDot, { backgroundColor: accent }]} />
          <Text style={s.countText}>{count.toLocaleString('fr-FR')} parfums</Text>
        </View>
      </View>
    </Pressable>
  );
}

function getStyles(t: Theme) {
  return {
    container: { marginBottom: t.spacing.xl },
    scrollContent: { paddingHorizontal: t.spacing.md, gap: 12 },

    card: {
      width: 150,
      borderRadius: t.radius.card,
      overflow: 'hidden',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border,
    },
    cardPressed: { opacity: 0.85 },

    iconBadge: {
      position: 'absolute',
      top: 10,
      left: 10,
      zIndex: 1,
      width: 28,
      height: 28,
      borderRadius: 14,
      justifyContent: 'center',
      alignItems: 'center',
    },

    imageZone: {
      height: 130,
      paddingTop: 14,
      paddingHorizontal: 12,
      justifyContent: 'flex-end',
      alignItems: 'center',
    },
    bottle: {
      width: '100%',
      height: '100%',
    },

    textBlock: {
      paddingHorizontal: 12,
      paddingTop: 8,
      paddingBottom: 12,
      gap: 2,
    },
    label: {
      fontFamily: 'PlayfairDisplay_600SemiBold',
      fontSize: 16,
      color: t.colors.text,
    },
    tagline: {
      fontFamily: 'Inter_400Regular',
      fontSize: 11,
      color: t.colors.textMuted,
    },
    countRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      marginTop: 4,
    },
    countDot: {
      width: 5,
      height: 5,
      borderRadius: 3,
    },
    countText: {
      fontFamily: 'Inter_500Medium',
      fontSize: 10,
      color: t.colors.textMuted,
      fontVariant: ['tabular-nums'] as import('react-native').FontVariant[],
    },
  } as const;
}
