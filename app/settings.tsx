// app/settings.tsx — Page de paramètres

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { View, Text, ScrollView, Switch, Pressable, StyleSheet, Share, Alert, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import Constants from 'expo-constants';
import * as Location from 'expo-location';
import { useTranslation } from 'react-i18next';
import Ionicons from '@react-native-vector-icons/ionicons/static';
import { useAuthContext } from '../src/contexts/AuthContext';
import { getUserSettings, updateUserSetting } from '../src/services/user-data';
import { getPushPermissionStatus, requestFcmPermission, registerPushToken } from '../src/services/push';
import { deleteAllFcmTokens, clearWeatherCoords } from '../src/services/account';
import { hapticsLight } from '../src/services/haptics';
import { useTheme, type Theme } from '../src/theme/ThemeContext';
import { useVoicePreference } from '../src/hooks/useVoicePreference';
import { usePermissionPrimer } from '../src/hooks/usePermissionPrimer';
import { PERMISSION_PRIMERS } from '../src/utils/permission-primers';
import PermissionPrimer from '../src/components/PermissionPrimer';
import ActionSheet from '../src/components/ActionSheet';
import { getLanguagePreference } from '../src/services/language-storage';
import { resolveInitialLanguage, setAppLanguage } from '../src/i18n';
import { AVAILABLE_LANGUAGES, SYSTEM_LANGUAGE, nativeLabelFor, type LanguagePreference } from '../src/i18n/config';
import type { ThemeMode } from '../src/services/theme-storage';

export default function SettingsPage() {
  const { user, logout } = useAuthContext();
  const router = useRouter();
  const { theme, mode, setMode } = useTheme();
  const s = useMemo(() => getStyles(theme), [theme]);
  const [priceAlerts, setPriceAlerts] = useState(false);
  const [pushNotifs, setPushNotifs] = useState(true);
  const [weatherNotifs, setWeatherNotifs] = useState(false);
  // Statut OS réel des notifications (le toggle peut être ON mais l'OS avoir
  // refusé) — affiché honnêtement + porte de sortie vers les réglages.
  const [osPushDenied, setOsPushDenied] = useState(false);
  const { voiceEnabled, setVoiceEnabled } = useVoicePreference();
  const pushPrimer = usePermissionPrimer('push');
  const locationPrimer = usePermissionPrimer('location');
  const { t } = useTranslation('common');

  // Langue de l'app (i18n) — préférence persistée, 'system' suit la locale appareil.
  const [langPref, setLangPref] = useState<LanguagePreference>(SYSTEM_LANGUAGE);
  const [langSheet, setLangSheet] = useState(false);

  useEffect(() => {
    getLanguagePreference().then(setLangPref).catch(() => {});
  }, []);

  const langDescription = useMemo(() => {
    if (langPref === SYSTEM_LANGUAGE) {
      return t('settings.language.systemWithValue', { value: nativeLabelFor(resolveInitialLanguage(SYSTEM_LANGUAGE)) });
    }
    return nativeLabelFor(langPref);
  }, [langPref, t]);

  const handleLanguagePick = useCallback((pref: LanguagePreference) => {
    setLangSheet(false);
    setLangPref(pref);
    hapticsLight();
    setAppLanguage(pref).catch(() => {});
  }, []);

  const closeLangSheet = useCallback(() => setLangSheet(false), []);

  const languageActions = useMemo(() => [
    { icon: 'phone-portrait-outline', label: t('settings.language.system'), onPress: () => handleLanguagePick(SYSTEM_LANGUAGE) },
    ...AVAILABLE_LANGUAGES.map(l => ({ icon: 'language-outline', label: l.nativeLabel, onPress: () => handleLanguagePick(l.code) })),
  ], [t, handleLanguagePick]);

  const easterEggTaps = useRef(0);
  const easterEggTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleVersionTap = useCallback(() => {
    easterEggTaps.current += 1;
    if (easterEggTimer.current) { clearTimeout(easterEggTimer.current); }
    if (easterEggTaps.current >= 5) {
      easterEggTaps.current = 0;
      router.push('/runner');
      return;
    }
    easterEggTimer.current = setTimeout(() => {
      easterEggTaps.current = 0;
    }, 2000);
  }, [router]);

  const handleThemeChange = useCallback((m: ThemeMode) => {
    setMode(m);
  }, [setMode]);

  const handleShareApp = useCallback(async () => {
    hapticsLight();
    try { await Share.share({ message: t('settings.shareMessage') }); } catch { /* annulation */ }
  }, [t]);

  useEffect(() => {
    if (user?.uid) {
      getUserSettings(user.uid).then(s => {
        setPriceAlerts(s.priceAlerts);
        setPushNotifs(s.pushNotifs);
        setWeatherNotifs(s.weatherNotifs);
      }).catch(() => {});
    }
  }, [user?.uid]);

  // Re-vérifié au focus : après un aller-retour dans les réglages système
  // (via l'alerte « Réglages »), le statut OS peut avoir changé.
  useFocusEffect(
    useCallback(() => {
      getPushPermissionStatus().then(st => setOsPushDenied(st === 'denied')).catch(() => {});
    }, []),
  );

  // Activation push : primer (1ère fois) puis prompt système, enfin enregistrement
  // du token. Refus OS définitif → porte de sortie vers les réglages.
  const requestPushAndRegister = useCallback(async () => {
    if (!user?.uid) return;
    const granted = await requestFcmPermission();
    if (granted) {
      setOsPushDenied(false);
      await registerPushToken(user.uid);
    } else {
      setPushNotifs(false);
      updateUserSetting(user.uid, 'pushNotifs', false).catch(() => {});
      const status = await getPushPermissionStatus();
      setOsPushDenied(status === 'denied');
      if (status === 'denied') {
        Alert.alert(t('settings.notifications.deniedTitle'), t('settings.notifications.deniedMessage'), [
          { text: t('cancel'), style: 'cancel' },
          { text: t('openSettings'), onPress: () => Linking.openSettings() },
        ]);
      }
    }
  }, [user?.uid, t]);

  const handlePushNotifs = useCallback(async (val: boolean) => {
    setPushNotifs(val);
    if (!user?.uid) return;
    updateUserSetting(user.uid, 'pushNotifs', val).catch(() => {});
    if (val) {
      const status = await getPushPermissionStatus();
      if (status === 'granted') {
        await registerPushToken(user.uid);
        return;
      }
      if (status === 'denied') {
        setOsPushDenied(true);
        Alert.alert(t('settings.notifications.deniedTitle'), t('settings.notifications.deniedMessage'), [
          { text: t('cancel'), style: 'cancel' },
          { text: t('openSettings'), onPress: () => Linking.openSettings() },
        ]);
        return;
      }
      if (pushPrimer.needsPrimer) pushPrimer.open();
      else void requestPushAndRegister();
    } else {
      deleteAllFcmTokens(user.uid).catch(() => {});
    }
  }, [user?.uid, pushPrimer, requestPushAndRegister, t]);

  const handlePushPrimerAccept = useCallback(() => {
    pushPrimer.accept();
    void requestPushAndRegister();
  }, [pushPrimer, requestPushAndRegister]);

  const handlePushPrimerDecline = useCallback(() => {
    pushPrimer.decline();
    setPushNotifs(false);
    if (user?.uid) updateUserSetting(user.uid, 'pushNotifs', false).catch(() => {});
  }, [pushPrimer, user?.uid]);

  const handlePriceAlerts = useCallback(async (val: boolean) => {
    setPriceAlerts(val);
    if (user?.uid) updateUserSetting(user.uid, 'priceAlerts', val).catch(() => {});
  }, [user?.uid]);

  // Activation météo : consentement + primer localisation (1ère fois) puis prompt.
  // Désactivation : efface les coordonnées stockées (retrait réel du consentement).
  const handleWeatherNotifs = useCallback(async (val: boolean) => {
    setWeatherNotifs(val);
    if (!user?.uid) return;
    updateUserSetting(user.uid, 'weatherNotifs', val).catch(() => {});
    if (val) {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status === 'granted') return;
      if (status === 'denied') {
        Alert.alert(t('settings.notifications.locationDeniedTitle'), t('settings.notifications.locationDeniedMessage'), [
          { text: t('cancel'), style: 'cancel' },
          { text: t('openSettings'), onPress: () => Linking.openSettings() },
        ]);
        return;
      }
      if (locationPrimer.needsPrimer) locationPrimer.open();
      else Location.requestForegroundPermissionsAsync().catch(() => {});
    } else {
      clearWeatherCoords(user.uid).catch(() => {});
    }
  }, [user?.uid, locationPrimer, t]);

  const handleLocationPrimerAccept = useCallback(() => {
    locationPrimer.accept();
    Location.requestForegroundPermissionsAsync().catch(() => {});
  }, [locationPrimer]);

  const handleLocationPrimerDecline = useCallback(() => {
    locationPrimer.decline();
  }, [locationPrimer]);

  return (
    <SafeAreaView edges={['top', 'bottom']} style={s.container}>
      <ScrollView contentContainerStyle={s.scroll}>
        <View style={s.header}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={s.backBtn} accessibilityLabel={t('settings.back')}>
            <Ionicons name="arrow-back" size={22} color={theme.colors.text} />
          </Pressable>
          <Text style={s.title}>{t('settings.title')}</Text>
          <View style={{ width: 32 }} />
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>{t('settings.sections.notifications')}</Text>

          <View style={s.row}>
            <View style={s.rowLeft}>
              <Ionicons name="notifications-outline" size={20} color={theme.colors.text} />
              <View>
                <Text style={s.rowLabel}>{t('settings.notifications.priceAlerts.label')}</Text>
                <Text style={s.rowDesc}>{t('settings.notifications.priceAlerts.desc')}</Text>
              </View>
            </View>
            <Switch value={priceAlerts} onValueChange={handlePriceAlerts} trackColor={{ false: theme.colors.border, true: theme.colors.primarySoft }} thumbColor={priceAlerts ? theme.colors.primary : theme.colors.textMuted} />
          </View>

          <View style={s.row}>
            <View style={s.rowLeft}>
              <Ionicons name="push-outline" size={20} color={theme.colors.text} />
              <View>
                <Text style={s.rowLabel}>{t('settings.notifications.push.label')}</Text>
                <Text style={s.rowDesc}>{osPushDenied ? t('settings.notifications.push.descDenied') : t('settings.notifications.push.descOk')}</Text>
              </View>
            </View>
            <Switch value={pushNotifs} onValueChange={handlePushNotifs} trackColor={{ false: theme.colors.border, true: theme.colors.primarySoft }} thumbColor={pushNotifs ? theme.colors.primary : theme.colors.textMuted} />
          </View>

          <View style={s.row}>
            <View style={s.rowLeft}>
              <Ionicons name="partly-sunny-outline" size={20} color={theme.colors.text} />
              <View>
                <Text style={s.rowLabel}>{t('settings.notifications.weather.label')}</Text>
                <Text style={s.rowDesc}>{t('settings.notifications.weather.desc')}</Text>
              </View>
            </View>
            <Switch value={weatherNotifs} onValueChange={handleWeatherNotifs} trackColor={{ false: theme.colors.border, true: theme.colors.primarySoft }} thumbColor={weatherNotifs ? theme.colors.primary : theme.colors.textMuted} />
          </View>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>{t('settings.sections.price')}</Text>

            <View style={s.row}>
            <View style={s.rowLeft}>
              <Ionicons name="cash-outline" size={20} color={theme.colors.text} />
              <View>
                <Text style={s.rowLabel}>{t('settings.price.currency.label')}</Text>
                <Text style={s.rowDesc}>{t('settings.price.currency.desc')}</Text>
              </View>
            </View>
            <View style={s.currencyChip}>
              <Text style={s.currencyChipText} allowFontScaling={false}>EUR</Text>
            </View>
          </View>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>{t('settings.sections.appearance')}</Text>

          <View style={s.segmentedControl}>
            {(['light', 'system', 'dark'] as ThemeMode[]).map(m => {
              const active = mode === m;
              const icons: Record<ThemeMode, string> = { light: 'sunny', system: 'invert-mode', dark: 'moon' };
              const labels: Record<ThemeMode, string> = {
                light: t('settings.appearance.light'),
                system: t('settings.appearance.system'),
                dark: t('settings.appearance.dark'),
              };
              return (
                <Pressable
                  key={m}
                  style={[s.segment, active && s.segmentActive]}
                  onPress={() => handleThemeChange(m)}
                >
                  <Ionicons name={icons[m] as never} size={16} color={active ? theme.colors.primary : theme.colors.textMuted} />
                  <Text style={[s.segmentLabel, active && s.segmentLabelActive]}>{labels[m]}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>{t('settings.sections.language')}</Text>

          <Pressable style={s.row} onPress={() => setLangSheet(true)}>
            <View style={s.rowLeft}>
              <Ionicons name="language-outline" size={20} color={theme.colors.text} />
              <View>
                <Text style={s.rowLabel}>{t('settings.language.row')}</Text>
                <Text style={s.rowDesc}>{langDescription}</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={16} color={theme.colors.textMuted} />
          </Pressable>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>{t('settings.sections.search')}</Text>

          <View style={s.row}>
            <View style={s.rowLeft}>
              <Ionicons name="mic-outline" size={20} color={theme.colors.text} />
              <View>
                <Text style={s.rowLabel}>{t('settings.search.voice.label')}</Text>
                <Text style={s.rowDesc}>{t('settings.search.voice.desc')}</Text>
              </View>
            </View>
            <Switch value={voiceEnabled} onValueChange={setVoiceEnabled} trackColor={{ false: theme.colors.border, true: theme.colors.primarySoft }} thumbColor={voiceEnabled ? theme.colors.primary : theme.colors.textMuted} />
          </View>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>{t('settings.sections.account')}</Text>

          <Pressable style={s.row} onPress={() => { logout().catch(() => {}); router.replace('/auth/login'); }}>
            <View style={s.rowLeft}>
              <Ionicons name="log-out-outline" size={20} color={theme.colors.overpriced} />
              <Text style={[s.rowLabel, { color: theme.colors.overpriced }]}>{t('settings.account.logout')}</Text>
            </View>
          </Pressable>

          <Pressable style={s.row} onPress={() => router.push('/delete-account')}>
            <View style={s.rowLeft}>
              <Ionicons name="trash-outline" size={20} color={theme.colors.overpriced} />
              <Text style={[s.rowLabel, { color: theme.colors.overpriced }]}>{t('settings.account.delete')}</Text>
            </View>
          </Pressable>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>{t('settings.sections.support')}</Text>

          <View style={s.donateCard}>
            <Ionicons name="share-social-outline" size={28} color={theme.colors.primary} />
            <Text style={s.donateText}>
              {t('settings.support.text')}
            </Text>
            <Pressable style={s.shareBtn} onPress={handleShareApp}>
              <Text style={s.shareBtnText}>{t('settings.support.share')}</Text>
            </Pressable>
          </View>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>{t('settings.sections.legal')}</Text>

          <Pressable style={s.row} onPress={() => router.push('/privacy-center')}>
            <View style={s.rowLeft}>
              <Ionicons name="shield-checkmark-outline" size={20} color={theme.colors.text} />
              <Text style={s.rowLabel}>{t('settings.legal.privacyCenter')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={theme.colors.textMuted} />
          </Pressable>

          <Pressable style={s.row} onPress={() => router.push('/legal')}>
            <View style={s.rowLeft}>
              <Ionicons name="document-text-outline" size={20} color={theme.colors.text} />
              <Text style={s.rowLabel}>{t('settings.legal.mentions')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={theme.colors.textMuted} />
          </Pressable>

          <Pressable style={s.row} onPress={() => router.push('/privacy')}>
            <View style={s.rowLeft}>
              <Ionicons name="shield-outline" size={20} color={theme.colors.text} />
              <Text style={s.rowLabel}>{t('settings.legal.privacy')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={theme.colors.textMuted} />
          </Pressable>
        </View>

        <Pressable onPress={handleVersionTap}>
          <Text style={s.version}>Sillage v{Constants.expoConfig?.version ?? '1.0.0'}{Constants.nativeBuildVersion ? ` (${Constants.nativeBuildVersion})` : ''}</Text>
        </Pressable>
      </ScrollView>

      <PermissionPrimer
        visible={pushPrimer.visible}
        copy={PERMISSION_PRIMERS.push}
        onAccept={handlePushPrimerAccept}
        onDecline={handlePushPrimerDecline}
      />

      <PermissionPrimer
        visible={locationPrimer.visible}
        copy={PERMISSION_PRIMERS.location}
        onAccept={handleLocationPrimerAccept}
        onDecline={handleLocationPrimerDecline}
      />

      <ActionSheet
        visible={langSheet}
        title={t('settings.language.sheetTitle')}
        actions={languageActions}
        onClose={closeLangSheet}
      />
    </SafeAreaView>
  );
}

function getStyles(t: Theme) {
  return {
    container: { flex: 1, backgroundColor: t.colors.background },
    scroll: { paddingBottom: 88 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, marginBottom: 8 },
    backBtn: { width: 32, height: 32, justifyContent: 'center', alignItems: 'center' },
    title: { fontFamily: 'PlayfairDisplay_700Bold', fontSize: 22, color: t.colors.text },
    section: { marginBottom: 24, paddingHorizontal: 16 },
    sectionTitle: { fontFamily: 'Inter_400Regular', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.5, color: t.colors.textMuted, marginBottom: 12 },
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.colors.border },
    rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
    rowLabel: { fontFamily: 'Inter_500Medium', fontSize: 15, color: t.colors.text },
    rowDesc: { fontFamily: 'Inter_400Regular', fontSize: 12, color: t.colors.textMuted, marginTop: 2 },
    version: { textAlign: 'center', fontFamily: 'Inter_400Regular', fontSize: 12, color: t.colors.textMuted, marginTop: 16 },
    donateCard: { backgroundColor: t.colors.surface, borderRadius: t.radius.card, padding: 20, alignItems: 'center', gap: 12 },
    donateText: { fontFamily: 'Inter_400Regular', fontSize: 14, color: t.colors.textMuted, textAlign: 'center', lineHeight: 20 },
    shareBtn: { backgroundColor: t.colors.primarySoft, paddingHorizontal: 24, paddingVertical: 12, borderRadius: t.radius.base },
    shareBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: t.colors.primaryInk },
    currencyChip: { backgroundColor: t.colors.surface2, borderRadius: t.radius.full, paddingHorizontal: 10, paddingVertical: 4 },
    currencyChipText: { fontFamily: 'Inter_600SemiBold', fontSize: 12, color: t.colors.textMuted },
    segmentedControl: { flexDirection: 'row', backgroundColor: t.colors.surface2, borderRadius: t.radius.base, padding: 4 },
    segment: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: t.radius.sm },
    segmentActive: { backgroundColor: t.colors.primarySoft },
    segmentLabel: { fontFamily: 'Inter_500Medium', fontSize: 13, color: t.colors.textMuted },
    segmentLabelActive: { color: t.colors.primary, fontFamily: 'Inter_700Bold' },
  } as const;
}
