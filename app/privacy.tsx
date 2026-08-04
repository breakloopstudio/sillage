// app/privacy.tsx — Politique de confidentialité
import { useMemo } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Ionicons from '@react-native-vector-icons/ionicons/static';
import { useTranslation } from 'react-i18next';
import { useTheme, type Theme } from '../src/theme/ThemeContext';
import { LEGAL_EMAIL, LEGAL_COMPANY_NAME } from '../src/config/legal';

export default function PrivacyPage() {
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
          <Text style={s.title}>{t('privacy.title')}</Text>
          <View style={{ width: 32 }} />
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>{t('privacy.s1Title')}</Text>
          <Text style={s.body} maxFontSizeMultiplier={1.3}>
            {t('privacy.s1Body', { company: LEGAL_COMPANY_NAME, email: LEGAL_EMAIL })}
          </Text>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>{t('privacy.s2Title')}</Text>
          <Text style={s.subtitle}>{t('privacy.s21Title')}</Text>
          <Text style={s.body} maxFontSizeMultiplier={1.3}>
            {t('privacy.s21Body')}
          </Text>
          <Text style={s.subtitle}>{t('privacy.s22Title')}</Text>
          <Text style={s.body} maxFontSizeMultiplier={1.3}>
            {t('privacy.s22Body')}
          </Text>
          <Text style={s.subtitle}>{t('privacy.s23Title')}</Text>
          <Text style={s.body} maxFontSizeMultiplier={1.3}>
            {t('privacy.s23Body')}
          </Text>
          <Text style={s.subtitle}>{t('privacy.s24Title')}</Text>
          <Text style={s.body} maxFontSizeMultiplier={1.3}>
            {t('privacy.s24Body')}
          </Text>
          <Text style={s.subtitle}>{t('privacy.s25Title')}</Text>
          <Text style={s.body} maxFontSizeMultiplier={1.3}>
            {t('privacy.s25Body')}
          </Text>
          <Text style={s.subtitle}>{t('privacy.s26Title')}</Text>
          <Text style={s.body} maxFontSizeMultiplier={1.3}>
            {t('privacy.s26Body')}
          </Text>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>{t('privacy.s3Title')}</Text>
          <Text style={s.body} maxFontSizeMultiplier={1.3}>
            {t('privacy.s3Body')}
          </Text>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>{t('privacy.s4Title')}</Text>
          <Text style={s.subtitle}>{t('privacy.s41Title')}</Text>
          <Text style={s.body} maxFontSizeMultiplier={1.3}>
            {t('privacy.s41Body')}
          </Text>
          <Text style={s.subtitle}>{t('privacy.s42Title')}</Text>
          <Text style={s.body} maxFontSizeMultiplier={1.3}>
            {t('privacy.s42Body')}
          </Text>
          <Text style={s.subtitle}>{t('privacy.s43Title')}</Text>
          <Text style={s.body} maxFontSizeMultiplier={1.3}>
            {t('privacy.s43Body')}
          </Text>
          <Text style={s.subtitle}>{t('privacy.s44Title')}</Text>
          <Text style={s.body} maxFontSizeMultiplier={1.3}>
            {t('privacy.s44Body')}
          </Text>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>{t('privacy.s5Title')}</Text>
          <Text style={s.body} maxFontSizeMultiplier={1.3}>
            {t('privacy.s5Body')}
          </Text>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>{t('privacy.s6Title')}</Text>
          <Text style={s.body} maxFontSizeMultiplier={1.3}>
            {t('privacy.s6Body')}
          </Text>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>{t('privacy.s7Title')}</Text>
          <Text style={s.body} maxFontSizeMultiplier={1.3}>
            {t('privacy.s7Body', { email: LEGAL_EMAIL })}
          </Text>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>{t('privacy.s8Title')}</Text>
          <Text style={s.body} maxFontSizeMultiplier={1.3}>
            {t('privacy.s8Body')}
          </Text>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>{t('privacy.s9Title')}</Text>
          <Text style={s.body} maxFontSizeMultiplier={1.3}>
            {t('privacy.s9Body')}
          </Text>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>{t('privacy.s10Title')}</Text>
          <Text style={s.body} maxFontSizeMultiplier={1.3}>
            {t('privacy.s10Body')}
          </Text>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>{t('privacy.s11Title')}</Text>
          <Text style={s.body} maxFontSizeMultiplier={1.3}>
            {t('privacy.s11Body')}
          </Text>
        </View>

        <Text style={s.version}>{t('privacy.lastUpdate')}</Text>
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
    subtitle: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: t.colors.text, marginTop: 12, marginBottom: 4 },
    body: { fontFamily: 'Inter_400Regular', fontSize: 14, color: t.colors.text, lineHeight: 22 },
    bold: { fontFamily: 'Inter_600SemiBold' },
    version: { textAlign: 'center', fontFamily: 'Inter_400Regular', fontSize: 12, color: t.colors.textMuted, marginTop: 16 },
  } as const;
}
