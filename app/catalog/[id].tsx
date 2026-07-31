// app/catalog/[id].tsx — Fiche détail parfum v7 : hero épuré, prix unique, storytelling olfactif

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, Linking, StyleSheet, useWindowDimensions, Platform, Share } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Animated, { useSharedValue, useAnimatedScrollHandler } from 'react-native-reanimated';
import Ionicons from '@react-native-vector-icons/ionicons/static';
import { useAuthContext } from '../../src/contexts/AuthContext';
import { getParfumById, updateParfum, getSimilarParfums } from '../../src/services/catalog';
import { consumePendingParfum, setPendingParfum } from '../../src/services/catalog-bridge';
import { hapticsLight } from '../../src/services/haptics';
import { useTheme, type Theme } from '../../src/theme/ThemeContext';
import type { Parfum } from '../../src/models';
import { translateNote } from '../../src/utils/translate-note';
import { formatPrice } from '../../src/utils/format-price';
import { parfumShareUrl } from '../../src/utils/share';
import OlfactoryPyramid from '../../src/features/catalog/OlfactoryPyramid';
import SeasonProfile from '../../src/features/catalog/SeasonProfile';
import { buildSeasonProfile } from '../../src/utils/season-profile';
import PriceDisplay from '../../src/components/PriceDisplay';
import Button from '../../src/components/Button';
import AlertPriceToggle from '../../src/components/AlertPriceToggle';
import SaveSheet from '../../src/features/catalog/SaveSheet';
import SaveButton from '../../src/features/catalog/SaveButton';
import RelationSection from '../../src/features/catalog/RelationSection';
import { useSaveController } from '../../src/features/catalog/useSaveController';
import AccordProfile from '../../src/features/catalog/AccordProfile';
import PerformanceProfile from '../../src/features/catalog/PerformanceProfile';
import TrySheet from '../../src/features/scentlist/TrySheet';
import NoteDetailPopup from '../../src/components/NoteDetailPopup';
import ImageViewerPopup from '../../src/components/ImageViewerPopup';
import ParfumCard from '../../src/components/ParfumCard';
import DetailHero from '../../src/features/catalog/DetailHero';
import CollapsingHeader from '../../src/features/catalog/CollapsingHeader';
import StickyBottomBar from '../../src/features/catalog/StickyBottomBar';
import CommunityVerdicts, { VerdictProfilesSheet } from '../../src/features/catalog/CommunityVerdicts';
import type { ParfumVerdict } from '../../src/services/community';

function typeParfumLabel(v: string): string {
  const k = v.toLowerCase().replace(/[^a-z]/g, '');
  if (k.includes('extrait') || k.includes('pure')) return 'Extrait';
  if (k.includes('edp') || k.includes('eaudeparfum')) return 'Eau de Parfum';
  if (k.includes('edt') || k.includes('eaudetoilette')) return 'Eau de Toilette';
  if (k.includes('edc') || k.includes('eaudecologne')) return 'Eau de Cologne';
  return v;
}


// ─── Titres de section ───────────────────────────────────────

function SectionTitle({ icon, title, subtitle, tint, tintSoft, s, t }: { icon: string; title: string; subtitle?: string; tint?: string; tintSoft?: string; s: ReturnType<typeof getStyles>; t: Theme }) {
  return (
    <View style={s.sectionTitle}>
      <View style={[s.sectionIconWrap, { backgroundColor: tintSoft ?? t.colors.primarySoft }]}>
        <Ionicons name={icon as never} size={14} color={tint ?? t.colors.primaryInk} />
      </View>
      <View style={s.sectionTitleBody}>
        <Text style={s.sectionTitleText}>{title}</Text>
        {subtitle ? <Text style={s.sectionSubtitle}>{subtitle}</Text> : null}
      </View>
    </View>
  );
}

export default function CatalogDetailPage() {
  const rawId = useLocalSearchParams<{ id: string }>().id;
  const id: string | undefined = Array.isArray(rawId) ? rawId[0] : rawId;
  const router = useRouter();
  const { width: windowWidth } = useWindowDimensions();
  const { theme: t } = useTheme();
  const s = useMemo(() => getStyles(t), [t]);

  const { user, isAuthenticated, isAdmin } = useAuthContext();
  const [parfum, setParfum] = useState<Parfum | null>(null);
  const [loading, setLoading] = useState(true);
  const [showImageViewer, setShowImageViewer] = useState(false);
  const [selectedNote, setSelectedNote] = useState<{ name: string; layer: 'top' | 'heart' | 'base' | null } | null>(null);
  const [pending] = useState<Parfum | null>(() => consumePendingParfum());
  const [imgFailed, setImgFailed] = useState(false);
  const [similars, setSimilars] = useState<Parfum[]>([]);
  const [similarsLoading, setSimilarsLoading] = useState(false);
  const [verdictProfiles, setVerdictProfiles] = useState<ParfumVerdict[]>([]);
  const [showVerdictSheet, setShowVerdictSheet] = useState(false);
  const scrollY = useSharedValue(0);
  const priceSectionY = useSharedValue(9999);
  const priceSectionRef = useRef<View>(null);
  const insets = useSafeAreaInsets();

  const save = useSaveController(parfum);

  // Chargement auto-suffisant : bridge (preview) -> Firestore
  useEffect(() => {
    if (!id) { setLoading(false); return; }
    let cancelled = false;
    setLoading(true);

    const load = async () => {
      try {
        if (pending && pending.id === id) {
          if (!cancelled) setParfum(pending);
        }

        try {
          const cached = await getParfumById(id);
          if (!cancelled && cached) {
            setParfum(cached);
            return;
          }
        } catch (e) {
          console.warn('[detail] Firestore fetch failed:', (e as Error)?.message);
        }

        if (pending && pending.id === id) {
          return;
        }

        if (!cancelled) setParfum(null);
      } catch (fatalErr) {
        console.error('[detail] FATAL load error:', fatalErr);
        if (!cancelled) setParfum(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();

    return () => { cancelled = true; };
  }, [id]);

  // Recommandations — recherche Firestore par accords partagés
  const simMainAccords = parfum?.mainAccords;
  const simSimilarIds = parfum?.similarIds;
  const simCachedAt = parfum?.similarIdsCachedAt;

  useEffect(() => {
    if (!simMainAccords || simMainAccords.length === 0 || !parfum?.id) return;

    let cancelled = false;

    const loadSimilars = async () => {
      setSimilarsLoading(true);

      // Step 1: check Firestore cache via similarIds (TTL 24h)
      if (simSimilarIds && simSimilarIds.length > 0 && simCachedAt) {
        const age = Date.now() - simCachedAt.getTime();
        if (age < 86400000) {
          const cached = (await Promise.all(
            simSimilarIds.map((id: string) => getParfumById(id).catch(() => undefined))
          )).filter(Boolean) as Parfum[];

          if (cached.length >= 3) {
            if (!cancelled) {
              setSimilars(cached);
              setSimilarsLoading(false);
            }
            return;
          }
        }
      }

      // Step 2: recherche Firestore par accords partagés
      try {
        const results = await getSimilarParfums(simMainAccords, parfum.id!, 6);

        if (!cancelled && results.length > 0) {
          setSimilars(results);

          // Persist similarIds + timestamp pour les prochains visiteurs (admins uniquement — RLS)
          if (isAdmin) {
            const ids = results.map((p: Parfum) => p.id);
            updateParfum(parfum.id!, { similarIds: ids, similarIdsCachedAt: new Date() }).catch(() => {});
          }
        }
      } catch {
        // silent fail
      } finally {
        if (!cancelled) setSimilarsLoading(false);
      }
    };

    loadSimilars();
    return () => { cancelled = true; };
  }, [parfum?.id, simMainAccords, simSimilarIds, simCachedAt]);

  const scrollHandler = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });

  const handleImageError = useCallback(() => setImgFailed(true), []);
  const handleImagePress = useCallback(() => setShowImageViewer(true), []);
  const handleShare = useCallback(async () => {
    if (!parfum) return;
    hapticsLight();
    const url = parfumShareUrl(parfum.id);
    const text = `Découvre ${parfum.marque} – ${parfum.nom} sur ParfumScan`;
    try {
      if (Platform.OS === 'ios') {
        await Share.share({ url, message: text });
      } else {
        await Share.share({ message: `${text}\n${url}` });
      }
    } catch { /* annulation utilisateur */ }
  }, [parfum]);
  const handlePurchasePress = useCallback(() => {
    if (parfum?.purchaseUrl) Linking.openURL(parfum.purchaseUrl);
  }, [parfum?.purchaseUrl]);
  const handleNotePress = useCallback((note: string, layer?: 'top' | 'heart' | 'base' | null) => setSelectedNote({ name: note, layer: layer ?? null }), []);
  const handleNotePopupClose = useCallback(() => setSelectedNote(null), []);
  const handleImageViewerClose = useCallback(() => setShowImageViewer(false), []);
  const handleOpenVerdictProfiles = useCallback((v: ParfumVerdict[]) => { setVerdictProfiles(v); setShowVerdictSheet(true); }, []);
  const handleCloseVerdictSheet = useCallback(() => setShowVerdictSheet(false), []);

  const heroUrl = parfum?.imageUrl ?? null;
  const heroUrl2x = parfum?.imageUrl2x ?? null;
  const hasBestPrice = typeof parfum?.bestPrice === 'number' && parfum.bestPrice > 0;

  const ratingDisplay: number | undefined = (() => {
    const p = parfum;
    if (!p) return undefined;
    if (typeof p.ratingScore === 'number') return Number.isNaN(p.ratingScore) ? undefined : p.ratingScore;
    if (typeof p.rating === 'string') { const v = parseFloat(p.rating); return Number.isNaN(v) ? undefined : v; }
    return undefined;
  })();

  // « Quand le porter » : saisons + occasions + moment de la journée, calculés
  // une fois (util partagé avec SeasonProfile et la ligne éditoriale de tête).
  const seasonProfile = useMemo(() => buildSeasonProfile(parfum), [parfum]);

  const content = (
    <>
      {loading ? (
      <View style={s.center}><ActivityIndicator size="large" color={t.colors.primary} /></View>
    ) : !parfum ? (
      <View style={s.center}><Text style={{fontFamily:'Inter_400Regular',color:t.colors.textMuted}}>Parfum introuvable.</Text></View>
    ) : (
      <View style={{flex:1,backgroundColor:t.colors.background}}>
          <CollapsingHeader scrollY={scrollY} brand={parfum.marque} name={parfum.nom} rightAction={{ icon: 'share-social-outline', onPress: handleShare, accessibilityLabel: 'Partager ce parfum' }} />
        <Animated.ScrollView
          style={{flex:1}}
          contentContainerStyle={{paddingTop:insets.top+70}}
          onScroll={scrollHandler}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
        >
          <DetailHero
            imageUrl={heroUrl}
            imageUrl2x={heroUrl2x}
            brand={parfum.marque}
            imgFailed={imgFailed}
            parfum={parfum}
            onImageError={handleImageError}
            onImagePress={handleImagePress}
            onShare={handleShare}
          />

          <RelationSection parfum={parfum} save={save} />

          <View style={s.contentWrap}>
            {/* ─── Méta : famille, concentration, année, note ─── */}
            <View style={s.badgeRow}>
              <View style={[s.badgeCompact, { backgroundColor: t.colors.primarySoft }]}>
                <Text style={[s.badgeCompactText, { color: t.colors.primaryInk }]}>{translateNote(parfum.familleOlactive)}</Text>
              </View>
              {parfum.typeParfum ? (
                <View style={[s.badgeCompact, { backgroundColor: t.colors.surface2 }]}>
                  <Text style={[s.badgeCompactText, { color: t.colors.textMuted }]}>{typeParfumLabel(parfum.typeParfum)}</Text>
                </View>
              ) : null}
              {parfum.annee ? (
                <View style={[s.badgeCompact, { backgroundColor: t.colors.secondarySoft }]}>
                  <Text style={[s.badgeCompactText, { color: t.colors.secondaryInk }]}>{parfum.annee}</Text>
                </View>
              ) : null}
              {ratingDisplay !== undefined ? (
                <View style={[s.badgeCompact, s.ratingChip, { backgroundColor: t.colors.fairSoft }]}>
                  <Ionicons name="star" size={10} color={t.colors.fairInk} />
                  <Text style={[s.badgeCompactText, { color: t.colors.fairInk }]}>{ratingDisplay}</Text>
                </View>
              ) : null}
              {__DEV__ && (
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: parfum.source === 'seed' || parfum.source === 'manual' ? t.colors.primary : t.colors.overpriced, alignSelf: 'center' }} />
              )}
            </View>

            {/* ─── La signature (maison + nez) ─── */}
            <View style={s.signatureRow}>
              <Pressable
                style={({ pressed }) => [s.brandChip, pressed && { opacity: 0.7 }]}
                hitSlop={{ top: 5, bottom: 5 }}
                accessibilityRole="button"
                accessibilityLabel={`Voir la maison ${parfum.marque}`}
                onPress={() => {
                  hapticsLight();
                  router.push(`/brand/${encodeURIComponent(parfum.marque)}`);
                }}
              >
                <Ionicons name="storefront-outline" size={12} color={t.colors.primaryInk} />
                <Text style={s.brandChipText} allowFontScaling={false}>{parfum.marque}</Text>
              </Pressable>
              {parfum.perfumers && parfum.perfumers.filter(Boolean).length > 0
                ? [...new Set(parfum.perfumers.filter(Boolean))].map(name => (
                    <Pressable
                      key={name}
                      style={({ pressed }) => [s.noseChip, pressed && { opacity: 0.7 }]}
                      hitSlop={{ top: 5, bottom: 5 }}
                      accessibilityRole="button"
                      accessibilityLabel={`Voir les créations de ${name}`}
                      onPress={() => {
                        hapticsLight();
                        router.push(`/perfumer/${encodeURIComponent(name)}`);
                      }}
                    >
                      <Ionicons name="finger-print-outline" size={12} color={t.colors.secondaryInk} />
                      <Text style={s.noseChipText} allowFontScaling={false}>{name}</Text>
                    </Pressable>
                  ))
                : null}
            </View>

            {/* ─── Ligne éditoriale (voix lookbook, Playfair italique) ─── */}
            {seasonProfile?.topSeasonKey || (seasonProfile?.topOccasions.length ?? 0) > 0 ? (
              <Text style={s.editorialLine} maxFontSizeMultiplier={1.3}>
                {[
                  seasonProfile?.columns.find(col => col.isTop)?.label ?? null,
                  seasonProfile?.topOccasions[0]?.label ?? null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
            ) : null}

            {/* ─── Le prix (affichage unique dans le flux) ─── */}
            <View ref={priceSectionRef} onLayout={(e: LayoutChangeEvent) => { priceSectionY.value = e.nativeEvent.layout.y + 20; }}>
              {hasBestPrice ? (
                <View style={s.dealSection}>
                  <PriceDisplay
                    bestPrice={parfum.bestPrice!}
                    referencePrice={parfum.referencePrice}
                    priceValue={parfum.priceValue as 'deal' | 'fair' | 'overpriced' | undefined}
                    large
                  />
                  {parfum.purchaseUrl ? (
                    <Button variant="primary" onPress={handlePurchasePress} icon="cart-outline" style={s.buyBtn}>
                      Voir l'offre
                    </Button>
                  ) : null}
                </View>
              ) : null}

              {!save.item ? <SaveButton label={save.saveLabel} onPress={save.openSaveSheet} variant="flow" /> : null}

              {isAuthenticated && user?.uid && id ? (
                <AlertPriceToggle
                  parfumId={id}
                  uid={user.uid}
                  currentPrice={parfum.bestPrice}
                  referencePrice={parfum.referencePrice}
                  nom={parfum.nom}
                  marque={parfum.marque}
                  imageUrl={parfum.imageUrl}
                />
              ) : null}

              {/* ─── Comparer les marchands ─── */}
              {parfum.offers && parfum.offers.length > 1 ? (
                <View style={s.infoZone}>
                  <SectionTitle icon="pricetags-outline" title="Comparer les marchands" tint={t.colors.deal} tintSoft={t.colors.dealSoft} s={s} t={t} />
                  {parfum.offers.map((offer, i) => (
                    <Pressable
                      key={`${offer.marchand}-${i}`}
                      style={s.offerRow}
                      onPress={() => offer.url && Linking.openURL(offer.url)}
                    >
                      <View style={s.offerLeft}>
                        <Text style={s.offerMerchant}>{offer.marchand}</Text>
                        {offer.volumeMl ? <Text style={s.offerVolume}>{offer.volumeMl} ml</Text> : null}
                      </View>
                      <View style={s.offerRight}>
                        <Text style={s.offerPrice}>{formatPrice(offer.prix, { decimals: 0 })}</Text>
                        {parfum.bestPrice && offer.prix > parfum.bestPrice ? (
                          <Text style={s.offerDiff}>+{formatPrice(offer.prix - parfum.bestPrice, { decimals: 0 })}</Text>
                        ) : null}
                      </View>
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </View>

                {/* ─── Pyramide olfactive ─── */}
                <OlfactoryPyramid
                  topNotes={parfum.notesTete}
                  heartNotes={parfum.notesCoeur}
                  baseNotes={parfum.notesFond}
                  generalNotes={parfum.generalNotes}
                  onNotePress={handleNotePress}
                />

                <AccordProfile
                  accords={parfum.mainAccords}
                  percentages={parfum.mainAccordsPercentage}
                />

                <PerformanceProfile
                  parfumId={parfum.id}
                  longevity={parfum.longevity}
                  sillage={parfum.sillage}
                />

                {/* ─── Quand le porter ─── */}
                {seasonProfile ? (
                  <SeasonProfile key={parfum?.id ?? 'season'} profile={seasonProfile} parfumId={parfum!.id} />
                ) : null}

                {/* ─── La communauté (verdicts publics) ─── */}
                {parfum ? <CommunityVerdicts parfumId={parfum.id} onOpenProfiles={handleOpenVerdictProfiles} /> : null}

                {/* ─── Dans le même esprit (recommandations) ─── */}
                {similars.length > 0 ? (
                  <View style={s.infoZone}>
                    <SectionTitle icon="sparkles-outline" title="Dans le même esprit" subtitle="Sélection aux accords proches" s={s} t={t} />
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.similarRow}>
                      {similars.map(sim => (
                        <View key={sim.id} style={s.similarCardWrap}>
                          <ParfumCard
                            parfum={sim}
                            mode="compact"
                            onPressOverride={() => {
                              setPendingParfum(sim);
                              router.push(`/catalog/${sim.id}`);
                            }}
                          />
                        </View>
                      ))}
                    </ScrollView>
                  </View>
                ) : null}
                {similarsLoading ? <ActivityIndicator style={{ marginTop: 12 }} color={t.colors.primary} /> : null}
        </View>
        <View style={{height:100}} />
        </Animated.ScrollView>

        <StickyBottomBar
          scrollY={scrollY}
          priceSectionY={priceSectionY}
          bestPrice={hasBestPrice ? parfum.bestPrice : undefined}
          referencePrice={parfum.referencePrice}
          saveLabel={save.saveLabel}
          purchaseUrl={parfum.purchaseUrl}
          onSavePress={save.openSaveSheet}
          onPurchasePress={handlePurchasePress}
        />
      </View>
      )}
      {parfum && (
        <TrySheet
          visible={save.showTrySheet}
          parfumName={parfum.nom}
          parfumBrand={parfum.marque}
          parfumImageUrl={heroUrl}
          existingItem={save.item}
          saving={save.trySheetSaving}
          onClose={save.closeTrySheet}
          onSave={save.handleTrySheetSave}
          onRemove={save.item ? save.remove : undefined}
        />
      )}
      <SaveSheet
        visible={save.showSaveSheet}
        parfumName={parfum?.nom ?? ''}
        parfumBrand={parfum?.marque ?? ''}
        parfumImageUrl={heroUrl}
        item={save.item}
        onClose={save.closeSaveSheet}
        onSetStatus={save.setStatus}
        onSetVerdict={save.setVerdict}
        onRemove={save.remove}
        onOpenFullNotes={save.openFullNotes}
        onAddPossession={save.addPoss}
      />
      <NoteDetailPopup
        visible={selectedNote !== null}
        noteName={selectedNote?.name ?? ''}
        layer={selectedNote?.layer ?? null}
        onClose={handleNotePopupClose}
      />
      <ImageViewerPopup
        visible={showImageViewer}
        imageUrl={heroUrl ?? ''}
        imageUrl2x={heroUrl2x}
        brand={parfum?.marque ?? ''}
        name={parfum?.nom ?? ''}
        onClose={handleImageViewerClose}
      />
      <VerdictProfilesSheet
        visible={showVerdictSheet}
        verdicts={verdictProfiles}
        onClose={handleCloseVerdictSheet}
      />
    </>
  );

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.background }}>
      {content}
    </View>
  );
}

function getStyles(t: Theme) {
  return {
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  contentWrap: { paddingHorizontal: t.spacing.md, paddingTop: 14, paddingBottom: t.spacing.xl, backgroundColor: t.colors.surface, borderRadius: t.radius.card, ...t.shadow.card },
  // ─── Méta ───
  badgeRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 6 },
  badgeCompact: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeCompactText: { fontSize: 11, fontFamily: 'Inter_500Medium' },
  ratingChip: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  // ─── Ligne éditoriale ───
  editorialLine: { fontFamily: 'PlayfairDisplay_700Bold_Italic', fontSize: 15, color: t.colors.textMuted, marginTop: -2, marginBottom: 8 },
  // ─── Prix ───
  dealSection: { marginBottom: 8, gap: 10 },
  buyBtn: { marginTop: 2 },
  // ─── Sections ───
  infoZone: { marginTop: 24, gap: 8 },
  sectionTitle: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  sectionIconWrap: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  sectionTitleBody: { flex: 1 },
  sectionTitleText: { fontFamily: 'PlayfairDisplay_600SemiBold', fontSize: 18, color: t.colors.text },
  sectionSubtitle: { fontFamily: 'Inter_400Regular', fontSize: 12, color: t.colors.textMuted, marginTop: 1 },
  // ─── La signature (maison + nez) ───
  signatureRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4, marginBottom: 6 },
  brandChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: t.colors.primarySoft },
  brandChipText: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: t.colors.primaryInk },
  noseChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: t.colors.secondarySoft },
  noseChipText: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: t.colors.secondaryInk },
  // ─── Accords ───
  // ─── Recommandations ───
  similarRow: { gap: 12, paddingTop: 4 },
  similarCardWrap: { width: 160 },
  // ─── Marchands ───
  offerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.colors.border },
  offerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  offerMerchant: { fontFamily: 'Inter_500Medium', fontSize: 13, color: t.colors.text },
  offerVolume: { fontFamily: 'Inter_400Regular', fontSize: 11, color: t.colors.textMuted, backgroundColor: t.colors.surface2, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  offerRight: { alignItems: 'flex-end' },
  offerPrice: { fontFamily: 'Inter_700Bold', fontSize: 15, color: t.colors.primary },
  offerDiff: { fontFamily: 'Inter_500Medium', fontSize: 11, color: t.colors.overpricedInk },
} as const;
}
