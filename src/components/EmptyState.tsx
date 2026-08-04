// src/components/EmptyState.tsx — État vide pour les 4 listes du profil

import { useMemo } from 'react';
import { View, Text, type ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';
import Ionicons from '@react-native-vector-icons/ionicons/static';
import { useTheme, type Theme } from '../theme/ThemeContext';
import Button from './Button';

type Variant = 'collection' | 'favoris' | 'historique' | 'wardrobe' | 'scentlist' | 'alertes';

const ICONS = {
  collection: 'flask-outline',
  favoris: 'heart-outline',
  historique: 'scan-outline',
  wardrobe: 'flask-outline',
  scentlist: 'eyedrop-outline',
  alertes: 'notifications-outline',
} as const satisfies Record<Variant, string>;

interface Props {
  variant: Variant;
  onAction: () => void;
  style?: ViewStyle;
  actionLabel?: string;
}

export default function EmptyState({ variant, onAction, style, actionLabel }: Props) {
  const { theme } = useTheme();
  const s = useMemo(() => getStyles(theme), [theme]);
  const { t } = useTranslation('common');
  const icon = ICONS[variant];
  const title = t(`empty.${variant}.title`);
  const desc = t(`empty.${variant}.desc`);
  const ctaLabel = actionLabel ?? t(`empty.${variant}.cta`);

  return (
    <View style={[s.container, style]}>
      <View style={s.iconCircle}>
        <Ionicons name={icon} size={32} color={theme.colors.primary} />
      </View>
      <Text style={s.title}>{title}</Text>
      <Text style={s.desc}>{desc}</Text>
      <Button variant="primary" onPress={onAction} style={s.cta}>
        {ctaLabel}
      </Button>
    </View>
  );
}

function getStyles(t: Theme) {
  return {
    container: {
      alignItems: 'center',
      paddingTop: 40,
      paddingHorizontal: 24,
    },
    iconCircle: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: t.colors.primarySoft,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 16,
    },
    title: {
      fontFamily: 'PlayfairDisplay_700Bold',
      fontSize: 20,
      color: t.colors.text,
      textAlign: 'center',
      marginBottom: 8,
    },
    desc: {
      fontFamily: 'Inter_400Regular',
      fontSize: 14,
      color: t.colors.textMuted,
      textAlign: 'center',
      lineHeight: 21,
      marginBottom: 24,
      maxWidth: 300,
    },
    cta: {
      minWidth: 220,
    },
  } as const;
}
