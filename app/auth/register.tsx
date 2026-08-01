// app/auth/register.tsx — Inscription (email + Google)

import { useState, useMemo, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, Pressable, ActivityIndicator,
  KeyboardAvoidingView, Platform, ScrollView, Keyboard,
} from 'react-native';
import { Link } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@react-native-vector-icons/ionicons/static';
import { useAuthContext } from '../../src/contexts/AuthContext';
import { useTheme, type Theme } from '../../src/theme/ThemeContext';
import { textOn } from '../../src/utils/contrast';
import { translateSupabaseError } from '../../src/utils/error-translator';

const EMAIL_RE = /^\S+@\S+\.\S+$/;

export default function RegisterPage() {
  const { theme, resolvedMode } = useTheme();
  const s = useMemo(() => getStyles(theme), [theme]);
  const keyboardAppearance = resolvedMode === 'dark' ? 'dark' : 'light';
  const insets = useSafeAreaInsets();
  const { register, loginWithGoogle } = useAuthContext();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState<'email' | 'google' | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const passwordRef = useRef<TextInput>(null);

  const canSubmit = email.trim().length > 0 && password.length >= 6 && ageConfirmed;

  const handleEmailRegister = useCallback(async () => {
    if (!canSubmit) return;
    if (!EMAIL_RE.test(email.trim())) { setErrorMessage('Adresse email invalide.'); return; }
    Keyboard.dismiss();
    setLoading('email'); setErrorMessage(null);
    try { await register(email.trim(), password); }
    catch (e: unknown) {
      const code = (e as { code?: string }).code;
      if (code === 'auth/cancelled') return;
      setErrorMessage(translateSupabaseError(e) || "Erreur lors de l'inscription.");
    }
    finally { setLoading(null); }
  }, [canSubmit, email, password, register]);

  const handleGoogle = useCallback(async () => {
    Keyboard.dismiss();
    setLoading('google'); setErrorMessage(null);
    try { await loginWithGoogle(); }
    catch (e: unknown) {
      const code = (e as { code?: string }).code;
      if (code === 'auth/cancelled') return;
      setErrorMessage(translateSupabaseError(e) || 'Erreur connexion Google.');
    }
    finally { setLoading(null); }
  }, [loginWithGoogle]);

  const onEmailChange = useCallback((v: string) => { setEmail(v); if (errorMessage) setErrorMessage(null); }, [errorMessage]);
  const onPasswordChange = useCallback((v: string) => { setPassword(v); if (errorMessage) setErrorMessage(null); }, [errorMessage]);

  const togglePassword = useCallback(() => setShowPassword(v => !v), []);
  const isLoading = loading !== null;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.bg}>
      <ScrollView
        contentContainerStyle={[s.scroll, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={s.form}>
          <View style={s.iconCircle}>
            <Ionicons name="person-add-outline" size={36} color={theme.colors.primary} />
          </View>
          <View style={s.header}>
            <Text style={s.title}>Créer un compte</Text>
            <Text style={s.subtitle}>Rejoins la communauté Sillage</Text>
          </View>

          <Pressable
            style={[s.googleBtn, isLoading && s.submitBtnDisabled]}
            onPress={handleGoogle}
            disabled={isLoading}
            accessibilityRole="button"
          >
            {loading === 'google' ? (
              <ActivityIndicator size="small" color={theme.colors.text} style={{ marginRight: 8 }} />
            ) : (
              <Ionicons name="logo-google" size={20} color={theme.colors.text} style={{ marginRight: 8 }} />
            )}
            <Text style={s.googleText}>S'inscrire avec Google</Text>
          </Pressable>

          <View style={s.divider}>
            <View style={s.dividerLine} />
            <Text style={s.dividerText}>ou par email</Text>
            <View style={s.dividerLine} />
          </View>

          <View style={s.inputGroup}>
            <TextInput
              style={s.input}
              placeholder="votre@email.com"
              placeholderTextColor={theme.colors.textMuted}
              value={email}
              onChangeText={onEmailChange}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              spellCheck={false}
              autoComplete="email"
              textContentType="emailAddress"
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
              blurOnSubmit={false}
              keyboardAppearance={keyboardAppearance}
              accessibilityLabel="Adresse email"
            />
          </View>
          <View style={s.inputGroup}>
            <TextInput
              ref={passwordRef}
              style={[s.input, { paddingRight: 40 }]}
              placeholder="6 caractères minimum"
              placeholderTextColor={theme.colors.textMuted}
              value={password}
              onChangeText={onPasswordChange}
              secureTextEntry={!showPassword}
              autoComplete="new-password"
              textContentType="newPassword"
              returnKeyType="done"
              onSubmitEditing={handleEmailRegister}
              keyboardAppearance={keyboardAppearance}
              accessibilityLabel="Mot de passe"
            />
            <Pressable
              onPress={togglePassword}
              style={s.eyeBtn}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
            >
              <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={theme.colors.textMuted} />
            </Pressable>
          </View>

          {errorMessage ? (
            <View style={s.errorBox}>
              <Text style={s.errorText}>{errorMessage}</Text>
            </View>
          ) : null}

          <Pressable style={s.checkRow} onPress={() => setAgeConfirmed(v => !v)} hitSlop={{ top: 11, bottom: 11, left: 11, right: 11 }} accessibilityRole="checkbox">
            <Ionicons name={ageConfirmed ? 'checkbox' : 'square-outline'} size={22} color={ageConfirmed ? theme.colors.primary : theme.colors.textMuted} />
            <Text style={s.checkLabel}>Je certifie avoir 15 ans ou plus</Text>
          </Pressable>

          <Text style={s.ageNote}>Sillage n'est pas destiné aux moins de 15 ans.</Text>

          <Pressable
            style={[s.submitBtn, (!canSubmit || isLoading) && s.submitBtnDisabled]}
            onPress={handleEmailRegister}
            disabled={!canSubmit || isLoading}
            accessibilityRole="button"
          >
            {loading === 'email' ? (
              <ActivityIndicator size="small" color={textOn(theme.colors.primary)} />
            ) : (
              <Text style={s.submitText}>Créer mon compte</Text>
            )}
          </Pressable>

          <Link href="/auth/login" style={s.link}>
            <Text style={s.linkText}>
              Déjà un compte ? <Text style={s.linkBold}>Se connecter</Text>
            </Text>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function getStyles(t: Theme) {
  return {
    bg: { flex: 1, backgroundColor: t.colors.background },
    scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24 },
    form: { maxWidth: 400, alignSelf: 'center', width: '100%', paddingVertical: 24, paddingHorizontal: 4 },
    iconCircle: { width: 72, height: 72, borderRadius: 36, backgroundColor: t.colors.primarySoft, justifyContent: 'center', alignItems: 'center', alignSelf: 'center', marginBottom: 12 },
    header: { alignItems: 'center', marginBottom: 28 },
    title: { fontFamily: 'PlayfairDisplay_700Bold', fontSize: 32, color: t.colors.text, letterSpacing: -0.5 },
    subtitle: { fontFamily: 'Inter_400Regular', fontSize: 15, color: t.colors.textMuted, marginTop: 4 },
    googleBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: t.colors.border, borderRadius: t.radius.base, height: 48, marginBottom: 20 },
    googleText: { fontFamily: 'Inter_500Medium', fontSize: 15, color: t.colors.text },
    divider: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
    dividerLine: { flex: 1, height: 1, backgroundColor: t.colors.border },
    dividerText: { paddingHorizontal: 16, fontFamily: 'Inter_400Regular', fontSize: 13, color: t.colors.textMuted },
    inputGroup: { marginBottom: 12 },
    input: { borderRadius: t.radius.base, backgroundColor: t.colors.surface, borderWidth: 1, borderColor: t.colors.border, paddingHorizontal: 12, height: 48, fontFamily: 'Inter_400Regular', fontSize: 15, color: t.colors.text },
    eyeBtn: { position: 'absolute', right: 12, top: 0, bottom: 0, justifyContent: 'center' },
    errorBox: { backgroundColor: t.colors.overpricedSoft, borderRadius: 10, padding: 10, marginTop: -4, marginBottom: 8 },
    errorText: { fontFamily: 'Inter_400Regular', fontSize: 13, color: t.colors.overpricedInk },
    submitBtn: { backgroundColor: t.colors.primary, borderRadius: t.radius.base, height: 48, justifyContent: 'center', alignItems: 'center', marginTop: 12, ...t.shadow.button },
    submitBtnDisabled: { opacity: 0.5 },
    submitText: { color: textOn(t.colors.primary), fontFamily: 'Inter_600SemiBold', fontSize: 16, letterSpacing: 0.3 },
    link: { alignSelf: 'center', marginTop: 24 },
    linkText: { fontFamily: 'Inter_400Regular', fontSize: 14, color: t.colors.textMuted },
    linkBold: { fontFamily: 'Inter_600SemiBold', color: t.colors.primary },
    checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
    checkLabel: { fontFamily: 'Inter_400Regular', fontSize: 13, color: t.colors.text, flex: 1 },
    ageNote: { fontFamily: 'Inter_400Regular', fontSize: 11, color: t.colors.textMuted, marginBottom: 8 },
  } as const;
}
