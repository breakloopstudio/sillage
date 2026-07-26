import { useState, useMemo, useCallback } from 'react';
import { View, Text, SectionList, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { useAnimatedScrollHandler, type SharedValue } from 'react-native-reanimated';
import { useRouter } from 'expo-router';

const AnimatedSectionList = Animated.createAnimatedComponent(SectionList) as unknown as typeof SectionList;
import { useAuthContext } from '../../contexts/AuthContext';
import { useScentList } from '../../hooks/useScentList';
import { getParfumById } from '../../services/firestore';
import { setPendingParfum } from '../../services/catalog-bridge';
import { moveFavori } from '../../services/user-data';
import { useTheme, type Theme } from '../../theme/ThemeContext';
import { hapticsSuccess, hapticsLight } from '../../services/haptics';
import EmptyState from '../../components/EmptyState';
import AuthGate from '../../components/AuthGate';
import ActionSheet, { type ActionItem } from '../../components/ActionSheet';
import WardrobeAddSheet from '../../features/wardrobe/WardrobeAddSheet';
import ScentCard from '../../features/scentlist/ScentCard';
import TrySheet from '../../features/scentlist/TrySheet';
import type { UserScentItem } from '../../models';
import type { WardrobeItem } from '../../models/wardrobe.interface';
import type { TrySheetSaveData } from '../../features/scentlist/TrySheet';

interface SectionData {
  title: string;
  data: UserScentItem[];
}

interface Props {
  scrollY?: SharedValue<number>;
}

export default function ScentListContent({ scrollY }: Props) {
  const { theme } = useTheme();
  const s = useMemo(() => getStyles(theme), [theme]);
  const router = useRouter();
  const { user, authReady, isAuthenticated } = useAuthContext();
  const uid = user?.uid ?? null;
  const { items, toTry, tried, loading, add, markTried, remove, moveToWardrobe } = useScentList(uid);

  const scrollHandler = useAnimatedScrollHandler((e) => {
    if (scrollY) scrollY.value = e.contentOffset.y;
  });

  const [selectedItem, setSelectedItem] = useState<UserScentItem | null>(null);
  const [showTrySheet, setShowTrySheet] = useState(false);
  const [trySheetSaving, setTrySheetSaving] = useState(false);
  const [showWardrobeSheet, setShowWardrobeSheet] = useState(false);
  const [wardrobeTarget, setWardrobeTarget] = useState<UserScentItem | null>(null);

  const sections = useMemo<SectionData[]>(() => {
    const out: SectionData[] = [];
    if (toTry.length > 0) out.push({ title: 'À sentir', data: toTry });
    if (tried.length > 0) out.push({ title: 'Sentis', data: tried });
    return out;
  }, [toTry, tried]);

  const handleGoDetail = useCallback(async (item: UserScentItem) => {
    try {
      const p = await getParfumById(item.parfumId);
      if (p) setPendingParfum(p);
    } catch (e: unknown) {
      console.warn('[scentlist] getParfumById failed:', (e as Error)?.message ?? String(e));
    }
    router.push(`/catalog/${item.parfumId}`);
  }, [router]);

  const handleOpenTrySheet = useCallback((item: UserScentItem) => {
    setSelectedItem(item);
    setShowTrySheet(true);
  }, []);

  const handleCloseTrySheet = useCallback(() => {
    setShowTrySheet(false);
    setSelectedItem(null);
  }, []);

  const handleTrySheetSave = useCallback(async (data: TrySheetSaveData) => {
    if (!selectedItem) return;
    setTrySheetSaving(true);
    try {
      await markTried(selectedItem.parfumId, { verdict: data.verdict, rating: data.rating, notes: data.notes });
      if (data.addToWardrobe) {
        await moveToWardrobe(selectedItem, 'sample');
      }
      hapticsSuccess();
    } catch (e: unknown) {
      console.warn('[scentlist] save failed:', (e as Error)?.message ?? String(e));
    } finally {
      setTrySheetSaving(false);
      handleCloseTrySheet();
    }
  }, [selectedItem, markTried, moveToWardrobe, handleCloseTrySheet]);

  const handleTrySheetRemove = useCallback(async () => {
    if (!selectedItem) return;
    setTrySheetSaving(true);
    try {
      await remove(selectedItem.parfumId);
      hapticsLight();
    } catch (e: unknown) {
      console.warn('[scentlist] remove failed:', (e as Error)?.message ?? String(e));
    } finally {
      setTrySheetSaving(false);
      handleCloseTrySheet();
    }
  }, [selectedItem, remove, handleCloseTrySheet]);

  const handleWardrobeAdd = useCallback(async (ownership: WardrobeItem['ownership'], sizeMl?: number | null) => {
    if (!wardrobeTarget) return;
    try {
      await moveToWardrobe(wardrobeTarget, ownership, sizeMl ?? null);
      hapticsSuccess();
    } catch (e: unknown) {
      console.warn('[scentlist] moveToWardrobe failed:', (e as Error)?.message ?? String(e));
    } finally {
      setShowWardrobeSheet(false);
      setWardrobeTarget(null);
    }
  }, [wardrobeTarget, moveToWardrobe]);

  const handleLongPressAction = useCallback((key: string) => {
    if (!selectedItem || !uid) { setSelectedItem(null); return; }
    const item = selectedItem;
    setSelectedItem(null);

    switch (key) {
      case 'detail':
        handleGoDetail(item);
        break;
      case 'try':
        handleOpenTrySheet(item);
        break;
      case 'wardrobe':
        setWardrobeTarget(item);
        setShowWardrobeSheet(true);
        break;
      case 'favoris':
        moveFavori(uid, 'scentlist', item.parfumId, item.parfumId, item.nom ?? null, item.marque ?? null, item.imageUrl ?? null, item.familleOlactive ?? null).catch(() => {});
        break;
      case 'remove':
        remove(item.parfumId).catch(() => {});
        break;
    }
  }, [selectedItem, uid, handleGoDetail, handleOpenTrySheet, remove]);

  const sheetActions = useMemo<ActionItem[]>(() => {
    if (!selectedItem) return [];
    const isToTry = selectedItem.status === 'to_try';
    const base: ActionItem[] = [{
      icon: 'eye-outline',
      label: 'Voir le détail',
      onPress: () => handleLongPressAction('detail'),
    }];
    if (isToTry) {
      base.push({
        icon: 'checkmark-circle-outline',
        label: 'Marquer comme senti',
        onPress: () => handleLongPressAction('try'),
      });
    } else {
      base.push({
        icon: 'create-outline',
        label: "Modifier l'essai",
        onPress: () => handleLongPressAction('try'),
      });
    }
    base.push({
      icon: 'flask-outline',
      label: 'Ajouter à la Parfumerie',
      onPress: () => handleLongPressAction('wardrobe'),
    });
    base.push({
      icon: 'heart-outline',
      label: 'Ajouter aux Favoris',
      onPress: () => handleLongPressAction('favoris'),
    });
    base.push({
      icon: 'trash-outline',
      label: 'Retirer du carnet',
      destructive: true,
      onPress: () => handleLongPressAction('remove'),
    });
    return base;
  }, [selectedItem, handleLongPressAction]);

  const renderItem = useCallback(({ item }: { item: UserScentItem }) => (
    <ScentCard
      item={item}
      onPress={() => handleGoDetail(item)}
      onLongPress={() => setSelectedItem(item)}
      onTryPress={() => handleOpenTrySheet(item)}
    />
  ), [handleGoDetail, handleOpenTrySheet]);

  const renderSectionHeader = useCallback(({ section }: { section: SectionData }) => (
    <View style={s.sectionHeader}>
      <Text style={s.sectionTitle}>{section.title}</Text>
      <Text style={s.sectionCount}>{section.data.length}</Text>
    </View>
  ), [s]);

  if (!authReady) {
    return (
      <SafeAreaView edges={[]} style={s.container}>
        <ActivityIndicator style={s.loadingSpinner} color={theme.colors.primary} />
      </SafeAreaView>
    );
  }

  if (!isAuthenticated) {
    return (
      <SafeAreaView edges={[]} style={s.container}>
        <AuthGate icon="eyedrop-outline" description="Accède à ton carnet d'essais." />
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView edges={[]} style={s.container}>
        <ActivityIndicator style={s.loadingSpinner} color={theme.colors.primary} />
      </SafeAreaView>
    );
  }

  if (items.length === 0) {
    return (
      <SafeAreaView edges={[]} style={s.container}>
        <EmptyState variant="scentlist" onAction={() => router.push('/(tabs)')} />
      </SafeAreaView>
    );
  }

  return (
    <>
      <SafeAreaView edges={[]} style={s.container}>
        <AnimatedSectionList
          sections={sections}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          renderSectionHeader={renderSectionHeader}
          stickySectionHeadersEnabled
          contentContainerStyle={s.content}
          showsVerticalScrollIndicator={false}
          onScroll={scrollHandler}
          scrollEventThrottle={16}
          windowSize={5}
          maxToRenderPerBatch={10}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        />
      </SafeAreaView>

      <ActionSheet
        visible={selectedItem !== null}
        title={selectedItem?.nom ?? undefined}
        actions={sheetActions}
        onClose={() => setSelectedItem(null)}
      />

      <TrySheet
        visible={showTrySheet}
        parfumName={selectedItem?.nom ?? ''}
        parfumBrand={selectedItem?.marque ?? ''}
        parfumImageUrl={selectedItem?.imageUrl ?? null}
        existingItem={selectedItem}
        saving={trySheetSaving}
        onClose={handleCloseTrySheet}
        onSave={handleTrySheetSave}
        onRemove={handleTrySheetRemove}
      />

      <WardrobeAddSheet
        visible={showWardrobeSheet}
        parfumName={wardrobeTarget?.nom ?? ''}
        parfumBrand={wardrobeTarget?.marque ?? null}
        parfumImageUrl={wardrobeTarget?.imageUrl ?? null}
        onClose={() => { setShowWardrobeSheet(false); setWardrobeTarget(null); }}
        onSelect={handleWardrobeAdd}
      />
    </>
  );
}

function getStyles(t: Theme) {
  return {
    container: { flex: 1, backgroundColor: t.colors.background },
    center: { flex: 1, justifyContent: 'center' as const, alignItems: 'center' as const, padding: 32 },
    content: { paddingHorizontal: 16, paddingBottom: 88 },
    loadingSpinner: { marginTop: 24 },
    sectionHeader: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'space-between' as const,
      paddingVertical: 12,
      paddingHorizontal: 4,
      backgroundColor: t.colors.background,
    },
    sectionTitle: {
      fontFamily: 'PlayfairDisplay_600SemiBold',
      fontSize: 18,
      color: t.colors.text,
    },
    sectionCount: {
      fontFamily: 'Inter_400Regular',
      fontSize: 13,
      color: t.colors.textMuted,
    },
  } as const;
}
