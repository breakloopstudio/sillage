// app/wardrobe/[parfumId].tsx — Fiche personnelle (vue « mon exemplaire »)

import { useState, useEffect, useMemo } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Ionicons from '@react-native-vector-icons/ionicons/static';
import { useAuthContext } from '../../src/contexts/AuthContext';
import { useWardrobe } from '../../src/hooks/useWardrobe';
import { useShelves } from '../../src/hooks/useShelves';
import { useSotd } from '../../src/hooks/useSotd';
import { getParfumById } from '../../src/services/catalog';
import { setPendingParfum } from '../../src/services/catalog-bridge';
import type { Parfum } from '../../src/models';
import StarRating from '../../src/features/wardrobe/StarRating';
import { ownershipLabel } from '../../src/utils/ownership';
import { hapticsLight } from '../../src/services/haptics';
import { useTheme, type Theme } from '../../src/theme/ThemeContext';
import type { WardrobeItem } from '../../src/models/wardrobe.interface';

const OWNERSHIP_OPTIONS: WardrobeItem['ownership'][] = ['have', 'want', 'had', 'sample', 'decant'];
const SIZE_OPTIONS = [30, 50, 75, 100, 125, 200];
const DECANT_SIZE_OPTIONS = [2, 5, 8, 10, 20, 30];

export default function WardrobeDetailPage() {
  const rawId = useLocalSearchParams<{ parfumId: string }>().parfumId;
  const parfumId: string | undefined = Array.isArray(rawId) ? rawId[0] : rawId;
  const router = useRouter();
  const { theme, resolvedMode } = useTheme();
  const keyboardAppearance = resolvedMode === 'dark' ? 'dark' : 'light';
  const s = useMemo(() => getStyles(theme), [theme]);
  const { user, authReady, isAuthenticated } = useAuthContext();
  const uid = user?.uid ?? null;
  const { items, update, remove } = useWardrobe(uid);
  const { shelves } = useShelves(uid);
  const { sotd, setTodaySotd } = useSotd(uid);

  const [parfumData, setParfumData] = useState<Parfum | null>(null);
  const [imgFailed, setImgFailed] = useState(false);
  const [showNotesEdit, setShowNotesEdit] = useState(false);
  const [notesDraft, setNotesDraft] = useState('');

  const item = useMemo(() => items.find(i => i.parfumId === parfumId) ?? null, [items, parfumId]);
  const signatureCount = useMemo(() => items.filter(i => i.isSignature).length, [items]);

  useEffect(() => {
    if (parfumId) {
      getParfumById(parfumId).then(p => { if (p) setParfumData(p); }).catch(() => {});
    }
  }, [parfumId]);

  useEffect(() => {
    if (item?.notes) setNotesDraft(item.notes);
  }, [item?.parfumId]);

  if (!authReady) return <View style={s.center}><ActivityIndicator size="large" color={theme.colors.primary} /></View>;
  if (!isAuthenticated || !item) {
    return (
      <SafeAreaView edges={['top', 'bottom']} style={s.container}>
        <View style={s.center}>
          <Text style={s.notFoundText}>Parfum introuvable dans votre parfumerie.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const isSotd = sotd?.parfumId === parfumId;
  const imageUrl = parfumData?.imageUrl ?? item.imageUrl ?? undefined;

  const handleOwnershipChange = (o: WardrobeItem['ownership']) => {
    hapticsLight();
    update(parfumId!, { ownership: o }).catch(() => {});
  };

  const handleRatingChange = (rating: number) => {
    hapticsLight();
    update(parfumId!, { rating: rating === 0 ? null : rating }).catch(() => {});
  };

  const handleToggleShelf = (shelfId: string) => {
    const current = item.shelfIds;
    const next = current.includes(shelfId) ? current.filter(id => id !== shelfId) : [...current, shelfId];
    update(parfumId!, { shelfIds: next }).catch(() => {});
  };

  const handleSizeChange = (ml: number) => {
    update(parfumId!, { sizeMl: item.sizeMl === ml ? null : ml }).catch(() => {});
  };

  const handleToggleSignature = () => {
    if (!item) return;
    const next = !item.isSignature;
    if (next && signatureCount >= 3) {
      Alert.alert('Limite atteinte', 'Vous avez déjà 3 signatures. Retirez-en une avant d\'en ajouter.');
      return;
    }
    hapticsLight();
    update(parfumId!, { isSignature: next }).catch(() => {});
  };

  const handleSaveNotes = () => {
    update(parfumId!, { notes: notesDraft.trim() || null }).catch(() => {});
    setShowNotesEdit(false);
  };

  const handleSotdToggle = () => {
    if (isSotd) return;
    hapticsLight();
    setTodaySotd(item).catch(() => {});
  };

  const handleRemove = () => {
    Alert.alert('Retirer de la parfumerie', 'Ce parfum sera retiré de votre parfumerie.', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Retirer',
        style: 'destructive',
        onPress: async () => {
          await remove(parfumId!).catch(() => {});
          router.back();
        },
      },
    ]);
  };

  return (
    <SafeAreaView edges={['top', 'bottom']} style={s.container}>
      <ScrollView contentContainerStyle={s.scroll}>
        <View style={s.header}>
          <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel="Retour">
            <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
          </Pressable>
          <Pressable onPress={handleRemove} hitSlop={12}>
            <Ionicons name="ellipsis-horizontal" size={22} color={theme.colors.textMuted} />
          </Pressable>
        </View>

        {imageUrl && !imgFailed ? (
          <Image source={{ uri: imageUrl }} style={s.heroImg} contentFit="cover" transition={300} onError={() => setImgFailed(true)} />
        ) : (
          <View style={s.heroPlaceholder}>
            <Ionicons name="flask-outline" size={64} color={theme.colors.textMuted} />
          </View>
        )}

        <View style={s.body}>
          <Text style={s.name}>{item.nom ?? parfumId?.replace(/_/g, ' ')}</Text>
          <Text style={s.brand}>{item.marque ?? ''}</Text>

          <View style={s.ratingRow}>
            <StarRating
              rating={item.rating ?? 0}
              size={28}
              onChange={handleRatingChange}
            />
            <Text style={s.ratingLabel}>
              {item.rating && !Number.isNaN(item.rating) ? `Ma note : ${item.rating.toFixed(1).replace(/\.0$/, '')}/5` : 'Non noté'}
            </Text>
          </View>

          <Text style={s.sectionLabel}>État</Text>
          <View style={s.chips}>
            {OWNERSHIP_OPTIONS.map(o => (
              <Pressable
                key={o}
                style={[s.chip, item.ownership === o && s.chipActive]}
                onPress={() => handleOwnershipChange(o)}
              >
                <Text style={[s.chipText, item.ownership === o && s.chipTextActive]}>
                  {ownershipLabel(o)}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={s.signatureRow}>
            <Pressable
              style={s.signatureBtn}
              onPress={handleToggleSignature}
              disabled={!item.isSignature && signatureCount >= 3}
            >
              <Ionicons
                name={item.isSignature ? 'star' : 'star-outline'}
                size={18}
                color={item.isSignature ? theme.colors.secondary : theme.colors.textMuted}
              />
              <Text style={[s.signatureLabel, item.isSignature && s.signatureLabelActive]}>
                {item.isSignature ? 'Parfum signature' : 'Définir comme parfum signature'}
              </Text>
              <Text style={s.signatureCount}>{signatureCount}/3</Text>
            </Pressable>
          </View>

          {(item.ownership === 'have' || item.ownership === 'decant' || item.ownership === 'sample') && (
            <>
              <Text style={s.sectionLabel}>Format</Text>
              <View style={s.chips}>
                {(item.ownership === 'have' ? SIZE_OPTIONS : DECANT_SIZE_OPTIONS).map(ml => (
                  <Pressable
                    key={ml}
                    style={[s.chip, item.sizeMl === ml && s.chipActive]}
                    onPress={() => handleSizeChange(ml)}
                  >
                    <Text style={[s.chipText, item.sizeMl === ml && s.chipTextActive]}>
                      {ml}ml
                    </Text>
                  </Pressable>
                ))}
              </View>
            </>
          )}

          {shelves.length > 0 && (
            <>
              <Text style={s.sectionLabel}>Étagères</Text>
              <View style={s.chips}>
                {shelves.map(sh => {
                  const assigned = item.shelfIds.includes(sh.id);
                  return (
                    <Pressable
                      key={sh.id}
                      style={[s.chip, assigned && s.chipActive]}
                      onPress={() => handleToggleShelf(sh.id)}
                    >
                      {sh.icon && <Ionicons name={sh.icon as never} size={12} color={assigned ? theme.colors.primaryInk : theme.colors.textMuted} />}
                      <Text style={[s.chipText, assigned && s.chipTextActive]}>{sh.name}</Text>
                      {assigned && <Ionicons name="close" size={12} color={theme.colors.primaryInk} />}
                    </Pressable>
                  );
                })}
              </View>
            </>
          )}

          <Text style={s.sectionLabel}>Parfum du jour</Text>
          <Pressable
            style={[s.sotdRow, isSotd && s.sotdActive]}
            onPress={handleSotdToggle}
          >
            <Ionicons
              name={isSotd ? 'checkmark-circle' : 'sunny-outline'}
              size={20}
              color={isSotd ? theme.colors.primary : theme.colors.textMuted}
            />
            <Text style={[s.sotdText, isSotd && s.sotdTextActive]}>
              {isSotd ? 'Porté aujourd\'hui' : 'Marquer comme porté aujourd\'hui'}
            </Text>
          </Pressable>

          <Text style={s.sectionLabel}>Mes notes</Text>
          {showNotesEdit ? (
            <View style={s.notesEdit}>
              <TextInput
                style={s.notesInput}
                multiline
                placeholder="Mes impressions, souvenirs, anecdotes..."
                placeholderTextColor={theme.colors.textMuted}
                value={notesDraft}
                onChangeText={setNotesDraft}
                keyboardAppearance={keyboardAppearance}
                autoFocus
              />
              <View style={s.notesActions}>
                <Pressable onPress={() => setShowNotesEdit(false)}>
                  <Text style={s.notesCancel}>Annuler</Text>
                </Pressable>
                <Pressable onPress={handleSaveNotes}>
                  <Text style={s.notesSave}>Enregistrer</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <Pressable style={s.notesPreview} onPress={() => { setNotesDraft(item.notes ?? ''); setShowNotesEdit(true); }}>
              {item.notes ? (
                <Text style={s.notesText}>{item.notes}</Text>
              ) : (
                <Text style={s.notesPlaceholder}>Ajouter des notes personnelles...</Text>
              )}
            </Pressable>
          )}

          <Pressable
            style={s.catalogLink}
            onPress={() => {
              if (parfumData) {
                setPendingParfum(parfumData);
              } else {
                const bridge: Parfum = {
                  id: parfumId!,
                  nom: item.nom ?? '',
                  marque: item.marque ?? '',
                  familleOlactive: item.familleOlactive ?? '',
                  notesTete: [],
                  notesCoeur: [],
                  notesFond: [],
                  imageUrl: item.imageUrl ?? undefined,
                  source: 'seed' as const,
                  createdAt: new Date(),
                  updatedAt: new Date(),
                };
                setPendingParfum(bridge);
              }
              router.push(`/catalog/${parfumId}`);
            }}
          >
            <Text style={s.catalogLinkText}>Voir la fiche complète</Text>
            <Ionicons name="chevron-forward" size={14} color={theme.colors.primary} />
          </Pressable>

          <Pressable style={s.removeBtn} onPress={handleRemove}>
            <Ionicons name="trash-outline" size={16} color={theme.colors.overpriced} />
            <Text style={s.removeText}>Retirer de la parfumerie</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function getStyles(t: Theme) {
  return {
    container: { flex: 1, backgroundColor: t.colors.background },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
    scroll: { paddingBottom: 88 },
    notFoundText: { fontFamily: 'Inter_400Regular', fontSize: 14, color: t.colors.textMuted, textAlign: 'center' },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 8,
    },
    heroImg: { width: '100%', height: 280, resizeMode: 'cover' },
    heroPlaceholder: {
      width: '100%',
      height: 200,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: t.colors.surface2,
    },
    body: {
      padding: 16,
    },
    name: {
      fontFamily: 'PlayfairDisplay_700Bold',
      fontSize: 26,
      color: t.colors.text,
      lineHeight: 30,
    },
    brand: {
      fontFamily: 'Inter_400Regular',
      fontSize: 11,
      textTransform: 'uppercase',
      letterSpacing: 2,
      color: t.colors.textMuted,
      marginTop: 4,
      marginBottom: 16,
    },
    ratingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: 20,
    },
    ratingLabel: {
      fontFamily: 'Inter_500Medium',
      fontSize: 14,
      color: t.colors.textMuted,
    },
    sectionLabel: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 12,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      color: t.colors.textMuted,
      marginBottom: 8,
      marginTop: 20,
    },
    chips: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    signatureRow: {
      marginTop: 12,
      marginBottom: 8,
    },
    signatureBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 10,
      backgroundColor: t.colors.surface2,
    },
    signatureLabel: {
      fontFamily: 'Inter_500Medium',
      fontSize: 13,
      color: t.colors.textMuted,
      flex: 1,
    },
    signatureLabelActive: {
      color: t.colors.secondaryInk,
      fontFamily: 'Inter_600SemiBold',
    },
    signatureCount: {
      fontFamily: 'Inter_400Regular',
      fontSize: 12,
      color: t.colors.textMuted,
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 20,
      backgroundColor: t.colors.surface2,
      borderWidth: 1,
      borderColor: 'transparent',
    },
    chipActive: {
      backgroundColor: t.colors.primarySoft,
      borderColor: t.colors.primary,
    },
    chipText: {
      fontFamily: 'Inter_500Medium',
      fontSize: 13,
      color: t.colors.textMuted,
    },
    chipTextActive: {
      color: t.colors.primaryInk,
      fontFamily: 'Inter_600SemiBold',
    },
    sotdRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 12,
      paddingHorizontal: 12,
      borderRadius: t.radius.base,
      backgroundColor: t.colors.surface2,
    },
    sotdActive: {
      backgroundColor: t.colors.primarySoft,
    },
    sotdText: {
      fontFamily: 'Inter_500Medium',
      fontSize: 14,
      color: t.colors.textMuted,
    },
    sotdTextActive: {
      color: t.colors.primary,
      fontFamily: 'Inter_600SemiBold',
    },
    notesPreview: {
      backgroundColor: t.colors.surface2,
      borderRadius: t.radius.base,
      padding: 12,
      minHeight: 60,
    },
    notesText: {
      fontFamily: 'Inter_400Regular',
      fontSize: 14,
      color: t.colors.text,
      lineHeight: 20,
    },
    notesPlaceholder: {
      fontFamily: 'Inter_400Regular',
      fontSize: 14,
      color: t.colors.textMuted,
      fontStyle: 'italic',
    },
    notesEdit: {
      backgroundColor: t.colors.surface2,
      borderRadius: t.radius.base,
      padding: 12,
    },
    notesInput: {
      fontFamily: 'Inter_400Regular',
      fontSize: 14,
      color: t.colors.text,
      lineHeight: 20,
      minHeight: 80,
      textAlignVertical: 'top',
    },
    notesActions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: 16,
      marginTop: 8,
    },
    notesCancel: {
      fontFamily: 'Inter_500Medium',
      fontSize: 13,
      color: t.colors.textMuted,
    },
    notesSave: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 13,
      color: t.colors.primary,
    },
    catalogLink: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginTop: 24,
      alignSelf: 'flex-start',
    },
    catalogLinkText: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 14,
      color: t.colors.primary,
    },
    removeBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      marginTop: 24,
      paddingVertical: 14,
      borderRadius: t.radius.base,
      borderWidth: 1,
      borderColor: t.colors.overpricedSoft,
    },
    removeText: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 14,
      color: t.colors.overpriced,
    },
  } as const;
}
