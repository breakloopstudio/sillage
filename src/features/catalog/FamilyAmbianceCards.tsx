// src/features/catalog/FamilyAmbianceCards.tsx — Cartes d'ambiance « Explorer par famille »
// v3 : 1 seul round-trip (RPC family_overviews), flacon détouré qui flotte sur un
// fond teinté par famille + ombre de contact, rotation quotidienne du flacon
// emblématique, badge icône accent, tagline sensorielle, effectif.
// Tap → /search?family=<key>.

import { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import Ionicons from '@react-native-vector-icons/ionicons/static';
import SectionHeader from '../../components/SectionHeader';
import { useTheme, type Theme } from '../../theme/ThemeContext';
import { OLFACTORY_FAMILIES, type OlfactoryFamily } from '../../utils/olfactory-families';
import { getFamilyOverviews } from '../../services/catalog';
import { textOn } from '../../utils/contrast';

interface Props {
  onFamilyTap: (familyKey: string) => void;
}

export default function FamilyAmbianceCards({ onFamilyTap }: Props) {
  const { theme } = useTheme();
  const s = useMemo(() => getStyles(theme), [theme]);
  const [overviews, setOverviews] = useState<Record<string, { bottles: string[]; count: number }>>({});
  const [loaded, setLoaded] = useState(false);
  const day = useMemo(() => Math.floor(Date.now() / 86400000), []);

  useEffect(() => {
    let cancelled = false;
    getFamilyOverviews(OLFACTORY_FAMILIES.map(f => ({ key: f.key, values: f.values })))
      .then(result => { if (!cancelled) setOverviews(result); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoaded(true); });
    return () => { cancelled = true; };
  }, []);

  const handlePress = useCallback((key: string) => {
    onFamilyTap(key);
  }, [onFamilyTap]);

  if (!loaded) return null;

  const cards = OLFACTORY_FAMILIES
    .map(family => {
      const ov = overviews[family.key];
      const bottles = ov?.bottles ?? [];
      const bottleUrl = bottles.length > 0 ? bottles[day % bottles.length] : null;
      return { family, bottleUrl, count: ov?.count ?? 0 };
    })
    .filter(c => c.bottleUrl !== null && c.count > 0);

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
        {cards.map(({ family, bottleUrl, count }) => (
          <FamilyCard
            key={family.key}
            family={family}
            bottleUrl={bottleUrl!}
            count={count}
            onPress={() => handlePress(family.key)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

function FamilyCard({ family, bottleUrl, count, onPress }: {
  family: OlfactoryFamily;
  bottleUrl: string;
  count: number;
  onPress: () => void;
}) {
  const { theme, resolvedMode } = useTheme();
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
        <View
          style={[s.contactShadow, { opacity: resolvedMode === 'dark' ? 0.05 : 0.1 }]}
          accessible={false}
        />
        <Image
          source={{ uri: bottleUrl }}
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
      zIndex: 2,
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
    contactShadow: {
      position: 'absolute',
      bottom: 8,
      left: '20%',
      right: '20%',
      height: 10,
      borderRadius: 9999,
      backgroundColor: t.colors.text,
    },
    bottle: {
      width: '100%',
      height: '100%',
      zIndex: 1,
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
