// app/settings.tsx — Page de paramètres

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { View, Text, ScrollView, Switch, Pressable, StyleSheet, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import Ionicons from '@react-native-vector-icons/ionicons/static';
import { useAuthContext } from '../src/contexts/AuthContext';
import { getUserSettings, updateUserSetting } from '../src/services/user-data';
import { requestFcmPermission, deleteFcmToken } from '../src/services/push';
import { APP_SHARE_MESSAGE } from '../src/config/legal';
import { hapticsLight } from '../src/services/haptics';
import { useTheme, type Theme } from '../src/theme/ThemeContext';
import { useVoicePreference } from '../src/hooks/useVoicePreference';
import type { ThemeMode } from '../src/services/theme-storage';

export default function SettingsPage() {
  const { user, logout } = useAuthContext();
  const router = useRouter();
  const { theme, mode, setMode } = useTheme();
  const s = useMemo(() => getStyles(theme), [theme]);
  const [priceAlerts, setPriceAlerts] = useState(false);
  const [pushNotifs, setPushNotifs] = useState(true);
  const [weatherNotifs, setWeatherNotifs] = useState(false);
  const { voiceEnabled, setVoiceEnabled } = useVoicePreference();

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
    try { await Share.share({ message: APP_SHARE_MESSAGE }); } catch { /* annulation */ }
  }, []);

  useEffect(() => {
    if (user?.uid) {
      getUserSettings(user.uid).then(s => {
        setPriceAlerts(s.priceAlerts);
        setPushNotifs(s.pushNotifs);
        setWeatherNotifs(s.weatherNotifs);
      }).catch(() => {});
    }
  }, [user?.uid]);

  const handlePushNotifs = useCallback(async (val: boolean) => {
    setPushNotifs(val);
    if (user?.uid) updateUserSetting(user.uid, 'pushNotifs', val).catch(() => {});
    if (val) {
      requestFcmPermission().catch(() => {});
    } else {
      deleteFcmToken().catch(() => {});
    }
  }, [user?.uid]);

  const handlePriceAlerts = useCallback(async (val: boolean) => {
    setPriceAlerts(val);
    if (user?.uid) updateUserSetting(user.uid, 'priceAlerts', val).catch(() => {});
  }, [user?.uid]);

  const handleWeatherNotifs = useCallback(async (val: boolean) => {
    setWeatherNotifs(val);
    if (user?.uid) updateUserSetting(user.uid, 'weatherNotifs', val).catch(() => {});
  }, [user?.uid]);

  return (
    <SafeAreaView edges={['top', 'bottom']} style={s.container}>
      <ScrollView contentContainerStyle={s.scroll}>
        <View style={s.header}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={s.backBtn} accessibilityLabel="Retour">
            <Ionicons name="arrow-back" size={22} color={theme.colors.text} />
          </Pressable>
          <Text style={s.title}>Paramètres</Text>
          <View style={{ width: 32 }} />
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>Notifications</Text>

          <View style={s.row}>
            <View style={s.rowLeft}>
              <Ionicons name="notifications-outline" size={20} color={theme.colors.text} />
              <View>
                <Text style={s.rowLabel}>Alertes prix</Text>
                <Text style={s.rowDesc}>Recevoir une notification quand un parfum de ta wishlist baisse de prix</Text>
              </View>
            </View>
            <Switch value={priceAlerts} onValueChange={handlePriceAlerts} trackColor={{ false: theme.colors.border, true: theme.colors.primarySoft }} thumbColor={priceAlerts ? theme.colors.primary : theme.colors.textMuted} />
          </View>

          <View style={s.row}>
            <View style={s.rowLeft}>
              <Ionicons name="push-outline" size={20} color={theme.colors.text} />
              <View>
                <Text style={s.rowLabel}>Notifications push</Text>
                <Text style={s.rowDesc}>Autoriser les notifications sur cet appareil</Text>
              </View>
            </View>
            <Switch value={pushNotifs} onValueChange={handlePushNotifs} trackColor={{ false: theme.colors.border, true: theme.colors.primarySoft }} thumbColor={pushNotifs ? theme.colors.primary : theme.colors.textMuted} />
          </View>

          <View style={s.row}>
            <View style={s.rowLeft}>
              <Ionicons name="partly-sunny-outline" size={20} color={theme.colors.text} />
              <View>
                <Text style={s.rowLabel}>Suggestions météo</Text>
                <Text style={s.rowDesc}>Recevoir chaque matin une suggestion de parfum adapté à la météo</Text>
              </View>
            </View>
            <Switch value={weatherNotifs} onValueChange={handleWeatherNotifs} trackColor={{ false: theme.colors.border, true: theme.colors.primarySoft }} thumbColor={weatherNotifs ? theme.colors.primary : theme.colors.textMuted} />
          </View>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>Prix</Text>

            <View style={s.row}>
            <View style={s.rowLeft}>
              <Ionicons name="cash-outline" size={20} color={theme.colors.text} />
              <View>
                <Text style={s.rowLabel}>Devise</Text>
                <Text style={s.rowDesc}>Euro — multi-devise en V2</Text>
              </View>
            </View>
            <View style={s.currencyChip}>
              <Text style={s.currencyChipText} allowFontScaling={false}>EUR</Text>
            </View>
          </View>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>Apparence</Text>

          <View style={s.segmentedControl}>
            {(['light', 'system', 'dark'] as ThemeMode[]).map(m => {
              const active = mode === m;
              const icons: Record<ThemeMode, string> = { light: 'sunny', system: 'invert-mode', dark: 'moon' };
              const labels: Record<ThemeMode, string> = { light: 'Clair', system: 'Système', dark: 'Sombre' };
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
          <Text style={s.sectionTitle}>Recherche</Text>

          <View style={s.row}>
            <View style={s.rowLeft}>
              <Ionicons name="mic-outline" size={20} color={theme.colors.text} />
              <View>
                <Text style={s.rowLabel}>Raccourci vocal</Text>
                <Text style={s.rowDesc}>Afficher le micro en bas de l'écran pour une recherche rapide à la voix</Text>
              </View>
            </View>
            <Switch value={voiceEnabled} onValueChange={setVoiceEnabled} trackColor={{ false: theme.colors.border, true: theme.colors.primarySoft }} thumbColor={voiceEnabled ? theme.colors.primary : theme.colors.textMuted} />
          </View>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>Compte</Text>

          <Pressable style={s.row} onPress={() => { logout().catch(() => {}); router.replace('/auth/login'); }}>
            <View style={s.rowLeft}>
              <Ionicons name="log-out-outline" size={20} color={theme.colors.overpriced} />
              <Text style={[s.rowLabel, { color: theme.colors.overpriced }]}>Déconnexion</Text>
            </View>
          </Pressable>

          <Pressable style={s.row} onPress={() => router.push('/delete-account')}>
            <View style={s.rowLeft}>
              <Ionicons name="trash-outline" size={20} color={theme.colors.overpriced} />
              <Text style={[s.rowLabel, { color: theme.colors.overpriced }]}>Supprimer le compte</Text>
            </View>
          </Pressable>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>Soutenir</Text>

          <View style={s.donateCard}>
            <Ionicons name="share-social-outline" size={28} color={theme.colors.primary} />
            <Text style={s.donateText}>
              Si l'app te plaît, partage-la autour de toi. C'est le meilleur soutien.
            </Text>
            <Pressable style={s.shareBtn} onPress={handleShareApp}>
              <Text style={s.shareBtnText}>Partager l'app</Text>
            </Pressable>
          </View>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>Légal</Text>

          <Pressable style={s.row} onPress={() => router.push('/privacy-center')}>
            <View style={s.rowLeft}>
              <Ionicons name="shield-checkmark-outline" size={20} color={theme.colors.text} />
              <Text style={s.rowLabel}>Confidentialité & données</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={theme.colors.textMuted} />
          </Pressable>

          <Pressable style={s.row} onPress={() => router.push('/legal')}>
            <View style={s.rowLeft}>
              <Ionicons name="document-text-outline" size={20} color={theme.colors.text} />
              <Text style={s.rowLabel}>Mentions légales</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={theme.colors.textMuted} />
          </Pressable>

          <Pressable style={s.row} onPress={() => router.push('/privacy')}>
            <View style={s.rowLeft}>
              <Ionicons name="shield-outline" size={20} color={theme.colors.text} />
              <Text style={s.rowLabel}>Politique de confidentialité</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={theme.colors.textMuted} />
          </Pressable>
        </View>

        <Pressable onPress={handleVersionTap}>
          <Text style={s.version}>Sillage v{Constants.expoConfig?.version ?? '1.0.0'}{Constants.nativeBuildVersion ? ` (${Constants.nativeBuildVersion})` : ''}</Text>
        </Pressable>
      </ScrollView>
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
