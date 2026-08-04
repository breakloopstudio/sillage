// app/profile.tsx — Page Profil (route racine, poussée depuis l'avatar du DockBar)

import { useState, useMemo, useCallback, Fragment } from 'react';
import { View, Text, Pressable, ActivityIndicator, StyleSheet, ScrollView, KeyboardAvoidingView } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Ionicons from '@react-native-vector-icons/ionicons/static';
import { useTranslation } from 'react-i18next';
import i18next from 'i18next';
import { useAuthContext } from '../src/contexts/AuthContext';
import { useTheme, type Theme } from '../src/theme/ThemeContext';
import { useSotd } from '../src/hooks/useSotd';
import { useProfileStats } from '../src/hooks/useProfileStats';
import { STATUS_CHIPS, chipForStatus, type StatusChipId } from '../src/utils/status-chips';
import AuthGate from '../src/components/AuthGate';
import PublicProfileCard from '../src/components/PublicProfileCard';
import { normalizePseudo } from '../src/utils/share';

// Labels résolus à l'affichage via getters i18next (§23).
const NAV_ROWS = [
  { key: 'parfumerie', icon: 'flask-outline', get label() { return i18next.t('profile.navParfumerie'); }, route: '/(tabs)/collection' },
  { key: 'scans', icon: 'time-outline', get label() { return i18next.t('profile.navScans'); }, route: '/history' },
] as const;

const STAT_DEFS = [
  { key: 'favoris', get label() { return i18next.t('profile.statFavoris'); }, get a11y() { return i18next.t('profile.statFavorisA11y'); }, route: '/(tabs)/favoris' },
  { key: 'parfumerie', get label() { return i18next.t('profile.statParfumerie'); }, get a11y() { return i18next.t('profile.statParfumerieA11y'); }, route: '/(tabs)/collection' },
  { key: 'scans', get label() { return i18next.t('profile.statScans'); }, get a11y() { return i18next.t('profile.statScansA11y'); }, route: '/history' },
] as const;

export default function ProfilePage() {
  const { theme } = useTheme();
  const s = useMemo(() => getStyles(theme), [theme]);
  const { t } = useTranslation('common');
  const { user, authReady, isAuthenticated, logout } = useAuthContext();
  const router = useRouter();
  const uid = user?.uid ?? null;

  const { favorisCount, wardrobeItems: items, scansCount, loading: dataLoading } = useProfileStats(uid);
  const { sotd } = useSotd(uid);

  const [imgFailed, setImgFailed] = useState(false);

  const chipCounts = useMemo(() => {
    const counts: Record<StatusChipId, number> = { to_try: 0, have: 0, had: 0 };
    for (const item of items) counts[chipForStatus(item.status) ?? 'to_try'] += 1;
    return counts;
  }, [items]);

  const chipColorMap = useMemo(() => ({
    to_try: { bg: theme.colors.fairSoft, color: theme.colors.fairInk },
    have: { bg: theme.colors.dealSoft, color: theme.colors.dealInk },
    had: { bg: theme.colors.surface2, color: theme.colors.textMuted },
  } as const), [theme]);

  const navCounts = useMemo(() => ({
    parfumerie: items.length,
    scans: scansCount ?? 0,
  }), [items.length, scansCount]);

  const statValues = useMemo(() => ({
    favoris: dataLoading || favorisCount === null ? null : favorisCount,
    parfumerie: dataLoading ? null : items.length,
    scans: dataLoading ? null : scansCount,
  }), [dataLoading, favorisCount, items.length, scansCount]);

  const handleLogout = useCallback(() => {
    logout().catch(() => {});
    router.replace('/auth/login');
  }, [logout, router]);

  const handleSotdPress = useCallback(() => {
    if (sotd) router.push(`/catalog/${sotd.parfumId}`);
  }, [sotd, router]);

  const handleStatPress = useCallback((route: (typeof STAT_DEFS)[number]['route']) => {
    router.push(route);
  }, [router]);

  if (!authReady) {
    return (
      <View style={s.spinnerFull}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (!isAuthenticated || !user) {
    return (
      <SafeAreaView edges={['top', 'bottom']} style={s.container}>
        <View style={s.header}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={s.backBtn} accessibilityRole="button" accessibilityLabel={t('back')}>
            <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
          </Pressable>
          <Text style={s.title}>{t('profile.title')}</Text>
          <View style={s.backBtn} />
        </View>
        <AuthGate
          icon="person-outline"
          description={t('profile.authGate')}
        />
      </SafeAreaView>
    );
  }

  const displayName = user.displayName ?? user.email?.split('@')[0] ?? t('profile.fallbackName');
  const email = user.email ?? '';

  return (
    <SafeAreaView edges={['top', 'bottom']} style={s.container}>
      <KeyboardAvoidingView behavior="padding" style={s.kav}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={s.header}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={s.backBtn} accessibilityRole="button" accessibilityLabel={t('back')}>
            <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
          </Pressable>
          <Text style={s.title}>{t('profile.title')}</Text>
          <Pressable onPress={() => router.push('/settings')} hitSlop={4} style={s.settingsBtn} accessibilityRole="button" accessibilityLabel={t('profile.openSettingsA11y')}>
            <Ionicons name="settings-outline" size={20} color={theme.colors.textMuted} />
          </Pressable>
        </View>

        <View style={s.identityWrap}>
          {user.photoURL && !imgFailed ? (
            <Image source={{ uri: user.photoURL }} style={s.avatar} contentFit="cover" transition={200} onError={() => setImgFailed(true)} />
          ) : (
            <View style={s.avatarPlaceholder}>
              <Text allowFontScaling={false} style={s.avatarInitial}>{email.charAt(0).toUpperCase()}</Text>
            </View>
          )}
          <Text style={s.displayName}>{displayName}</Text>
          {email.length > 0 ? <Text style={s.email}>{email}</Text> : null}
        </View>

        <View style={s.statsCard}>
          <View style={s.statsRow}>
            {STAT_DEFS.map((def, i) => {
              const value = statValues[def.key as keyof typeof statValues];
              const isLast = i === STAT_DEFS.length - 1;
              return (
                <Fragment key={def.key}>
                  <Pressable
                    style={s.statCol}
                    onPress={() => handleStatPress(def.route)}
                    accessibilityRole="button"
                    accessibilityLabel={value === null ? def.a11y : `${def.a11y}, ${value}`}
                  >
                    <Text allowFontScaling={false} style={s.statNum}>{value === null ? '—' : value}</Text>
                    <Text allowFontScaling={false} style={s.statLabel}>{def.label}</Text>
                  </Pressable>
                  {!isLast ? <View style={s.statSep} /> : null}
                </Fragment>
              );
            })}
          </View>

          {items.length > 0 ? (
            <>
              <View style={s.statDivider} />
              <View style={s.ownershipWrap}>
                {STATUS_CHIPS.map(chip => {
                  const count = chipCounts[chip.id];
                  if (!count) return null;
                  const colors = chipColorMap[chip.id];
                  return (
                    <View key={chip.id} style={[s.ownershipChip, { backgroundColor: colors.bg }]}>
                      <Text allowFontScaling={false} style={[s.ownershipChipText, { color: colors.color }]}>
                        {chip.label}{'\u00A0'}·{'\u00A0'}{count}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </>
          ) : null}
        </View>

        {sotd ? (
          <Pressable style={s.sotdCard} onPress={handleSotdPress}>
            <View style={s.sotdImgWrap}>
              {sotd.imageUrl ? (
                <Image source={{ uri: sotd.imageUrl }} style={s.sotdImg} contentFit="contain" transition={200} />
              ) : (
                <Ionicons name="flask-outline" size={22} color={theme.colors.textMuted} />
              )}
            </View>
            <View style={s.sotdBody}>
              <Text allowFontScaling={false} style={s.sotdLabel}>{t('profile.sotdLabel')}</Text>
              <Text style={s.sotdName} numberOfLines={1} ellipsizeMode="tail">{sotd.nom}{'\u00A0'}·{'\u00A0'}{sotd.marque}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
          </Pressable>
        ) : items.length > 0 ? (
          <Pressable style={s.sotdCard} onPress={() => router.push('/(tabs)/collection')}>
            <View style={s.sotdImgWrap}>
              <Ionicons name="sunny-outline" size={22} color={theme.colors.secondary} />
            </View>
            <View style={s.sotdBody}>
              <Text allowFontScaling={false} style={[s.sotdLabel, { color: theme.colors.secondary }]}>{t('profile.sotdLabel')}</Text>
              <Text style={s.sotdCta}>{t('profile.chooseSotd')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
          </Pressable>
        ) : null}

        <Text style={s.sectionTitle}>{t('profile.publicProfileSection')}</Text>
        <PublicProfileCard uid={user.uid} photoUrl={user.photoURL ?? null} defaultPseudo={normalizePseudo(displayName)} />

        <Text style={s.sectionTitle}>{t('profile.exploreSection')}</Text>

        <View style={s.navCard}>
          {NAV_ROWS.map((row, i) => {
            const count = navCounts[row.key as keyof typeof navCounts];
            const isLast = i === NAV_ROWS.length - 1;
            return (
              <Pressable key={row.key} style={[s.navRow, !isLast && s.navRowBorder]} onPress={() => router.push(row.route)}>
                <View style={s.navIconWrap}>
                  <Ionicons name={row.icon} size={18} color={theme.colors.primaryInk} />
                </View>
                <Text style={s.navLabel}>{row.label}</Text>
                {count !== undefined ? (
                  <Text allowFontScaling={false} style={s.navCount}>{dataLoading ? '—' : count}</Text>
                ) : null}
                <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
              </Pressable>
            );
          })}
        </View>

        <Pressable style={s.logoutRow} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color={theme.colors.overpriced} />
          <Text style={s.logoutText}>{t('profile.logout')}</Text>
        </Pressable>
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function getStyles(t: Theme) {
  return {
    container: { flex: 1, backgroundColor: t.colors.background },
    kav: { flex: 1 },
    scroll: { paddingBottom: 40 },
    spinnerFull: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: t.colors.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      marginBottom: 8,
    },
    backBtn: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
    title: { fontFamily: 'PlayfairDisplay_700Bold', fontSize: 22, color: t.colors.text },
    settingsBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: t.colors.surface2,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border,
      justifyContent: 'center',
      alignItems: 'center',
    },
    identityWrap: { alignItems: 'center', paddingTop: 8, paddingBottom: 20 },
    avatar: { width: 88, height: 88, borderRadius: 44, backgroundColor: t.colors.surface2 },
    avatarPlaceholder: {
      width: 88,
      height: 88,
      borderRadius: 44,
      backgroundColor: t.colors.primarySoft,
      justifyContent: 'center',
      alignItems: 'center',
    },
    avatarInitial: { fontFamily: 'Inter_700Bold', fontSize: 34, color: t.colors.primaryInk },
    displayName: { fontFamily: 'PlayfairDisplay_700Bold', fontSize: 22, color: t.colors.text, marginTop: 12 },
    email: { fontFamily: 'Inter_400Regular', fontSize: 14, color: t.colors.textMuted, marginTop: 2 },
    statsCard: { backgroundColor: t.colors.surface, borderRadius: t.radius.card, marginHorizontal: 16, ...t.shadow.card },
    statsRow: { flexDirection: 'row', alignItems: 'center' },
    statCol: { flex: 1, alignItems: 'center', paddingVertical: 20 },
    statNum: { fontFamily: 'Inter_700Bold', fontSize: 24, color: t.colors.text },
    statLabel: {
      fontFamily: 'Inter_500Medium',
      fontSize: 10,
      textTransform: 'uppercase',
      letterSpacing: 1,
      color: t.colors.textMuted,
      marginTop: 2,
    },
    statSep: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch', backgroundColor: t.colors.border, marginVertical: 4 },
    statDivider: { height: StyleSheet.hairlineWidth, backgroundColor: t.colors.border, marginHorizontal: 12 },
    ownershipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 12 },
    ownershipChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
    ownershipChipText: { fontFamily: 'Inter_500Medium', fontSize: 11 },
    sotdCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: t.colors.surface,
      borderRadius: t.radius.card,
      marginHorizontal: 16,
      marginTop: 12,
      paddingHorizontal: 12,
      paddingVertical: 12,
      gap: 12,
      ...t.shadow.card,
    },
    sotdImgWrap: {
      width: 44,
      height: 44,
      borderRadius: 8,
      backgroundColor: t.colors.surface2,
      justifyContent: 'center',
      alignItems: 'center',
    },
    sotdImg: { width: 44, height: 44, borderRadius: 8 },
    sotdBody: { flex: 1 },
    sotdLabel: {
      fontFamily: 'Inter_500Medium',
      fontSize: 10,
      textTransform: 'uppercase',
      letterSpacing: 1,
      color: t.colors.secondary,
      marginBottom: 2,
    },
    sotdName: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: t.colors.text },
    sotdCta: { fontFamily: 'Inter_400Regular', fontSize: 13, color: t.colors.textMuted },
    sectionTitle: {
      fontFamily: 'Inter_400Regular',
      fontSize: 11,
      textTransform: 'uppercase',
      letterSpacing: 1.5,
      color: t.colors.textMuted,
      marginHorizontal: 16,
      marginTop: 24,
      marginBottom: 8,
    },
    navCard: { backgroundColor: t.colors.surface, borderRadius: t.radius.card, marginHorizontal: 16, ...t.shadow.card },
    navRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 14, gap: 12 },
    navRowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.colors.border },
    navIconWrap: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: t.colors.primarySoft,
      justifyContent: 'center',
      alignItems: 'center',
    },
    navLabel: { flex: 1, fontFamily: 'Inter_600SemiBold', fontSize: 14, color: t.colors.text },
    navCount: { fontFamily: 'Inter_700Bold', fontSize: 14, color: t.colors.textMuted },
    logoutRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      marginHorizontal: 16,
      marginTop: 32,
      paddingVertical: 14,
      borderRadius: t.radius.base,
      borderWidth: 1,
      borderColor: t.colors.overpricedSoft,
    },
    logoutText: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: t.colors.overpriced },
  } as const;
}
