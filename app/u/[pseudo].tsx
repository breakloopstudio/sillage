// app/u/[pseudo].tsx — Profil public d'un membre (lecture seule)
// Cible du deep link parfumscan://u/<pseudo> et du partage de collection.
// Accessible sans authentification (données publiques uniquement).

import { useMemo, useCallback, useState, useEffect, useRef } from 'react';
import { View, Text, Pressable, ActivityIndicator, FlatList, Modal, ScrollView } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import Ionicons from '@react-native-vector-icons/ionicons/static';
import { useTheme, type Theme } from '../../src/theme/ThemeContext';
import { useAuthContext } from '../../src/contexts/AuthContext';
import { usePublicProfile } from '../../src/hooks/usePublicProfile';
import { useMyProfile } from '../../src/hooks/useMyProfile';
import { setPendingParfum } from '../../src/services/catalog-bridge';
import { followByPseudo, unfollowByPseudo, isFollowing, getPublicFollowers, getPublicFollowing, type FollowEntry } from '../../src/services/community';
import { hapticsLight, hapticsSuccess } from '../../src/services/haptics';
import ParfumCard from '../../src/components/ParfumCard';
import type { PublicCollectionItem, Parfum } from '../../src/models';

function publicItemToCard(item: PublicCollectionItem): Parfum {
  return {
    id: item.parfumId,
    nom: item.nom ?? '',
    marque: item.marque ?? '',
    imageUrl: item.imageUrl ?? undefined,
    familleOlactive: item.familleOlactive ?? '',
    bestPrice: item.bestPrice,
  } as Parfum;
}

export default function PublicProfilePage() {
  const { pseudo } = useLocalSearchParams<{ pseudo: string }>();
  const { theme } = useTheme();
  const s = useMemo(() => getStyles(theme), [theme]);
  const router = useRouter();
  const { isAuthenticated, user } = useAuthContext();
  const { profile, collection, loading, error } = usePublicProfile(pseudo ?? null);
  const { profile: myProfile } = useMyProfile(user?.uid ?? null);
  const isOwnProfile = !!myProfile?.pseudo && myProfile.pseudo === pseudo;
  const [imgFailed, setImgFailed] = useState(false);
  const [following, setFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [followList, setFollowList] = useState<FollowEntry[] | null>(null);
  const [followListTitle, setFollowListTitle] = useState('');
  const mountedRef = useRef(true);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (!pseudo || !isAuthenticated) return;
    isFollowing(pseudo).then((v) => { if (mountedRef.current) setFollowing(v); });
  }, [pseudo, isAuthenticated]);

  const handleBack = useCallback(() => { router.back(); }, [router]);

  const handleShowFollowers = useCallback(async () => {
    if (!pseudo) return;
    hapticsLight();
    const list = await getPublicFollowers(pseudo);
    if (mountedRef.current) { setFollowList(list); setFollowListTitle('Abonnés'); }
  }, [pseudo]);

  const handleShowFollowing = useCallback(async () => {
    if (!pseudo) return;
    hapticsLight();
    const list = await getPublicFollowing(pseudo);
    if (mountedRef.current) { setFollowList(list); setFollowListTitle('Suivis'); }
  }, [pseudo]);

  const handleFollow = useCallback(async () => {
    if (!pseudo) return;
    hapticsLight();
    setFollowLoading(true);
    try {
      if (following) {
        await unfollowByPseudo(pseudo);
        setFollowing(false);
      } else {
        await followByPseudo(pseudo);
        setFollowing(true);
        hapticsSuccess();
      }
    } catch (e: unknown) {
      console.warn('[u/pseudo] follow failed:', (e as Error)?.message ?? String(e));
    } finally {
      if (mountedRef.current) setFollowLoading(false);
    }
  }, [pseudo, following]);

  const handleCardPress = useCallback((item: PublicCollectionItem) => {
    setPendingParfum(publicItemToCard(item));
    router.push(`/catalog/${item.parfumId}`);
  }, [router]);

  const renderItem = useCallback(({ item }: { item: PublicCollectionItem }) => (
    <View style={s.gridItem}>
      <ParfumCard
        parfum={publicItemToCard(item)}
        mode="comfortable"
        status={item.status}
        rating={item.rating}
        onPressOverride={() => handleCardPress(item)}
      />
    </View>
  ), [handleCardPress, s]);

  const headerTitle = profile?.pseudo ? `@${profile.pseudo}` : 'Profil';
  const header = (
    <View style={s.header}>
      <Pressable onPress={handleBack} hitSlop={12} style={s.backBtn} accessibilityRole="button" accessibilityLabel="Retour">
        <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
      </Pressable>
      <Text style={s.title} numberOfLines={1}>{headerTitle}</Text>
      <View style={s.backBtn} />
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView edges={['top', 'bottom']} style={s.container}>
        {header}
        <ActivityIndicator style={s.loading} color={theme.colors.primary} />
      </SafeAreaView>
    );
  }

  if (!profile) {
    return (
      <SafeAreaView edges={['top', 'bottom']} style={s.container}>
        {header}
        <View style={s.stateWrap}>
          <View style={s.stateIcon}>
            <Ionicons name={error ? 'cloud-offline-outline' : 'lock-closed-outline'} size={28} color={theme.colors.textMuted} />
          </View>
          <Text style={s.stateTitle}>{error ? 'Erreur de connexion' : 'Profil privé ou introuvable'}</Text>
          <Text style={s.stateDesc}>
            {error
              ? 'Vérifie ta connexion et réessaie.'
              : 'Ce membre n\u2019existe pas ou a choisi de garder sa collection privée.'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const initial = (profile.pseudo || 'P').charAt(0).toUpperCase();

  const profileHeader = (
    <View>
      <View style={s.identity}>
        {profile.avatarUrl && !imgFailed ? (
          <Image source={{ uri: profile.avatarUrl }} style={s.avatar} contentFit="cover" transition={200} onError={() => setImgFailed(true)} />
        ) : (
          <View style={s.avatarPlaceholder}>
            <Text allowFontScaling={false} style={s.avatarInitial}>{initial}</Text>
          </View>
        )}
        <Text style={s.pseudo}>@{profile.pseudo}</Text>
        {profile.bio ? <Text style={s.bio}>{profile.bio}</Text> : null}
        <View style={s.statsRow}>
          <Text style={s.statItem} allowFontScaling={false}>
            {profile.collectionCount} parfum{profile.collectionCount > 1 ? 's' : ''}
          </Text>
          <Text style={s.statDot}>·</Text>
          <Pressable onPress={handleShowFollowers} hitSlop={{ top: 6, bottom: 6 }} accessibilityRole="button" accessibilityLabel={`${profile.followerCount} abonnés`}>
            <Text style={s.statItemLink} allowFontScaling={false}>{profile.followerCount} abonné{profile.followerCount > 1 ? 's' : ''}</Text>
          </Pressable>
          <Text style={s.statDot}>·</Text>
          <Pressable onPress={handleShowFollowing} hitSlop={{ top: 6, bottom: 6 }} accessibilityRole="button" accessibilityLabel={`${profile.followingCount} suivis`}>
            <Text style={s.statItemLink} allowFontScaling={false}>{profile.followingCount} suivi{profile.followingCount > 1 ? 's' : ''}</Text>
          </Pressable>
        </View>
        {isAuthenticated && !isOwnProfile ? (
          <Pressable
            style={[s.followBtn, following && s.followBtnActive]}
            onPress={handleFollow}
            disabled={followLoading}
            accessibilityRole="button"
            accessibilityLabel={following ? 'Ne plus suivre' : 'Suivre'}
          >
            {followLoading ? (
              <ActivityIndicator size="small" color={following ? theme.colors.primary : '#FFFFFF'} />
            ) : (
              <Text style={[s.followBtnText, following && s.followBtnTextActive]} allowFontScaling={false}>
                {following ? 'Suivi' : 'Suivre'}
              </Text>
            )}
          </Pressable>
        ) : null}
      </View>
      {collection.length === 0 ? (
        <View style={s.emptyWrap}>
          <Text style={s.emptyText}>Aucun parfum public pour l&#8217;instant.</Text>
        </View>
      ) : null}
    </View>
  );

  return (
    <SafeAreaView edges={['top', 'bottom']} style={s.container}>
      {header}
      <FlatList
        data={collection}
        keyExtractor={item => item.parfumId}
        renderItem={renderItem}
        numColumns={2}
        columnWrapperStyle={s.row}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={profileHeader}
      />
      <Modal visible={followList !== null} transparent animationType="fade" onRequestClose={() => setFollowList(null)}>
        <Pressable style={s.followListBackdrop} onPress={() => setFollowList(null)} />
        <View style={[s.followListSheet, { paddingBottom: insets.bottom + 12 }]}>
          <View style={s.followListHandle} />
          <Text style={s.followListTitle}>{followListTitle}</Text>
          <ScrollView style={s.followListScroll} showsVerticalScrollIndicator={false}>
            {(followList ?? []).length === 0 ? (
              <Text style={s.followListEmpty}>Personne pour l&#8217;instant.</Text>
            ) : (
              (followList ?? []).map((entry, i) => (
                <Pressable key={`${entry.pseudo}-${i}`} style={s.followListRow} onPress={() => { setFollowList(null); router.push(`/u/${entry.pseudo}`); }} accessibilityRole="button">
                  {entry.avatar_url ? (
                    <Image source={{ uri: entry.avatar_url }} style={s.followListAvatar} contentFit="cover" transition={200} />
                  ) : (
                    <View style={[s.followListAvatar, s.followListAvatarPlaceholder]}>
                      <Text allowFontScaling={false} style={s.followListInitial}>{entry.pseudo.charAt(0).toUpperCase()}</Text>
                    </View>
                  )}
                  <Text style={s.followListPseudo}>@{entry.pseudo}</Text>
                </Pressable>
              ))
            )}
          </ScrollView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function getStyles(t: Theme) {
  return {
    container: { flex: 1, backgroundColor: t.colors.background },
    header: {
      flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const,
      paddingHorizontal: 16, paddingVertical: 12,
    },
    backBtn: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center' as const, alignItems: 'center' as const },
    title: { fontFamily: 'PlayfairDisplay_700Bold', fontSize: 20, color: t.colors.text, flex: 1, textAlign: 'center' as const },
    loading: { marginTop: 40 },

    stateWrap: { flex: 1, alignItems: 'center' as const, justifyContent: 'center' as const, paddingHorizontal: 32, paddingBottom: 40 },
    stateIcon: {
      width: 72, height: 72, borderRadius: 36, backgroundColor: t.colors.surface2,
      justifyContent: 'center' as const, alignItems: 'center' as const, marginBottom: 16,
    },
    stateTitle: { fontFamily: 'PlayfairDisplay_700Bold', fontSize: 20, color: t.colors.text, textAlign: 'center' as const, marginBottom: 8 },
    stateDesc: { fontFamily: 'Inter_400Regular', fontSize: 14, color: t.colors.textMuted, textAlign: 'center' as const, lineHeight: 21, maxWidth: 300 },

    identity: { alignItems: 'center' as const, paddingTop: 8, paddingBottom: 20 },
    avatar: { width: 88, height: 88, borderRadius: 44, backgroundColor: t.colors.surface2 },
    avatarPlaceholder: {
      width: 88, height: 88, borderRadius: 44, backgroundColor: t.colors.primarySoft,
      justifyContent: 'center' as const, alignItems: 'center' as const,
    },
    avatarInitial: { fontFamily: 'Inter_700Bold', fontSize: 34, color: t.colors.primaryInk },
    pseudo: { fontFamily: 'PlayfairDisplay_700Bold', fontSize: 22, color: t.colors.text, marginTop: 12 },
    bio: { fontFamily: 'Inter_400Regular', fontSize: 14, color: t.colors.textMuted, textAlign: 'center' as const, marginTop: 4, paddingHorizontal: 32 },
    statsRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6, marginTop: 8 },
    statItem: { fontFamily: 'Inter_400Regular', fontSize: 12, color: t.colors.textMuted },
    statDot: { fontFamily: 'Inter_400Regular', fontSize: 12, color: t.colors.border },
    followBtn: {
      marginTop: 14, paddingHorizontal: 28, paddingVertical: 10, minHeight: 44,
      borderRadius: 22, backgroundColor: t.colors.primary, justifyContent: 'center' as const, alignItems: 'center' as const,
    },
    followBtnActive: { backgroundColor: t.colors.surface, borderWidth: 1, borderColor: t.colors.border },
    followBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: '#FFFFFF' },
    followBtnTextActive: { color: t.colors.text },

    content: { paddingHorizontal: 16, paddingBottom: 40 },
    row: { gap: 8, marginBottom: 8 },
    gridItem: { flex: 1, maxWidth: '50%' },
    emptyWrap: { alignItems: 'center' as const, paddingVertical: 24 },
    emptyText: { fontFamily: 'Inter_400Regular', fontSize: 14, color: t.colors.textMuted },

    statItemLink: { fontFamily: 'Inter_500Medium', fontSize: 12, color: t.colors.primary },

    followListBackdrop: { position: 'absolute' as const, top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)' },
    followListSheet: { position: 'absolute' as const, bottom: 0, left: 0, right: 0, backgroundColor: t.colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '60%' },
    followListHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: t.colors.textMuted, opacity: 0.4, alignSelf: 'center' as const, marginTop: 8, marginBottom: 12 },
    followListTitle: { fontFamily: 'PlayfairDisplay_600SemiBold', fontSize: 18, color: t.colors.text, paddingHorizontal: 20, marginBottom: 12 },
    followListScroll: { paddingHorizontal: 20 },
    followListEmpty: { fontFamily: 'Inter_400Regular', fontSize: 14, color: t.colors.textMuted, paddingVertical: 16 },
    followListRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 12, paddingVertical: 10 },
    followListAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: t.colors.surface2 },
    followListAvatarPlaceholder: { justifyContent: 'center' as const, alignItems: 'center' as const, backgroundColor: t.colors.primarySoft },
    followListInitial: { fontFamily: 'Inter_700Bold', fontSize: 14, color: t.colors.primaryInk },
    followListPseudo: { fontFamily: 'Inter_500Medium', fontSize: 14, color: t.colors.text },
  } as const;
}
