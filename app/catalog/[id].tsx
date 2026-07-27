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
import PriceDisplay from '../../src/components/PriceDisplay';
import Button from '../../src/components/Button';
import AlertPriceToggle from '../../src/components/AlertPriceToggle';
import SaveSheet from '../../src/features/catalog/SaveSheet';
import SaveButton from '../../src/features/catalog/SaveButton';
import RelationSection from '../../src/features/catalog/RelationSection';
import { useSaveController } from '../../src/features/catalog/useSaveController';
import TrySheet from '../../src/features/scentlist/TrySheet';
import NoteDetailPopup from '../../src/components/NoteDetailPopup';
import ImageViewerPopup from '../../src/components/ImageViewerPopup';
import ParfumCard from '../../src/components/ParfumCard';
import DetailHero from '../../src/features/catalog/DetailHero';
import CollapsingHeader from '../../src/features/catalog/CollapsingHeader';
import StickyBottomBar from '../../src/features/catalog/StickyBottomBar';

import { SEASON_ORDER, SEASON_META, normalizeSeasonKey, type SeasonKey } from '../../src/utils/season';

const OCCASION_META: Record<string, { label: string; icon: string }> = {
  casual:       { label: 'Jour',        icon: 'sunny' },
  day:          { label: 'Jour',        icon: 'sunny' },
  daily:        { label: 'Jour',        icon: 'sunny' },
  evening:      { label: 'Soirée',      icon: 'moon' },
  night:        { label: 'Soirée',      icon: 'moon' },
  'night out':  { label: 'Soirée',      icon: 'moon' },
  night_out:    { label: 'Soirée',      icon: 'moon' },
  party:        { label: 'Fête',        icon: 'musical-notes' },
  club:         { label: 'Fête',        icon: 'musical-notes' },
  work:         { label: 'Bureau',      icon: 'briefcase' },
  office:       { label: 'Bureau',      icon: 'briefcase' },
  business:     { label: 'Bureau',      icon: 'briefcase' },
  professional: { label: 'Bureau',      icon: 'briefcase' },
  date:         { label: 'Rendez-vous', icon: 'heart' },
  romantic:     { label: 'Rendez-vous', icon: 'heart' },
  formal:       { label: 'Formel',      icon: 'shirt' },
  sport:        { label: 'Sport',       icon: 'fitness' },
  leisure:      { label: 'Loisir',      icon: 'game-controller' },
};

interface RankedItem { key: string; label: string; icon: string; score: number }

// Déduplique par label FR (plusieurs clés EN → même label) en gardant le score max,
// trié par score décroissant. Les clés inconnues sont ignorées (jamais de fallback brut).
function rankAndDedupe(ranking: { name: string; score: number }[]): RankedItem[] {
  const byLabel = new Map<string, RankedItem>();
  for (const item of ranking) {
    const k = item.name.toLowerCase().trim();
    const meta = OCCASION_META[k];
    if (!meta) continue;
    const existing = byLabel.get(meta.label);
    if (!existing || item.score > existing.score) {
      byLabel.set(meta.label, { key: k, label: meta.label, icon: meta.icon, score: item.score });
    }
  }
  return [...byLabel.values()].sort((a, b) => b.score - a.score);
}

function longevityMeta(v: string): { label: string; pct: number } {
  const key = v.toLowerCase().trim();
  if (key.includes('eternal') || key.includes('very long')) return { label: 'Très longue', pct: 90 };
  if (key.includes('long')) return { label: 'Longue', pct: 70 };
  if (key.includes('moderate') || key.includes('modéré')) return { label: 'Modérée', pct: 45 };
  if (key.includes('weak') || key.includes('court')) return { label: 'Courte', pct: 25 };
  return { label: v, pct: 40 };
}

function sillageMeta(v: string): { label: string; pct: number } {
  const key = v.toLowerCase().trim();
  if (key.includes('enormous') || key.includes('strong') || key.includes('fort') || key.includes('lourd')) return { label: 'Puissant', pct: 90 };
  if (key.includes('heavy')) return { label: 'Lourd', pct: 80 };
  if (key.includes('moderate') || key.includes('modéré')) return { label: 'Modéré', pct: 50 };
  if (key.includes('intimate') || key.includes('soft') || key.includes('léger') || key.includes('faible')) return { label: 'Intime', pct: 25 };
  return { label: v, pct: 40 };
}


function accordScore(pctStr: string): number {
  const n = parseInt(pctStr.replace('%', ''), 10);
  if (!isNaN(n)) return n;
  const labels: Record<string, number> = { dominant: 95, prominent: 75, moderate: 50, soft: 30, subtle: 15, faint: 5 };
  return labels[pctStr.toLowerCase().trim()] ?? 40;
}



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

// ─── Jauge horizontale (longévité, sillage) ──────────────────

function GaugeRow({ icon, iconBg, iconColor, label, valueLabel, pct, barColor, valColor, s }: { icon: string; iconBg: string; iconColor: string; label: string; valueLabel: string; pct: number; barColor: string; valColor: string; s: ReturnType<typeof getStyles> }) {
  return (
    <View style={s.gaugeRow}>
      <View style={[s.gaugeIcon, { backgroundColor: iconBg }]}>
        <Ionicons name={icon as never} size={14} color={iconColor} />
      </View>
      <View style={s.gaugeBody}>
        <Text style={s.gaugeLabel}>{label}</Text>
        <View style={s.gaugeTrack}><View style={[s.gaugeFill, { width: `${pct}%`, backgroundColor: barColor }]} /></View>
      </View>
      <Text style={[s.gaugeVal, { color: valColor }]}>{valueLabel}</Text>
    </View>
  );
}

// ─── Barre d'accord (violet dégradé par rang) ────────────────

const ACCORD_ALPHAS = ['FF', 'CC', '99', '73', '59'];

function AccordBar({ name, pct, index, s, t }: { name: string; pct: number; index: number; s: ReturnType<typeof getStyles>; t: Theme }) {
  const color = `${t.colors.primary}${ACCORD_ALPHAS[index % ACCORD_ALPHAS.length]}`;
  return (
    <View style={s.statBar}>
      <Text style={s.statLabel} numberOfLines={1}>{name}</Text>
      <View style={[s.statTrack, { backgroundColor: t.colors.primarySoft }]}>
        <View style={[s.statFill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
      <Text style={[s.statPct, { color: t.colors.primaryInk }]}>{pct}%</Text>
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

  const { user, isAuthenticated } = useAuthContext();
  const [parfum, setParfum] = useState<Parfum | null>(null);
  const [loading, setLoading] = useState(true);
  const [showImageViewer, setShowImageViewer] = useState(false);
  const [selectedNote, setSelectedNote] = useState<{ name: string; layer: 'top' | 'heart' | 'base' | null } | null>(null);
  const [pending] = useState<Parfum | null>(() => consumePendingParfum());
  const [imgFailed, setImgFailed] = useState(false);
  const [similars, setSimilars] = useState<Parfum[]>([]);
  const [similarsLoading, setSimilarsLoading] = useState(false);
  const loadingRef = useRef(false);
  const scrollY = useSharedValue(0);
  const priceSectionY = useSharedValue(9999);
  const priceSectionRef = useRef<View>(null);
  const insets = useSafeAreaInsets();

  const save = useSaveController(parfum);

  // Chargement auto-suffisant : bridge (preview) -> Firestore
  useEffect(() => {
    if (!id) return;
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);

    const load = async () => {
      try {
        // Step 1: Bridge data — affichage instantané si disponible
        if (pending && pending.id === id) {
          setParfum(pending);
        }

        // Step 2: Toujours tenter Firestore (données plus complètes)
        try {
          const cached = await getParfumById(id);
          if (cached) {
            setParfum(cached);
            return;
          }
        } catch (e) {
          console.warn('[detail] Firestore fetch failed:', (e as Error)?.message);
        }

        // Step 3: Si on a déjà le bridge, on s'arrête là
        if (pending && pending.id === id) {
          return;
        }

        // Pas de fallback API — le catalogue est 100% Firestore
        if (!parfum) setParfum(null);
      } catch (fatalErr) {
        console.error('[detail] FATAL load error:', fatalErr);
        if (!parfum) setParfum(null);
      } finally {
        setLoading(false);
      }
    };

    load();

    return () => { loadingRef.current = false; };
  }, [id]);

  // Recommandations — recherche Firestore par accords partagés
  const simMainAccords = parfum?.mainAccords;
  const simSimilarIds = parfum?.similarIds;
  const simCachedAt = parfum?.similarIdsCachedAt;

  useEffect(() => {
    if (!simMainAccords || simMainAccords.length === 0 || !parfum?.id) return;

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
            setSimilars(cached);
            setSimilarsLoading(false);
            return;
          }
        }
      }

      // Step 2: recherche Firestore par accords partagés
      try {
        const results = await getSimilarParfums(simMainAccords, parfum.id!, 6);

        if (results.length > 0) {
          setSimilars(results);

          // Persist similarIds + timestamp pour les prochains visiteurs
          const ids = results.map((p: Parfum) => p.id);
          updateParfum(parfum.id!, { similarIds: ids, similarIdsCachedAt: new Date() }).catch(() => {});
        }
      } catch {
        // silent fail
      } finally {
        setSimilarsLoading(false);
      }
    };

    loadSimilars();
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

  // Saisons : clé normalisée → score max. Les valeurs parasites ("day", "night")
  // sont filtrées par normalizeSeasonKey → plus jamais de texte anglais brut.
  const seasonScores = new Map<SeasonKey, number>();
  if (parfum?.seasonRanking) {
    for (const item of parfum.seasonRanking) {
      const k = normalizeSeasonKey(item.name);
      if (!k) continue;
      seasonScores.set(k, Math.max(seasonScores.get(k) ?? 0, item.score));
    }
  }
  const seasonMax = Math.max(0, ...seasonScores.values());
  const topSeasonKey = seasonMax > 0 ? (SEASON_ORDER.find(k => seasonScores.get(k) === seasonMax) ?? null) : null;

  // Occasions : dédupliquées par label FR, triées par score décroissant
  const occasions = parfum?.occasionRanking ? rankAndDedupe(parfum.occasionRanking) : [];
  const topOccasions = occasions.slice(0, 3);

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
            {topSeasonKey || topOccasions.length > 0 ? (
              <Text style={s.editorialLine} maxFontSizeMultiplier={1.3}>
                {[topSeasonKey ? SEASON_META[topSeasonKey].label : null, topOccasions[0]?.label ?? null]
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
                  onNotePress={handleNotePress}
                />

                {/* ─── Accords principaux ─── */}
                {parfum.mainAccords && parfum.mainAccords.length > 0 ? (
                  <View style={s.infoZone}>
                    <SectionTitle icon="color-filter-outline" title="Accords principaux" s={s} t={t} />
                    {(parfum.mainAccordsPercentage
                      ? Object.entries(parfum.mainAccordsPercentage)
                          .sort(([, a], [, b]) => accordScore(b) - accordScore(a))
                          .map(([name, pctStr]) => ({ name, pct: accordScore(pctStr) }))
                      : parfum.mainAccords.map((name, i) => ({ name, pct: 100 - i * 12 }))
                    ).slice(0, 5).map((a, i) => (
                      <AccordBar key={a.name} name={translateNote(a.name)} pct={a.pct} index={i} s={s} t={t} />
                    ))}
                  </View>
                ) : null}

                {/* ─── Tenue & sillage ─── */}
                {parfum.longevity || parfum.sillage ? (
                  <View style={s.infoZone}>
                    <SectionTitle icon="flash-outline" title="Tenue & sillage" tint={t.colors.reward} tintSoft={t.colors.rewardSoft} s={s} t={t} />
                    {parfum.longevity ? (() => {
                      const m = longevityMeta(parfum.longevity!);
                      return <GaugeRow icon="time-outline" iconBg={t.colors.primarySoft} iconColor={t.colors.primaryInk} label="Longévité" valueLabel={m.label} pct={m.pct} barColor={t.colors.primary} valColor={t.colors.primaryInk} s={s} />;
                    })() : null}
                    {parfum.sillage ? (() => {
                      const m = sillageMeta(parfum.sillage!);
                      return <GaugeRow icon="pulse-outline" iconBg={t.colors.rewardSoft} iconColor={t.colors.reward} label="Sillage" valueLabel={m.label} pct={m.pct} barColor={t.colors.reward} valColor={t.colors.rewardInk} s={s} />;
                    })() : null}
                  </View>
                ) : null}

                {/* ─── Quand le porter ─── */}
                {seasonMax > 0 || topOccasions.length > 0 ? (
                  <View style={s.infoZone}>
                    <SectionTitle icon="calendar-outline" title="Quand le porter" tint={t.colors.secondary} tintSoft={t.colors.secondarySoft} s={s} t={t} />
                    {seasonMax > 0 ? (
                      <View style={s.seasonCols}>
                        {SEASON_ORDER.map(key => {
                          const meta = SEASON_META[key];
                          const score = seasonScores.get(key) ?? 0;
                          const ratio = seasonMax > 0 ? score / seasonMax : 0;
                          const isTop = key === topSeasonKey;
                          const color = t.colors[meta.token];
                          const soft = t.colors[`${meta.token}Soft`];
                          return (
                            <View key={key} style={s.seasonCol}>
                              <View style={[s.seasonIconWrap, { backgroundColor: isTop ? soft : t.colors.surface2 }]}>
                                <Ionicons name={meta.icon as never} size={15} color={score > 0 ? color : t.colors.textMuted} />
                              </View>
                              <View style={s.seasonTrack}>
                                <View style={[s.seasonFill, { height: `${score > 0 ? Math.max(10, Math.round(ratio * 100)) : 6}%`, backgroundColor: score > 0 ? color : t.colors.border }]} />
                              </View>
                              <Text style={[s.seasonLabel, isTop ? { color: t.colors.text, fontFamily: 'Inter_600SemiBold' } : null]}>{meta.label}</Text>
                            </View>
                          );
                        })}
                      </View>
                    ) : null}
                    {topOccasions.length > 0 ? (
                      <View style={[s.occasionRow, seasonMax > 0 ? { marginTop: 14 } : null]}>
                        {topOccasions.map((o, i) => (
                          <View key={o.label} style={[s.occasionChip, i === 0 ? { backgroundColor: t.colors.primarySoft } : null]}>
                            <Ionicons name={o.icon as never} size={12} color={i === 0 ? t.colors.primaryInk : t.colors.textMuted} />
                            <Text style={[s.occasionChipText, i === 0 ? { color: t.colors.primaryInk, fontFamily: 'Inter_600SemiBold' } : null]}>{o.label}</Text>
                          </View>
                        ))}
                      </View>
                    ) : null}
                  </View>
                ) : null}

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
  // ─── Jauges ───
  gaugeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  gaugeIcon: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  gaugeBody: { flex: 1 },
  gaugeLabel: { fontSize: 12, fontFamily: 'Inter_500Medium', color: t.colors.textMuted, marginBottom: 3 },
  gaugeTrack: { height: 6, borderRadius: 3, backgroundColor: t.colors.border, overflow: 'hidden' },
  gaugeFill: { height: '100%', borderRadius: 3 },
  gaugeVal: { fontSize: 12, fontFamily: 'Inter_600SemiBold', marginLeft: 8, minWidth: 70, textAlign: 'right' },
  // ─── Saisons (4 colonnes) ───
  seasonCols: { flexDirection: 'row', gap: 8, marginTop: 4 },
  seasonCol: { flex: 1, alignItems: 'center', gap: 6 },
  seasonIconWrap: { width: 30, height: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
  seasonTrack: { width: 8, height: 44, borderRadius: 4, backgroundColor: t.colors.surface2, justifyContent: 'flex-end', overflow: 'hidden' },
  seasonFill: { width: '100%', borderRadius: 4 },
  seasonLabel: { fontSize: 11, fontFamily: 'Inter_500Medium', color: t.colors.textMuted },
  // ─── Occasions (chips) ───
  occasionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  occasionChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 18, backgroundColor: t.colors.surface2 },
  occasionChipText: { fontSize: 12, fontFamily: 'Inter_500Medium', color: t.colors.textMuted },
  // ─── La signature (maison + nez) ───
  signatureRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4, marginBottom: 6 },
  brandChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: t.colors.primarySoft },
  brandChipText: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: t.colors.primaryInk },
  noseChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: t.colors.secondarySoft },
  noseChipText: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: t.colors.secondaryInk },
  // ─── Accords ───
  statBar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 3 },
  statLabel: { fontSize: 13, fontFamily: 'Inter_500Medium', color: t.colors.text, width: 96 },
  statTrack: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden' },
  statFill: { height: '100%', borderRadius: 3 },
  statPct: { fontSize: 12, fontFamily: 'Inter_700Bold', width: 36, textAlign: 'right' },
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
