// app/u/[pseudo]/shelf/[shelfId].tsx — Étagère publique d'un membre (lecture seule)
// Cible du deep link parfumscan://u/<pseudo>/shelf/<shelfId> et du partage d'étagère.
// Accessible sans authentification (RPC publiques filtrées sur les deux is_public).

import { useMemo, useCallback, useState, useEffect, useRef } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import Ionicons from '@react-native-vector-icons/ionicons/static';
import { useTheme, type Theme } from '../../../../src/theme/ThemeContext';
import { useAuthContext } from '../../../../src/contexts/AuthContext';
import { useUserParfumContext } from '../../../../src/contexts/UserParfumContext';
import { useMyProfile } from '../../../../src/hooks/useMyProfile';
import { setPendingParfum } from '../../../../src/services/catalog-bridge';
import { getPublicShelf, getPublicShelfItems } from '../../../../src/services/profile';
import { hapticsSuccess, hapticsError } from '../../../../src/services/haptics';
import ShelfCard, { type ShelfCardItem } from '../../../../src/features/wardrobe/ShelfCard';
import InspireShelfSheet from '../../../../src/components/InspireShelfSheet';
import { inspireMissing } from '../../../../src/utils/shelf-grouping';
import type { PublicShelf, PublicShelfItem, Parfum } from '../../../../src/models';

function publicItemToCard(item: PublicShelfItem): Parfum {
  return {
    id: item.parfumId,
    nom: item.nom ?? '',
    marque: item.marque ?? '',
    imageUrl: item.imageUrl ?? undefined,
    familleOlactive: item.familleOlactive ?? '',
    bestPrice: item.bestPrice,
  } as Parfum;
}

export default function PublicShelfPage() {
  const searchParams = useLocalSearchParams<{ pseudo: string; shelfId: string }>();
  const pseudo = Array.isArray(searchParams.pseudo) ? searchParams.pseudo[0] : searchParams.pseudo;
  const shelfId = Array.isArray(searchParams.shelfId) ? searchParams.shelfId[0] : searchParams.shelfId;
  const { theme } = useTheme();
  const s = useMemo(() => getStyles(theme), [theme]);
  const router = useRouter();
  const mountedRef = useRef(true);

  const [shelf, setShelf] = useState<PublicShelf | null>(null);
  const [items, setItems] = useState<PublicShelfItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [imgFailed, setImgFailed] = useState(false);
  const [inspireOpen, setInspireOpen] = useState(false);
  const [inspiredDone, setInspiredDone] = useState(false);

  const { isAuthenticated, user } = useAuthContext();
  const { items: myItems, add } = useUserParfumContext();
  const { profile: myProfile } = useMyProfile(user?.uid ?? null);
  const isOwnProfile = !!myProfile?.pseudo && myProfile.pseudo === pseudo;

  const myParfumIds = useMemo(() => new Set(myItems.map(i => i.parfumId)), [myItems]);
  const missing = useMemo(() => inspireMissing(items, myParfumIds), [items, myParfumIds]);

  const handleOpenInspire = useCallback(() => setInspireOpen(true), []);
  const handleCloseInspire = useCallback(() => setInspireOpen(false), []);
  const handleConfirmInspire = useCallback(async (): Promise<number> => {
    const results = await Promise.allSettled(
      missing.map(it => add(it.parfumId, 'to_try', publicItemToCard(it)))
    );
    const ok = results.filter(r => r.status === 'fulfilled').length;
    if (ok > 0) { hapticsSuccess(); setInspiredDone(true); } else { hapticsError(); }
    return ok;
  }, [missing, add]);
  const handleLogin = useCallback(() => router.push('/auth/login'), [router]);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (!pseudo || !shelfId) { setLoading(false); return; }
    setLoading(true);
    Promise.all([getPublicShelf(pseudo, shelfId), getPublicShelfItems(pseudo, shelfId)])
      .then(([sh, it]) => {
        if (!mountedRef.current) return;
        setShelf(sh);
        setItems(it);
      })
      .catch(() => {})
      .finally(() => { if (mountedRef.current) setLoading(false); });
  }, [pseudo, shelfId]);

  const handleBack = useCallback(() => { router.back(); }, [router]);
  const handleOpenProfile = useCallback(() => { if (pseudo) router.push(`/u/${pseudo}`); }, [pseudo, router]);

  const handleBottle = useCallback((it: ShelfCardItem) => {
    const full = items.find((c) => c.parfumId === it.parfumId);
    if (!full) return;
    setPendingParfum(publicItemToCard(full));
    router.push(`/catalog/${it.parfumId}`);
  }, [items, router]);

  const inspireButton = isOwnProfile ? null : !isAuthenticated ? (
    <Pressable style={s.inspireBtnOutline} onPress={handleLogin} accessibilityRole="button" accessibilityLabel="Se connecter pour s’inspirer de cette étagère">
      <Ionicons name="log-in-outline" size={18} color={theme.colors.primary} />
      <Text style={s.inspireBtnOutlineText} allowFontScaling={false}>Se connecter pour s’inspirer</Text>
    </Pressable>
  ) : (
    <Pressable
      style={[s.inspireBtn, (inspiredDone || missing.length === 0) && s.inspireBtnDisabled]}
      onPress={(inspiredDone || missing.length === 0) ? undefined : handleOpenInspire}
      disabled={inspiredDone || missing.length === 0}
      accessibilityRole="button"
      accessibilityLabel={(inspiredDone || missing.length === 0) ? 'Déjà dans ta parfumerie' : `S’inspirer de cette étagère, ${missing.length} parfums`}
    >
      <Ionicons
        name={(inspiredDone || missing.length === 0) ? 'checkmark-circle-outline' : 'sparkles-outline'}
        size={18}
        color={(inspiredDone || missing.length === 0) ? theme.colors.textMuted : '#FFFFFF'}
      />
      <Text
        style={[s.inspireBtnText, (inspiredDone || missing.length === 0) && s.inspireBtnTextDisabled]}
        allowFontScaling={false}
      >
        {(inspiredDone || missing.length === 0) ? 'Déjà dans ta parfumerie' : `S’inspirer de cette étagère (${missing.length})`}
      </Text>
    </Pressable>
  );

  const headerTitle = shelf?.name ?? 'Étagère';
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

  if (!shelf) {
    return (
      <SafeAreaView edges={['top', 'bottom']} style={s.container}>
        {header}
        <View style={s.stateWrap}>
          <View style={s.stateIcon}>
            <Ionicons name="lock-closed-outline" size={28} color={theme.colors.textMuted} />
          </View>
          <Text style={s.stateTitle}>Étagère privée ou introuvable</Text>
          <Text style={s.stateDesc}>Ce membre n’a pas partagé cette étagère, ou elle n’existe plus.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const initial = (shelf.pseudo || 'P').charAt(0).toUpperCase();

  return (
    <SafeAreaView edges={['top', 'bottom']} style={s.container}>
      {header}
      <View style={s.content}>
        <View style={s.identity}>
          <Pressable onPress={handleOpenProfile} style={s.authorRow} accessibilityRole="button" accessibilityLabel={`Voir le profil de ${shelf.pseudo}`}>
            {shelf.avatarUrl && !imgFailed ? (
              <Image source={{ uri: shelf.avatarUrl }} style={s.avatar} contentFit="cover" transition={200} onError={() => setImgFailed(true)} />
            ) : (
              <View style={s.avatarPlaceholder}>
                <Text allowFontScaling={false} style={s.avatarInitial}>{initial}</Text>
              </View>
            )}
            <View style={s.authorTexts}>
              <Text style={s.pseudo} numberOfLines={1}>@{shelf.pseudo}</Text>
              {shelf.bio ? <Text style={s.bio} numberOfLines={2}>{shelf.bio}</Text> : null}
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
          </Pressable>
        </View>

        {inspireButton ? <View style={s.inspireWrap}>{inspireButton}</View> : null}

        <ShelfCard
          name={shelf.name}
          icon={shelf.icon}
          accent={shelf.color}
          tagline={shelf.description}
          items={items}
          variant="system"
          expanded
          showSort={false}
          onToggleExpand={() => undefined}
          onPressBottle={handleBottle}
        />
      </View>

      <InspireShelfSheet
        visible={inspireOpen}
        shelfName={shelf.name}
        ownerPseudo={shelf.pseudo}
        items={missing}
        onClose={handleCloseInspire}
        onConfirm={handleConfirmInspire}
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

    content: { paddingHorizontal: 16, paddingBottom: 40 },
    identity: { marginBottom: 12 },
    authorRow: {
      flexDirection: 'row' as const, alignItems: 'center' as const, gap: 12,
      backgroundColor: t.colors.surface, borderRadius: t.radius.card, padding: 12, ...t.shadow.card,
    },
    avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: t.colors.surface2 },
    avatarPlaceholder: {
      width: 44, height: 44, borderRadius: 22, backgroundColor: t.colors.primarySoft,
      justifyContent: 'center' as const, alignItems: 'center' as const,
    },
    avatarInitial: { fontFamily: 'Inter_700Bold', fontSize: 18, color: t.colors.primaryInk },
    authorTexts: { flex: 1, gap: 2 },
    pseudo: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: t.colors.text },
    bio: { fontFamily: 'Inter_400Regular', fontSize: 12, color: t.colors.textMuted, lineHeight: 17 },

    inspireWrap: { marginBottom: 12 },
    inspireBtn: {
      flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const, gap: 8,
      backgroundColor: t.colors.primary, borderRadius: t.radius.base, paddingVertical: 13, minHeight: 48,
      ...t.shadow.button,
    },
    inspireBtnDisabled: {
      backgroundColor: t.colors.surface2, shadowColor: 'transparent', shadowOpacity: 0, elevation: 0,
      borderWidth: 1, borderColor: t.colors.border,
    },
    inspireBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: '#FFFFFF' },
    inspireBtnTextDisabled: { color: t.colors.textMuted },
    inspireBtnOutline: {
      flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const, gap: 8,
      backgroundColor: 'transparent', borderWidth: 1.5, borderColor: t.colors.primary,
      borderRadius: t.radius.base, paddingVertical: 13, minHeight: 48,
    },
    inspireBtnOutlineText: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: t.colors.primary },
  } as const;
}
