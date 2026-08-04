// app/legal.tsx — Mentions légales
import { useMemo } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Ionicons from '@react-native-vector-icons/ionicons/static';
import { useTranslation } from 'react-i18next';
import { useTheme, type Theme } from '../src/theme/ThemeContext';
import {
  LEGAL_COMPANY_NAME, LEGAL_COMPANY_FORM, LEGAL_ADDRESS, LEGAL_RCS,
  LEGAL_EMAIL, LEGAL_DIRECTOR_NAME, LEGAL_HOST_NAME, LEGAL_HOST_ADDRESS, LEGAL_HOST_PHONE,
} from '../src/config/legal';

export default function LegalPage() {
  const { theme } = useTheme();
  const s = useMemo(() => getStyles(theme), [theme]);
  const { t } = useTranslation('common');
  const router = useRouter();

  return (
    <SafeAreaView edges={['top', 'bottom']} style={s.container}>
      <ScrollView contentContainerStyle={s.scroll}>
        <View style={s.header}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={s.backBtn} accessibilityLabel={t('back')}>
            <Ionicons name="arrow-back" size={22} color={theme.colors.text} />
          </Pressable>
          <Text style={s.title}>{t('legal.title')}</Text>
          <View style={{ width: 32 }} />
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>{t('legal.editorSection')}</Text>
          <Text style={s.body} maxFontSizeMultiplier={1.3}>
            {t('legal.editorIntro', { company: LEGAL_COMPANY_NAME })}{'\n'}
            {LEGAL_COMPANY_FORM !== 'À_COMPLÉTER' ? `\n${t('legal.legalForm', { value: LEGAL_COMPANY_FORM })}` : ''}
            {LEGAL_ADDRESS !== 'À_COMPLÉTER' ? `\n${t('legal.headOffice', { value: LEGAL_ADDRESS })}` : ''}
            {LEGAL_RCS !== 'À_COMPLÉTER' ? `\n${t('legal.rcs', { value: LEGAL_RCS })}` : ''}
            {'\n\n'}{t('legal.contactLabel')} {LEGAL_EMAIL}
          </Text>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>{t('legal.directorSection')}</Text>
          <Text style={s.body} maxFontSizeMultiplier={1.3}>
            {t('legal.directorLine', { director: LEGAL_DIRECTOR_NAME, company: LEGAL_COMPANY_NAME })}
          </Text>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>{t('legal.hostingSection')}</Text>
          <Text style={s.body} maxFontSizeMultiplier={1.3}>
            {t('legal.hostingIntro')}{'\n\n'}
            {LEGAL_HOST_NAME}{'\n'}
            {LEGAL_HOST_ADDRESS}{'\n'}
            {t('legal.hostPhone', { phone: LEGAL_HOST_PHONE })}{'\n\n'}
            {t('legal.dataRegion')}
          </Text>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>{t('legal.ipSection')}</Text>
          <Text style={s.body} maxFontSizeMultiplier={1.3}>
            {t('legal.ipParagraph1')}{'\n\n'}
            {t('legal.ipParagraph2')}{'\n\n'}
            {t('legal.ipParagraph3')}
          </Text>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>{t('legal.contactSection')}</Text>
          <Text style={s.body} maxFontSizeMultiplier={1.3}>
            {t('legal.contactParagraph', { email: LEGAL_EMAIL })}
          </Text>
        </View>

        <Text style={s.version}>{t('legal.lastUpdate')}</Text>
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
