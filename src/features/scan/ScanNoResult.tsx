// src/features/scan/ScanNoResult.tsx — Aucun résultat + actions de secours

import { useMemo } from 'react';
import { View, Text, Pressable } from 'react-native';
import Ionicons from "@react-native-vector-icons/ionicons/static";
import { useTheme, type Theme } from '../../theme/ThemeContext';
import { textOn } from '../../utils/contrast';

interface Props {
  marque: string | null;
  onSearchCatalog: (marque: string) => void;
  onRescan: () => void;
  onManual: () => void;
  onReset: () => void;
}

export function ScanNoResult({ marque, onSearchCatalog, onRescan, onManual, onReset }: Props) {
  const { theme } = useTheme();
  const s = useMemo(() => getStyles(theme), [theme]);
  return (
    <View style={s.container}>
      <Ionicons name="search-outline" size={64} color={theme.colors.primary} style={{ opacity: 0.6 }} />
      <Text style={s.title}>Parfum introuvable</Text>
      <Text style={s.desc}>
        Ce parfum n'est pas dans notre catalogue.{'\n'}Reprends la photo ou cherche la marque.
      </Text>
      <View style={s.actions}>
        <Pressable style={s.cta} onPress={onRescan} accessibilityRole="button" accessibilityLabel="Reprendre la photo">
          <Ionicons name="camera-outline" size={20} color={textOn(theme.colors.primary)} style={{ marginRight: 8 }} />
          <Text style={s.ctaText}>Reprendre la photo</Text>
        </Pressable>
        {marque && (
          <Pressable style={s.outline} onPress={() => onSearchCatalog(marque)}>
            <Ionicons name="book-outline" size={18} color={theme.colors.primary} style={{ marginRight: 8 }} />
            <Text style={s.outlineText}>Chercher « {marque} »</Text>
          </Pressable>
        )}
        <Pressable style={s.link} onPress={onManual} hitSlop={8}>
          <Ionicons name="create-outline" size={16} color={theme.colors.textMuted} style={{ marginRight: 6 }} />
          <Text style={s.linkText}>Saisir manuellement</Text>
        </Pressable>
        <Pressable style={s.link} onPress={onReset} hitSlop={8}>
          <Text style={s.linkText}>Retour à l'accueil</Text>
        </Pressable>
      </View>
    </View>
  );
}

function getStyles(t: Theme) {
  return {
    container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, backgroundColor: t.colors.background },
    title: { fontFamily: 'PlayfairDisplay_600SemiBold', fontSize: 20, color: t.colors.text, marginTop: 16, marginBottom: 8 },
    desc: { fontSize: 14, color: t.colors.textMuted, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
    actions: { width: '100%', maxWidth: 300, gap: 12, alignItems: 'center' },
    cta: { flexDirection: 'row', backgroundColor: t.colors.primary, borderRadius: t.radius.base, height: 48, paddingHorizontal: 24, justifyContent: 'center', alignItems: 'center', ...t.shadow.button },
    ctaText: { color: textOn(t.colors.primary), fontFamily: 'Inter_600SemiBold', fontSize: 16 },
    outline: { flexDirection: 'row', borderRadius: t.radius.base, height: 48, paddingHorizontal: 24, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: t.colors.primary },
    outlineText: { color: t.colors.primary, fontFamily: 'Inter_600SemiBold', fontSize: 15 },
    link: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 4 },
    linkText: { fontSize: 14, color: t.colors.textMuted },
  } as const;
}
