// src/components/EmptyState.tsx — État vide pour les 4 listes du profil

import { useMemo } from 'react';
import { View, Text, type ViewStyle } from 'react-native';
import Ionicons from '@react-native-vector-icons/ionicons/static';
import { useTheme, type Theme } from '../theme/ThemeContext';
import Button from './Button';

type Variant = 'collection' | 'favoris' | 'historique' | 'wardrobe' | 'scentlist';

const CONFIG = {
  collection: {
    icon: 'flask-outline',
    title: 'Ta collection est vide',
    desc: 'Ajoute les parfums que tu possèdes pour constituer ton inventaire personnel.',
    cta: 'Explorer le catalogue',
  },
  favoris: {
    icon: 'heart-outline',
    title: 'Ton nez n\'a pas encore de coup de cœur',
    desc: 'Parcourt le catalogue et garde tes parfums préférés à portée de main. Pas d\'obligation d\'achat, juste l\'émotion.',
    cta: 'Explorer le catalogue',
  },
  historique: {
    icon: 'scan-outline',
    title: 'Aucun scan pour l\'instant',
    desc: 'Photographie un flacon de parfum pour commencer ton historique. Chaque scan te rapproche du meilleur prix.',
    cta: 'Scanner un flacon',
  },
  wardrobe: {
    icon: 'flask-outline',
    title: 'Votre parfumerie est vide',
    desc: 'Ajoutez vos premiers flacons pour constituer votre collection personnelle.',
    cta: 'Explorer le catalogue',
  },
  scentlist: {
    icon: 'eyedrop-outline',
    title: 'Ton carnet d\'essais est vide',
    desc: 'Sauvegarde les parfums que tu veux sentir, puis note tes impressions après l\'essai. En boutique, c\'est ton meilleur allié.',
    cta: 'Explorer le catalogue',
  },
} as const satisfies Record<Variant, { icon: string; title: string; desc: string; cta: string }>;

interface Props {
  variant: Variant;
  onAction: () => void;
  style?: ViewStyle;
}

export default function EmptyState({ variant, onAction, style }: Props) {
  const { theme } = useTheme();
  const s = useMemo(() => getStyles(theme), [theme]);
  const { icon, title, desc, cta } = CONFIG[variant];

  return (
    <View style={[s.container, style]}>
      <View style={s.iconCircle}>
        <Ionicons name={icon} size={32} color={theme.colors.primary} />
      </View>
      <Text style={s.title}>{title}</Text>
      <Text style={s.desc}>{desc}</Text>
      <Button variant="primary" onPress={onAction} style={s.cta}>
        {cta}
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
