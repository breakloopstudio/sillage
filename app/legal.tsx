// app/legal.tsx — Mentions légales
import { useMemo } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Ionicons from '@react-native-vector-icons/ionicons/static';
import { useTheme, type Theme } from '../src/theme/ThemeContext';
import {
  LEGAL_COMPANY_NAME, LEGAL_COMPANY_FORM, LEGAL_ADDRESS, LEGAL_RCS,
  LEGAL_EMAIL, LEGAL_DIRECTOR_NAME, LEGAL_HOST_NAME, LEGAL_HOST_ADDRESS, LEGAL_HOST_PHONE,
} from '../src/config/legal';

export default function LegalPage() {
  const { theme } = useTheme();
  const s = useMemo(() => getStyles(theme), [theme]);
  const router = useRouter();

  return (
    <SafeAreaView edges={['top', 'bottom']} style={s.container}>
      <ScrollView contentContainerStyle={s.scroll}>
        <View style={s.header}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={s.backBtn} accessibilityLabel="Retour">
            <Ionicons name="arrow-back" size={22} color={theme.colors.text} />
          </Pressable>
          <Text style={s.title}>Mentions légales</Text>
          <View style={{ width: 32 }} />
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>Éditeur de l'application</Text>
          <Text style={s.body} maxFontSizeMultiplier={1.3}>
            L'application ParfumScan est éditée par {LEGAL_COMPANY_NAME}.{'\n'}
            {LEGAL_COMPANY_FORM !== 'À_COMPLÉTER' ? `\nForme juridique : ${LEGAL_COMPANY_FORM}` : ''}
            {LEGAL_ADDRESS !== 'À_COMPLÉTER' ? `\nSiège social : ${LEGAL_ADDRESS}` : ''}
            {LEGAL_RCS !== 'À_COMPLÉTER' ? `\nRCS : ${LEGAL_RCS}` : ''}
            {'\n\n'}Contact : {LEGAL_EMAIL}
          </Text>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>Directeur de la publication</Text>
          <Text style={s.body} maxFontSizeMultiplier={1.3}>
            {LEGAL_DIRECTOR_NAME}, représentant légal de {LEGAL_COMPANY_NAME}
          </Text>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>Hébergement</Text>
          <Text style={s.body} maxFontSizeMultiplier={1.3}>
            L'application est hébergée par :{'\n\n'}
            {LEGAL_HOST_NAME}{'\n'}
            {LEGAL_HOST_ADDRESS}{'\n'}
            Tél. : {LEGAL_HOST_PHONE}{'\n\n'}
            Les données sont stockées dans la région europe-west1 (Belgique).
          </Text>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>Propriété intellectuelle</Text>
          <Text style={s.body} maxFontSizeMultiplier={1.3}>
            L'ensemble du code source, du design, des textes et des éléments graphiques de l'application ParfumScan est la propriété exclusive de l'éditeur, sauf mention contraire.{'\n\n'}
            Toute reproduction, représentation, modification ou adaptation, partielle ou totale, est interdite sans autorisation préalable.{'\n\n'}
            La base de données de parfums est constituée à partir de données publiques et reste la propriété de leurs auteurs respectifs.
          </Text>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>Contact</Text>
          <Text style={s.body} maxFontSizeMultiplier={1.3}>
            Pour toute question relative à l'application, contactez-nous à l'adresse : {LEGAL_EMAIL}.
          </Text>
        </View>

        <Text style={s.version}>Dernière mise à jour : juillet 2026</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function getStyles(t: Theme) {
  return {
    container: { flex: 1, backgroundColor: t.colors.background },
    scroll: { paddingBottom: 60 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, marginBottom: 8 },
    backBtn: { width: 32, height: 32, justifyContent: 'center', alignItems: 'center' },
    title: { fontFamily: 'PlayfairDisplay_700Bold', fontSize: 22, color: t.colors.text },
    section: { marginBottom: 24, paddingHorizontal: 16 },
    sectionTitle: { fontFamily: 'PlayfairDisplay_600SemiBold', fontSize: 18, color: t.colors.text, marginBottom: 10 },
    body: { fontFamily: 'Inter_400Regular', fontSize: 14, color: t.colors.text, lineHeight: 22 },
    version: { textAlign: 'center', fontFamily: 'Inter_400Regular', fontSize: 12, color: t.colors.textMuted, marginTop: 16 },
  } as const;
}
