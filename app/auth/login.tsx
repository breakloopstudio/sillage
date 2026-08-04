// app/auth/login.tsx — Connexion (email + Google)

import { useState, useMemo, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, Pressable, ActivityIndicator,
  KeyboardAvoidingView, ScrollView, Keyboard,
} from 'react-native';
import { Link } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@react-native-vector-icons/ionicons/static';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../src/services/supabase';
import { useAuthContext } from '../../src/contexts/AuthContext';
import { useTheme, type Theme } from '../../src/theme/ThemeContext';
import { textOn } from '../../src/utils/contrast';
import { translateSupabaseError } from '../../src/utils/error-translator';

const EMAIL_RE = /^\S+@\S+\.\S+$/;

export default function LoginPage() {
  const { theme, resolvedMode } = useTheme();
  const s = useMemo(() => getStyles(theme), [theme]);
  const { t } = useTranslation('common');
  const keyboardAppearance = resolvedMode === 'dark' ? 'dark' : 'light';
  const insets = useSafeAreaInsets();
  const { login, loginWithGoogle } = useAuthContext();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState<'email' | 'google' | 'forgotPassword' | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const passwordRef = useRef<TextInput>(null);

  const canSubmit = email.trim().length > 0 && password.length > 0;

  const handleEmailLogin = useCallback(async () => {
    if (!canSubmit) return;
    if (!EMAIL_RE.test(email.trim())) { setErrorMessage(t('auth.invalidEmail')); return; }
    Keyboard.dismiss();
    setLoading('email'); setErrorMessage(null);
    try { await login(email.trim(), password); }
    catch (e: unknown) {
      const code = (e as { code?: string }).code;
      if (code === 'auth/cancelled') return;
      setErrorMessage(translateSupabaseError(e) || t('auth.loginError'));
    }
    finally { setLoading(null); }
  }, [canSubmit, email, password, login, t]);

  const handleGoogle = useCallback(async () => {
    Keyboard.dismiss();
    setLoading('google'); setErrorMessage(null);
    try { await loginWithGoogle(); }
    catch (e: unknown) {
      const code = (e as { code?: string }).code;
      if (code === 'auth/cancelled') return;
      setErrorMessage(translateSupabaseError(e) || t('auth.googleError'));
    }
    finally { setLoading(null); }
  }, [loginWithGoogle, t]);

  const handleForgotPassword = useCallback(async () => {
    const trimmed = email.trim();
    if (!EMAIL_RE.test(trimmed)) { setErrorMessage(t('auth.enterEmailFirst')); return; }
    Keyboard.dismiss();
    setLoading('forgotPassword'); setErrorMessage(null); setSuccessMessage(null);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(trimmed);
      if (error) throw error;
      setSuccessMessage(t('auth.resetEmailSent'));
    } catch (e: unknown) {
      const msg = translateSupabaseError(e);
      if (msg) setErrorMessage(msg);
    }
    finally { setLoading(null); }
  }, [email, t]);

  const onEmailChange = useCallback((v: string) => { setEmail(v); if (errorMessage) setErrorMessage(null); if (successMessage) setSuccessMessage(null); }, [errorMessage, successMessage]);
  const onPasswordChange = useCallback((v: string) => { setPassword(v); if (errorMessage) setErrorMessage(null); if (successMessage) setSuccessMessage(null); }, [errorMessage, successMessage]);

  const togglePassword = useCallback(() => setShowPassword(v => !v), []);
  const isLoading = loading !== null;

  return (
    <KeyboardAvoidingView behavior="padding" style={s.bg}>
      <ScrollView
        contentContainerStyle={[s.scroll, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={s.form}>
          <View style={s.iconCircle}>
            <Ionicons name="rose-outline" size={36} color={theme.colors.primary} />
          </View>
          <View style={s.header}>
            <Text style={s.title}>Sillage</Text>
            <Text style={s.subtitle}>{t('auth.loginSubtitle')}</Text>
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
            <Text style={s.googleText}>{t('auth.continueWithGoogle')}</Text>
          </Pressable>

          <View style={s.divider}>
            <View style={s.dividerLine} />
            <Text style={s.dividerText}>{t('auth.orByEmail')}</Text>
            <View style={s.dividerLine} />
          </View>

          <View style={s.inputGroup}>
            <TextInput
              style={s.input}
              placeholder={t('auth.emailPlaceholder')}
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
              accessibilityLabel={t('auth.emailLabel')}
            />
          </View>
          <View style={s.inputGroup}>
            <TextInput
              ref={passwordRef}
              style={[s.input, { paddingRight: 40 }]}
              placeholder={t('auth.passwordPlaceholder')}
              placeholderTextColor={theme.colors.textMuted}
              value={password}
              onChangeText={onPasswordChange}
              secureTextEntry={!showPassword}
              autoComplete="current-password"
              textContentType="password"
              returnKeyType="go"
              onSubmitEditing={handleEmailLogin}
              keyboardAppearance={keyboardAppearance}
              accessibilityLabel={t('auth.passwordLabel')}
            />
            <Pressable
              onPress={togglePassword}
              style={s.eyeBtn}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
            >
              <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={theme.colors.textMuted} />
            </Pressable>
          </View>

          <Pressable onPress={handleForgotPassword} style={s.forgotLink} disabled={isLoading}>
            <Text style={s.forgotText}>{t('auth.forgotPassword')}</Text>
          </Pressable>

          {errorMessage ? (
            <View style={s.errorBox}>
              <Text style={s.errorText}>{errorMessage}</Text>
            </View>
          ) : null}
          {successMessage ? (
            <View style={s.successBox}>
              <Text style={s.successText}>{successMessage}</Text>
            </View>
          ) : null}

          <Pressable
            style={[s.submitBtn, (!canSubmit || isLoading) && s.submitBtnDisabled]}
            onPress={handleEmailLogin}
            disabled={!canSubmit || isLoading}
            accessibilityRole="button"
          >
            {loading === 'email' ? (
              <ActivityIndicator size="small" color={textOn(theme.colors.primary)} />
            ) : (
              <Text style={s.submitText}>{t('auth.login')}</Text>
            )}
          </Pressable>

          <Link href="/auth/register" style={s.link}>
            <Text style={s.linkText}>
              {t('auth.noAccount')} <Text style={s.linkBold}>{t('auth.register')}</Text>
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
    scroll: { flexGrow: 1, paddingHorizontal: 24 },
    form: { maxWidth: 400, alignSelf: 'center', width: '100%', paddingVertical: 24, paddingHorizontal: 4, flexGrow: 1, justifyContent: 'center' },
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
    forgotLink: { alignSelf: 'flex-end', marginBottom: 4 },
    forgotText: { fontFamily: 'Inter_500Medium', fontSize: 13, color: t.colors.primary },
    errorBox: { backgroundColor: t.colors.overpricedSoft, borderRadius: 10, padding: 10, marginTop: -4, marginBottom: 8 },
    errorText: { fontFamily: 'Inter_400Regular', fontSize: 13, color: t.colors.overpricedInk },
    successBox: { backgroundColor: t.colors.dealSoft, borderRadius: 10, padding: 10, marginTop: -4, marginBottom: 8 },
    successText: { fontFamily: 'Inter_400Regular', fontSize: 13, color: t.colors.deal },
    submitBtn: { backgroundColor: t.colors.primary, borderRadius: t.radius.base, height: 48, justifyContent: 'center', alignItems: 'center', marginTop: 12, ...t.shadow.button },
    submitBtnDisabled: { opacity: 0.5 },
    submitText: { color: textOn(t.colors.primary), fontFamily: 'Inter_600SemiBold', fontSize: 16, letterSpacing: 0.3 },
    link: { alignSelf: 'center', marginTop: 24 },
    linkText: { fontFamily: 'Inter_400Regular', fontSize: 14, color: t.colors.textMuted },
    linkBold: { fontFamily: 'Inter_600SemiBold', color: t.colors.primary },
  } as const;
}
