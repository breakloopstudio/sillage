// app/u/[pseudo].tsx — Profil public d'un membre (lecture seule)
// Cible du deep link parfumscan://u/<pseudo> et du partage de collection.
// Accessible sans authentification (données publiques uniquement).

import { useMemo, useCallback, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import Ionicons from '@react-native-vector-icons/ionicons/static';
import { useTheme, type Theme } from '../../src/theme/ThemeContext';
import { usePublicProfile } from '../../src/hooks/usePublicProfile';
import { setPendingParfum } from '../../src/services/catalog-bridge';
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
  const { profile, collection, loading } = usePublicProfile(pseudo ?? null);
  const [imgFailed, setImgFailed] = useState(false);

  const handleBack = useCallback(() => { router.back(); }, [router]);

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
            <Ionicons name="lock-closed-outline" size={28} color={theme.colors.textMuted} />
          </View>
          <Text style={s.stateTitle}>Profil privé ou introuvable</Text>
          <Text style={s.stateDesc}>Ce membre n&#8217;existe pas ou a choisi de garder sa collection privée.</Text>
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
        <Text style={s.count} allowFontScaling={false}>
          {profile.collectionCount} parfum{profile.collectionCount > 1 ? 's' : ''}
        </Text>
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
    count: { fontFamily: 'Inter_500Medium', fontSize: 12, color: t.colors.textMuted, marginTop: 8 },

    content: { paddingHorizontal: 16, paddingBottom: 40 },
    row: { gap: 8, marginBottom: 8 },
    gridItem: { flex: 1 },
    emptyWrap: { alignItems: 'center' as const, paddingVertical: 24 },
    emptyText: { fontFamily: 'Inter_400Regular', fontSize: 14, color: t.colors.textMuted },
  } as const;
}
