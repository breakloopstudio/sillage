// app/privacy-center.tsx — Centre de consentement RGPD
import { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, ScrollView, Switch, Pressable, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Linking } from 'react-native';
import Ionicons from '@react-native-vector-icons/ionicons/static';
import { useAuthContext } from '../src/contexts/AuthContext';
import { useTheme, type Theme } from '../src/theme/ThemeContext';
import { useNetwork } from '../src/hooks/useNetwork';
import { getUserSettings, updateUserSetting } from '../src/services/user-data';
import { requestFcmPermission, deleteFcmToken } from '../src/services/push';
import { getAccountDataSummary, shareAccountData, deleteAllScans, deleteAllFcmTokens, deleteAllPriceAlerts, clearWeatherCoords, type AccountDataSummary } from '../src/services/account';

export default function PrivacyCenterPage() {
  const { theme } = useTheme();
  const s = useMemo(() => getStyles(theme), [theme]);
  const router = useRouter();
  const { user } = useAuthContext();
  const { isOnline } = useNetwork();
  const uid = user?.uid ?? '';

  const [summary, setSummary] = useState<AccountDataSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [priceAlerts, setPriceAlerts] = useState(false);
  const [pushNotifs, setPushNotifs] = useState(false);
  const [weatherNotifs, setWeatherNotifs] = useState(false);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!uid) return;
    getAccountDataSummary(uid).then(s => { setSummary(s); setSummaryLoading(false); }).catch(() => setSummaryLoading(false));
    getUserSettings(uid).then(s => {
      setPriceAlerts(s.priceAlerts);
      setPushNotifs(s.pushNotifs);
      setWeatherNotifs(s.weatherNotifs);
      setSettingsLoaded(true);
    }).catch(() => setSettingsLoaded(true));
  }, [uid]);

  const handlePushNotifs = useCallback(async (val: boolean) => {
    setPushNotifs(val);
    if (uid) updateUserSetting(uid, 'pushNotifs', val).catch(() => {});
    if (val) { requestFcmPermission().catch(() => {}); } else {
      deleteFcmToken().catch(() => {});
      if (uid) deleteAllFcmTokens(uid).catch(() => {});
    }
  }, [uid]);

  const handleWeatherNotifs = useCallback(async (val: boolean) => {
    setWeatherNotifs(val);
    if (uid) {
      updateUserSetting(uid, 'weatherNotifs', val).catch(() => {});
      if (!val) clearWeatherCoords(uid).catch(() => {});
    }
  }, [uid]);

  const handlePriceAlerts = useCallback(async (val: boolean) => {
    if (!uid) return;
    if (!val) {
      const currentCount = summary?.priceAlerts ?? 0;
      if (currentCount > 0) {
        Alert.alert('Désactiver les alertes prix ?', `${currentCount} alerte(s) active(s) seront supprimée(s).`, [
          { text: 'Annuler', style: 'cancel' },
          { text: 'Désactiver', style: 'destructive', onPress: async () => {
            setPriceAlerts(false);
            updateUserSetting(uid, 'priceAlerts', false).catch(() => {});
            deleteAllPriceAlerts(uid).catch(() => {});
          }},
        ]);
        return;
      }
    }
    setPriceAlerts(val);
    updateUserSetting(uid, 'priceAlerts', val).catch(() => {});
  }, [uid, summary?.priceAlerts]);

  const handleExport = useCallback(async () => {
    setExporting(true);
    try { await shareAccountData(); } catch (e: unknown) { Alert.alert('Erreur', (e as Error).message || "L'export a échoué."); }
    finally { setExporting(false); }
  }, []);

  const handleDeleteScans = useCallback(() => {
    const currentCount = summary?.scans ?? 0;
    if (currentCount === 0) return;
    Alert.alert('Vider l\'historique ?', `${currentCount} scan(s) seront supprimé(s). Cette action est irréversible.`, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: async () => {
        const deleted = await deleteAllScans(uid);
        Alert.alert('Historique vidé', `${deleted} scan(s) supprimé(s).`);
        if (uid) getAccountDataSummary(uid).then(setSummary).catch(() => {});
      }},
    ]);
  }, [uid, summary?.scans]);

  const countVal = (v: number | undefined) => summaryLoading ? '—' : String(v ?? 0);

  return (
    <SafeAreaView edges={['top', 'bottom']} style={s.container}>
      <ScrollView contentContainerStyle={s.scroll}>
        <View style={s.header}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={s.backBtn} accessibilityLabel="Retour">
            <Ionicons name="arrow-back" size={22} color={theme.colors.text} />
          </Pressable>
          <Text style={s.title}>Confidentialité</Text>
          <View style={{ width: 32 }} />
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>Mes données stockées</Text>
          {[
            { icon: 'heart-outline', label: 'Favoris', count: summary?.favoris },
            { icon: 'flask-outline', label: 'Parfumerie', count: summary?.wardrobe },
            { icon: 'scan-outline', label: 'Scans', count: summary?.scans },
            { icon: 'albums-outline', label: 'Étagères', count: summary?.shelves },
            { icon: 'notifications-outline', label: 'Alertes prix', count: summary?.priceAlerts },
            { icon: 'calendar-outline', label: 'Parfums du jour', count: summary?.sotdEntries },
          ].map((row, i) => (
            <View key={i} style={s.dataRow}>
              <View style={s.dataRowLeft}>
                <Ionicons name={row.icon as never} size={20} color={theme.colors.text} />
                <Text style={s.rowLabel}>{row.label}</Text>
              </View>
              <Text style={s.rowCount}>{countVal(row.count)}</Text>
            </View>
          ))}
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>Consentements</Text>
          <View style={s.row}>
            <View style={s.rowLeft}>
              <Ionicons name="push-outline" size={20} color={theme.colors.text} />
              <View>
                <Text style={s.rowLabel}>Notifications push</Text>
                <Text style={s.rowDesc}>Notifications désactivées et tokens supprimés à l'arrêt</Text>
              </View>
            </View>
            <Switch value={pushNotifs} onValueChange={handlePushNotifs} trackColor={{ false: theme.colors.border, true: theme.colors.primarySoft }} thumbColor={pushNotifs ? theme.colors.primary : theme.colors.textMuted} />
          </View>
          <View style={s.row}>
            <View style={s.rowLeft}>
              <Ionicons name="partly-sunny-outline" size={20} color={theme.colors.text} />
              <View>
                <Text style={s.rowLabel}>Suggestions météo</Text>
                <Text style={s.rowDesc}>Coordonnées GPS effacées à l'arrêt</Text>
              </View>
            </View>
            <Switch value={weatherNotifs} onValueChange={handleWeatherNotifs} trackColor={{ false: theme.colors.border, true: theme.colors.primarySoft }} thumbColor={weatherNotifs ? theme.colors.primary : theme.colors.textMuted} />
          </View>
          <View style={s.row}>
            <View style={s.rowLeft}>
              <Ionicons name="cash-outline" size={20} color={theme.colors.text} />
              <View>
                <Text style={s.rowLabel}>Alertes prix</Text>
                <Text style={s.rowDesc}>Alertes supprimées à l'arrêt</Text>
              </View>
            </View>
            <Switch value={priceAlerts} onValueChange={handlePriceAlerts} trackColor={{ false: theme.colors.border, true: theme.colors.primarySoft }} thumbColor={priceAlerts ? theme.colors.primary : theme.colors.textMuted} />
          </View>
          <View style={s.row}>
            <View style={s.rowLeft}>
              <Ionicons name="location-outline" size={20} color={theme.colors.text} />
              <View>
                <Text style={s.rowLabel}>Localisation</Text>
                <Text style={s.rowDesc}>Permet les suggestions météo</Text>
              </View>
            </View>
            <Pressable onPress={() => Linking.openSettings()} hitSlop={8}>
              <Text style={s.actionLink}>Réglages</Text>
            </Pressable>
          </View>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>Actions</Text>
          <Pressable style={s.actionRow} onPress={handleExport} disabled={exporting || !isOnline}>
            <View style={s.rowLeft}>
              <Ionicons name="download-outline" size={20} color={theme.colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={s.rowLabel}>Exporter mes données</Text>
                <Text style={s.rowDesc}>{isOnline ? 'Format JSON structuré, lisible par machine' : 'Connexion Internet requise'}</Text>
              </View>
            </View>
            {exporting ? <ActivityIndicator size="small" color={theme.colors.primary} /> : <Ionicons name="chevron-forward" size={16} color={theme.colors.textMuted} />}
          </Pressable>
          <Pressable style={s.actionRow} onPress={handleDeleteScans}>
            <View style={s.rowLeft}>
              <Ionicons name="trash-bin-outline" size={20} color={theme.colors.overpriced} />
              <View style={{ flex: 1 }}>
                <Text style={[s.rowLabel, { color: theme.colors.overpriced }]}>Vider l'historique des scans</Text>
                <Text style={s.rowDesc}>Supprime tous les scans sans supprimer le compte</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={16} color={theme.colors.textMuted} />
          </Pressable>
          <Pressable style={s.actionRow} onPress={() => router.push('/delete-account')}>
            <View style={s.rowLeft}>
              <Ionicons name="warning-outline" size={20} color={theme.colors.overpriced} />
              <View style={{ flex: 1 }}>
                <Text style={[s.rowLabel, { color: theme.colors.overpriced }]}>Supprimer mon compte</Text>
                <Text style={s.rowDesc}>Effacement complet et irréversible</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={16} color={theme.colors.textMuted} />
          </Pressable>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>Informations</Text>
          <Pressable style={s.actionRow} onPress={() => router.push('/legal')}>
            <View style={s.rowLeft}>
              <Ionicons name="document-text-outline" size={20} color={theme.colors.text} />
              <Text style={s.rowLabel}>Mentions légales</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={theme.colors.textMuted} />
          </Pressable>
          <Pressable style={s.actionRow} onPress={() => router.push('/privacy')}>
            <View style={s.rowLeft}>
              <Ionicons name="shield-outline" size={20} color={theme.colors.text} />
              <Text style={s.rowLabel}>Politique de confidentialité</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={theme.colors.textMuted} />
          </Pressable>
        </View>
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
    sectionTitle: { fontFamily: 'Inter_400Regular', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.5, color: t.colors.textMuted, marginBottom: 12 },
    dataRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: t.colors.border },
    dataRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    rowLabel: { fontFamily: 'Inter_500Medium', fontSize: 15, color: t.colors.text },
    rowCount: { fontFamily: 'Inter_700Bold', fontSize: 18, color: t.colors.text },
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: t.colors.border },
    rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
    rowDesc: { fontFamily: 'Inter_400Regular', fontSize: 12, color: t.colors.textMuted, marginTop: 2 },
    actionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: t.colors.border },
    actionLink: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: t.colors.primary },
  } as const;
}
