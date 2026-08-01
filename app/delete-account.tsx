// app/delete-account.tsx — Écran de suppression de compte (RGPD)
import { useState, useMemo, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Ionicons from '@react-native-vector-icons/ionicons/static';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthContext } from '../src/contexts/AuthContext';
import { useTheme, type Theme } from '../src/theme/ThemeContext';
import { deleteAccount, reauthenticate } from '../src/services/account';
import AuthGate from '../src/components/AuthGate';

type ScreenState = 'overview' | 'confirm' | 'reauth' | 'deleting' | 'error';

export default function DeleteAccountPage() {
  const { theme, resolvedMode } = useTheme();
  const s = useMemo(() => getStyles(theme), [theme]);
  const keyboardAppearance = resolvedMode === 'dark' ? 'dark' : 'light';
  const router = useRouter();
  const { user, isAuthenticated } = useAuthContext();

  const [screen, setScreen] = useState<ScreenState>('overview');
  const [confirmed, setConfirmed] = useState(false);
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const hasPasswordProvider = user?.providers?.some(p => p === 'password' || p === 'email') ?? false;

  const handleInitiateDelete = useCallback(async () => {
    setErrorMessage(null);
    setScreen('deleting');
    try {
      try { await deleteAccount(); } catch (e: unknown) {
        if ((e as Error).message === 'REAUTH_REQUIRED') {
          setScreen('reauth');
          return;
        }
        throw e;
      }
      await GoogleSignin.signOut().catch(() => {});
      await AsyncStorage.removeItem('@sillage/recent-searches').catch(() => {});
      router.replace('/auth/login');
    } catch (e: unknown) {
      setErrorMessage((e as Error).message || 'Échec de la suppression.');
      setScreen('error');
    }
  }, [router]);

  const handleReauth = useCallback(async () => {
    setErrorMessage(null);
    try {
      await reauthenticate(hasPasswordProvider ? (password || undefined) : undefined);
      await handleInitiateDelete();
    } catch (e: unknown) {
      const msg = (e as Error).message;
      if (msg === 'AUTH_CANCELLED') {
        setScreen('confirm');
        return;
      }
      setErrorMessage(msg || 'Réauthentification échouée.');
    }
  }, [password, hasPasswordProvider, handleInitiateDelete]);

  const handleReset = useCallback(() => { setScreen('overview'); setConfirmed(false); setErrorMessage(null); setPassword(''); }, []);

  const isDeleting = screen === 'deleting';

  if (!isAuthenticated) {
    return (
      <SafeAreaView edges={['top', 'bottom']} style={s.container}>
        <AuthGate icon="trash-outline" description="Connecte-toi pour gérer la suppression de ton compte." />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top', 'bottom']} style={s.container}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <View style={s.header}>
          <Pressable onPress={() => isDeleting ? null : router.back()} hitSlop={12} style={s.backBtn} disabled={isDeleting} accessibilityLabel="Retour">
            <Ionicons name="arrow-back" size={22} color={isDeleting ? theme.colors.textMuted : theme.colors.text} />
          </Pressable>
          <Text style={s.title}>Supprimer le compte</Text>
          <View style={{ width: 32 }} />
        </View>

        {screen === 'overview' && (
          <View style={s.section}>
            <View style={s.iconCircle}>
              <Ionicons name="warning-outline" size={40} color={theme.colors.overpriced} />
            </View>
            <Text style={s.heading}>Action irréversible</Text>
            <View style={s.list}>
              <Text style={s.listItem}>Votre compte et votre moyen de connexion</Text>
              <Text style={s.listItem}>Vos favoris ({'{'}parfums likés{'}'})</Text>
              <Text style={s.listItem}>Votre parfumerie, vos étagères et votre parfum du jour</Text>
              <Text style={s.listItem}>L'historique de vos scans</Text>
              <Text style={s.listItem}>Vos alertes prix</Text>
              <Text style={s.listItem}>Vos préférences et tokens de notification</Text>
            </View>
            <Text style={s.body}>
              Conformément au RGPD, l'effacement est immédiat, complet et sans délai de rétractation.{'\n\n'}
              Vous devrez recréer un compte si vous souhaitez réutiliser l'application avec ses fonctionnalités connectées.
            </Text>
            <Pressable style={s.continueBtn} onPress={() => setScreen('confirm')}>
              <Text style={s.continueBtnText}>Continuer</Text>
            </Pressable>
          </View>
        )}

        {screen === 'confirm' && (
          <View style={s.section}>
            <Pressable
              style={s.checkRow}
              onPress={() => setConfirmed(v => !v)}
              hitSlop={8}
              accessibilityRole="checkbox"
            >
              <Ionicons
                name={confirmed ? 'checkbox' : 'square-outline'}
                size={22}
                color={confirmed ? theme.colors.overpriced : theme.colors.textMuted}
              />
              <Text style={s.checkLabel}>Je comprends que cette action est définitive et irréversible</Text>
            </Pressable>
            <Pressable
              style={[s.deleteBtn, !confirmed && s.deleteBtnDisabled]}
              onPress={handleInitiateDelete}
              disabled={!confirmed}
            >
              <Text style={s.deleteBtnText}>Supprimer définitivement</Text>
            </Pressable>
            <Pressable style={s.cancelBtn} onPress={() => setScreen('overview')}>
              <Text style={s.cancelBtnText}>Annuler</Text>
            </Pressable>
          </View>
        )}

        {screen === 'reauth' && (
          <View style={s.section}>
            <Text style={s.reauthTitle}>Confirmez votre identité</Text>
            <Text style={s.reauthDesc}>
              Par sécurité, {hasPasswordProvider ? 'saisissez votre mot de passe' : 'reconnectez-vous avec Google'} avant de supprimer votre compte.
            </Text>
            {hasPasswordProvider ? (
              <>
                <View style={s.inputGroup}>
                  <TextInput
                    style={s.input}
                    placeholder="Mot de passe"
                    placeholderTextColor={theme.colors.textMuted}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    autoComplete="current-password"
                    textContentType="password"
                    keyboardAppearance={keyboardAppearance}
                    accessibilityLabel="Mot de passe"
                  />
                  <Pressable onPress={() => setShowPassword(v => !v)} style={s.eyeBtn} hitSlop={8}>
                    <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={theme.colors.textMuted} />
                  </Pressable>
                </View>
                <Pressable style={s.primaryBtn} onPress={handleReauth}>
                  <Text style={s.primaryBtnText}>Confirmer mon identité</Text>
                </Pressable>
              </>
            ) : (
              <Pressable style={s.primaryBtn} onPress={handleReauth}>
                <Ionicons name="logo-google" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                <Text style={s.primaryBtnText}>Reconfirmer avec Google</Text>
              </Pressable>
            )}
            <Pressable style={s.cancelBtn} onPress={() => { setScreen('confirm'); setErrorMessage(null); }}>
              <Text style={s.cancelBtnText}>Annuler</Text>
            </Pressable>
          </View>
        )}

        {screen === 'deleting' && (
          <View style={s.centered}>
            <ActivityIndicator size="large" color={theme.colors.overpriced} />
            <Text style={s.deletingText}>Suppression en cours…</Text>
            <Text style={s.deletingSub}>Veuillez ne pas quitter l'application</Text>
          </View>
        )}

        {screen === 'error' && (
          <View style={s.section}>
            <View style={s.errorBox}>
              <Text style={s.errorText}>{errorMessage}</Text>
            </View>
            <Pressable style={s.primaryBtn} onPress={handleInitiateDelete}>
              <Text style={s.primaryBtnText}>Réessayer</Text>
            </Pressable>
            <Pressable style={s.cancelBtn} onPress={handleReset}>
              <Text style={s.cancelBtnText}>Annuler</Text>
            </Pressable>
          </View>
        )}
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
    section: { paddingHorizontal: 24, alignItems: 'center' as const },
    iconCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: t.colors.overpricedSoft, justifyContent: 'center', alignItems: 'center', alignSelf: 'center' as const, marginBottom: 20 },
    heading: { fontFamily: 'PlayfairDisplay_700Bold', fontSize: 24, color: t.colors.text, textAlign: 'center' as const, marginBottom: 20 },
    list: { alignSelf: 'stretch' as const, marginBottom: 16 },
    listItem: { fontFamily: 'Inter_400Regular', fontSize: 14, color: t.colors.text, lineHeight: 24, paddingLeft: 8 },
    body: { fontFamily: 'Inter_400Regular', fontSize: 14, color: t.colors.textMuted, lineHeight: 22, textAlign: 'center' as const, marginBottom: 24 },
    continueBtn: { borderWidth: 1.5, borderColor: t.colors.overpriced, borderRadius: t.radius.base, paddingHorizontal: 32, paddingVertical: 14, minWidth: 220, alignItems: 'center' as const },
    continueBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 16, color: t.colors.overpriced },
    checkRow: { flexDirection: 'row', alignItems: 'center', gap: 12, alignSelf: 'stretch' as const, marginBottom: 24, marginTop: 16 },
    checkLabel: { fontFamily: 'Inter_400Regular', fontSize: 14, color: t.colors.text, flex: 1, lineHeight: 20 },
    deleteBtn: { backgroundColor: t.colors.overpriced, borderRadius: t.radius.base, paddingHorizontal: 32, paddingVertical: 14, minWidth: 220, alignItems: 'center' as const, marginBottom: 12, ...t.shadow.button },
    deleteBtnDisabled: { opacity: 0.5 },
    deleteBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 16, color: '#FFFFFF' },
    cancelBtn: { paddingVertical: 12 },
    cancelBtnText: { fontFamily: 'Inter_500Medium', fontSize: 14, color: t.colors.textMuted },
    reauthTitle: { fontFamily: 'PlayfairDisplay_600SemiBold', fontSize: 18, color: t.colors.text, marginBottom: 8 },
    reauthDesc: { fontFamily: 'Inter_400Regular', fontSize: 14, color: t.colors.textMuted, textAlign: 'center' as const, lineHeight: 20, marginBottom: 20 },
    inputGroup: { alignSelf: 'stretch' as const, marginBottom: 16 },
    input: { borderRadius: t.radius.base, backgroundColor: t.colors.surface, borderWidth: 1, borderColor: t.colors.border, paddingHorizontal: 12, height: 48, fontFamily: 'Inter_400Regular', fontSize: 15, color: t.colors.text },
    eyeBtn: { position: 'absolute', right: 12, top: 0, bottom: 0, justifyContent: 'center' as const },
    primaryBtn: { backgroundColor: t.colors.primary, borderRadius: t.radius.base, flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const, paddingHorizontal: 32, paddingVertical: 14, minWidth: 220, marginBottom: 12, ...t.shadow.button },
    primaryBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 16, color: '#FFFFFF' },
    centered: { alignItems: 'center' as const, paddingTop: 60 },
    deletingText: { fontFamily: 'Inter_500Medium', fontSize: 16, color: t.colors.text, marginTop: 20 },
    deletingSub: { fontFamily: 'Inter_400Regular', fontSize: 13, color: t.colors.textMuted, marginTop: 6 },
    errorBox: { backgroundColor: t.colors.overpricedSoft, borderRadius: 10, padding: 14, alignSelf: 'stretch' as const, marginBottom: 20 },
    errorText: { fontFamily: 'Inter_400Regular', fontSize: 14, color: t.colors.overpricedInk, textAlign: 'center' as const },
  } as const;
}
