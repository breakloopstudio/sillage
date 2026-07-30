import { useState, useMemo, useCallback, useEffect } from 'react';
import { View, Text, Pressable, TextInput, Alert, StyleSheet } from 'react-native';
import Ionicons from '@react-native-vector-icons/ionicons/static';
import { useTheme, type Theme } from '../../theme/ThemeContext';
import { useAuthContext } from '../../contexts/AuthContext';
import { useUserParfumContext } from '../../contexts/UserParfumContext';
import { usePossessions } from '../../hooks/usePossessions';
import { useShelvesContext } from '../../contexts/ShelvesContext';
import { useSotd } from '../../hooks/useSotd';
import { hapticsLight, hapticsError } from '../../services/haptics';
import { STATUS_CHIPS, chipForStatus } from '../../utils/status-chips';
import { VERDICT_OPTIONS } from '../../utils/verdicts';
import StarRating from '../wardrobe/StarRating';
import { useSaveController } from './useSaveController';
import type { Parfum } from '../../models';
import type { UserParfumStatus, ScentVerdict, PossessionType } from '../../models/user-parfum.interface';

const POSSESSION_META: Record<PossessionType, { label: string; icon: string }> = {
  bottle: { label: 'Flacon', icon: 'flask-outline' },
  decant: { label: 'Décant', icon: 'water-outline' },
  sample: { label: 'Échantillon', icon: 'eyedrop-outline' },
};

const MAX_SIGNATURES = 3;

interface Props {
  parfum: Parfum;
  save: ReturnType<typeof useSaveController>;
}

export default function RelationSection({ parfum, save }: Props) {
  const { theme, resolvedMode } = useTheme();
  const s = useMemo(() => getStyles(theme), [theme]);
  const { user } = useAuthContext();
  const uid = user?.uid ?? null;
  const keyboardAppearance = resolvedMode === 'dark' ? 'dark' : 'light';

  const { item, setStatus, setVerdict, setRating, setNotes, toggleShelf, toggleSignature, remove } = save;

  const { items: allItems } = useUserParfumContext();
  const signatureCount = useMemo(() => allItems.filter(i => i.isSignature).length, [allItems]);

  const { items: possessions, add: addPossession, remove: removePossession } = usePossessions(uid, parfum.id);
  const { shelves } = useShelvesContext();
  const { sotd, setTodaySotd } = useSotd(uid);

  const [showNotesEdit, setShowNotesEdit] = useState(false);
  const [notesDraft, setNotesDraft] = useState('');

  useEffect(() => {
    setNotesDraft(item?.notes ?? '');
  }, [item?.parfumId]);

  const handleStatus = useCallback((st: UserParfumStatus) => {
    if (!item || chipForStatus(item.status) === chipForStatus(st)) return;
    hapticsLight();
    setStatus(st);
  }, [item, setStatus]);

  const handleVerdict = useCallback((v: ScentVerdict) => {
    if (!item) return;
    hapticsLight();
    setVerdict(v);
  }, [item, setVerdict]);

  const handleRating = useCallback((r: number) => {
    hapticsLight();
    setRating(r === 0 ? null : r);
  }, [setRating]);

  const handleAddPossession = useCallback(async (type: PossessionType) => {
    if (!item) return;
    hapticsLight();
    try {
      await addPossession(type);
      if (item.status === 'to_try' || item.status === 'tried' || item.status === 'want') {
        setStatus('have');
      }
    } catch (e: unknown) {
      console.warn('[relation] addPossession failed:', (e as Error)?.message ?? String(e));
      hapticsError();
    }
  }, [item, addPossession, setStatus]);

  const handleToggleShelf = useCallback((shelfId: string) => {
    hapticsLight();
    toggleShelf(shelfId);
  }, [toggleShelf]);

  const handleToggleSignature = useCallback(() => {
    if (!item) return;
    if (!item.isSignature && signatureCount >= MAX_SIGNATURES) {
      Alert.alert('Limite atteinte', `Tu as déjà ${MAX_SIGNATURES} signatures. Retires-en une avant d'en ajouter.`);
      return;
    }
    hapticsLight();
    toggleSignature();
  }, [item, signatureCount, toggleSignature]);

  const isSotd = sotd?.parfumId === parfum.id;

  const handleSotd = useCallback(() => {
    if (!item || isSotd) return;
    hapticsLight();
    setTodaySotd(item).catch(() => {});
  }, [item, isSotd, setTodaySotd]);

  const handleSaveNotes = useCallback(() => {
    setNotes(notesDraft.trim() || null);
    setShowNotesEdit(false);
  }, [notesDraft, setNotes]);

  const handleRemove = useCallback(() => {
    Alert.alert('Retirer', 'Retirer ce parfum de ta parfumerie ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Retirer', style: 'destructive', onPress: () => { hapticsLight(); remove(); } },
    ]);
  }, [remove]);

  if (!item) return null;

  const showVerdict = item.status !== 'to_try' && item.status !== 'want';
  const showPossessions = item.status === 'have';

  return (
    <View style={s.root}>
      <View style={s.header}>
        <View style={s.headerIconWrap}>
          <Ionicons name="bookmark-outline" size={14} color={theme.colors.primaryInk} />
        </View>
        <Text style={s.headerTitle}>Ma relation</Text>
      </View>

      <View style={s.chips}>
        {STATUS_CHIPS.map(chip => {
          const active = chipForStatus(item.status) === chip.id;
          return (
            <Pressable
              key={chip.id}
              style={[s.chip, active && s.chipActive]}
              onPress={() => handleStatus(chip.status)}
              hitSlop={{ top: 4, bottom: 4 }}
              accessibilityRole="button"
              accessibilityLabel={active ? `${chip.label} (sélectionné)` : chip.label}
            >
              <Ionicons name={chip.icon as never} size={14} color={active ? theme.colors.primaryInk : theme.colors.textMuted} />
              <Text style={[s.chipText, active && s.chipTextActive]} allowFontScaling={false}>{chip.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {showVerdict ? (
        <View style={s.block}>
          <Text style={s.subLabel}>Ton verdict</Text>
          <View style={s.chips}>
            {VERDICT_OPTIONS.map(opt => {
              const active = item.verdict === opt.key;
              const color = (theme.colors as Record<string, string>)[opt.token];
              const soft = `${opt.token}Soft`;
              return (
                <Pressable
                  key={opt.key}
                  style={[s.chip, active ? { backgroundColor: (theme.colors as Record<string, string>)[soft], borderColor: color } : null]}
                  onPress={() => handleVerdict(opt.key)}
                  hitSlop={{ top: 4, bottom: 4 }}
                  accessibilityRole="button"
                  accessibilityLabel={opt.label}
                >
                  <Ionicons name={opt.icon as never} size={14} color={active ? color : theme.colors.textMuted} />
                  <Text style={[s.chipText, active ? { color } : null]} allowFontScaling={false}>{opt.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}

      {showVerdict ? (
        <View style={s.block}>
          <Text style={s.subLabel}>Ta note</Text>
          <StarRating rating={item.rating ?? 0} size={28} onChange={handleRating} />
        </View>
      ) : null}

      {showPossessions ? (
        <View style={s.block}>
          <Text style={s.subLabel}>Mes possessions</Text>
          {possessions.length === 0 ? (
            <Text style={s.emptyHint}>Aucun objet enregistré.</Text>
          ) : (
            possessions.map(p => (
              <View key={p.id} style={s.possessionRow}>
                <Ionicons name={POSSESSION_META[p.type].icon as never} size={18} color={theme.colors.textMuted} />
                <Text style={s.possessionLabel}>
                  {POSSESSION_META[p.type].label}
                  {p.sizeMl ? ` · ${p.sizeMl} ml` : ''}
                  {p.quantity > 1 ? ` ×${p.quantity}` : ''}
                  {p.forSale ? ' · à vendre' : ''}
                </Text>
                <Pressable onPress={() => removePossession(p.id)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Supprimer">
                  <Ionicons name="close" size={16} color={theme.colors.overpriced} />
                </Pressable>
              </View>
            ))
          )}
          <View style={s.chips}>
            {(Object.keys(POSSESSION_META) as PossessionType[]).map(type => (
              <Pressable key={type} style={s.chip} onPress={() => handleAddPossession(type)} hitSlop={{ top: 4, bottom: 4 }} accessibilityRole="button" accessibilityLabel={`Ajouter ${POSSESSION_META[type].label.toLowerCase()}`}>
                <Ionicons name="add" size={14} color={theme.colors.textMuted} />
                <Text style={s.chipText} allowFontScaling={false}>{POSSESSION_META[type].label}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      {shelves.length > 0 ? (
        <View style={s.block}>
          <Text style={s.subLabel}>Étagères</Text>
          <View style={s.chips}>
            {shelves.map(sh => {
              const assigned = item.shelfIds.includes(sh.id);
              return (
                <Pressable
                  key={sh.id}
                  style={[s.chip, assigned && s.chipActive]}
                  onPress={() => handleToggleShelf(sh.id)}
                  hitSlop={{ top: 4, bottom: 4 }}
                  accessibilityRole="button"
                  accessibilityLabel={sh.name}
                >
                  {sh.icon ? <Ionicons name={sh.icon as never} size={14} color={assigned ? theme.colors.primaryInk : theme.colors.textMuted} /> : null}
                  <Text style={[s.chipText, assigned && s.chipTextActive]} allowFontScaling={false}>{sh.name}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}

      <Pressable style={s.actionRow} onPress={handleToggleSignature} accessibilityRole="button" accessibilityLabel="Parfum signature">
        <Ionicons name={item.isSignature ? 'star' : 'star-outline'} size={18} color={item.isSignature ? theme.colors.secondary : theme.colors.textMuted} />
        <Text style={[s.actionLabel, item.isSignature && s.actionLabelActive]}>
          {item.isSignature ? 'Parfum signature' : 'Définir comme signature'}
        </Text>
        <Text style={s.actionMeta} allowFontScaling={false}>{signatureCount}/{MAX_SIGNATURES}</Text>
      </Pressable>

      <Pressable style={[s.actionRow, isSotd && s.actionRowActive]} onPress={handleSotd} accessibilityRole="button" accessibilityLabel="Parfum du jour">
        <Ionicons name={isSotd ? 'checkmark-circle' : 'sunny-outline'} size={18} color={isSotd ? theme.colors.primary : theme.colors.textMuted} />
        <Text style={[s.actionLabel, isSotd && s.actionLabelActive]}>
          {isSotd ? 'Porté aujourd\u2019hui' : 'Marquer comme porté aujourd\u2019hui'}
        </Text>
      </Pressable>

      <View style={s.block}>
        <Text style={s.subLabel}>Mes notes</Text>
        {showNotesEdit ? (
          <View style={s.notesEdit}>
            <TextInput
              style={s.notesInput}
              multiline
              placeholder="Mes impressions, souvenirs, anecdotes…"
              placeholderTextColor={theme.colors.textMuted}
              value={notesDraft}
              onChangeText={setNotesDraft}
              keyboardAppearance={keyboardAppearance}
              autoFocus
            />
            <View style={s.notesActions}>
              <Pressable onPress={() => setShowNotesEdit(false)} hitSlop={6} accessibilityRole="button" accessibilityLabel="Annuler">
                <Text style={s.notesCancel}>Annuler</Text>
              </Pressable>
              <Pressable onPress={handleSaveNotes} hitSlop={6} accessibilityRole="button" accessibilityLabel="Enregistrer les notes">
                <Text style={s.notesSave}>Enregistrer</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <Pressable style={s.notesPreview} onPress={() => { setNotesDraft(item.notes ?? ''); setShowNotesEdit(true); }} accessibilityRole="button" accessibilityLabel="Modifier mes notes">
            {item.notes ? (
              <Text style={s.notesText} maxFontSizeMultiplier={1.3}>{item.notes}</Text>
            ) : (
              <Text style={s.notesPlaceholder}>Ajouter des notes personnelles…</Text>
            )}
          </Pressable>
        )}
      </View>

      <Pressable style={s.removeBtn} onPress={handleRemove} accessibilityRole="button" accessibilityLabel="Retirer de ma parfumerie">
        <Ionicons name="trash-outline" size={16} color={theme.colors.overpriced} />
        <Text style={s.removeText}>Retirer de ma parfumerie</Text>
      </Pressable>
    </View>
  );
}

function getStyles(t: Theme) {
  return {
    root: {
      marginHorizontal: 16,
      marginTop: 12,
      backgroundColor: t.colors.surface,
      borderRadius: t.radius.card,
      paddingHorizontal: 16,
      paddingTop: 14,
      paddingBottom: 16,
      ...t.shadow.card,
    },
    header: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
    headerIconWrap: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: t.colors.primarySoft,
      justifyContent: 'center',
      alignItems: 'center',
    },
    headerTitle: { fontFamily: 'PlayfairDisplay_600SemiBold', fontSize: 18, color: t.colors.text },
    block: { marginTop: 16 },
    subLabel: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 11,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      color: t.colors.textMuted,
      marginBottom: 8,
    },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 14,
      paddingVertical: 9,
      borderRadius: 20,
      backgroundColor: t.colors.surface2,
      borderWidth: 1,
      borderColor: 'transparent',
    },
    chipActive: { backgroundColor: t.colors.primarySoft, borderColor: t.colors.primary },
    chipText: { fontFamily: 'Inter_500Medium', fontSize: 13, color: t.colors.textMuted },
    chipTextActive: { color: t.colors.primaryInk, fontFamily: 'Inter_600SemiBold' },
    emptyHint: { fontFamily: 'Inter_400Regular', fontSize: 13, color: t.colors.textMuted, marginBottom: 8 },
    possessionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.border,
    },
    possessionLabel: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 14, color: t.colors.text },
    actionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 12,
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: t.radius.base,
      backgroundColor: t.colors.surface2,
    },
    actionRowActive: { backgroundColor: t.colors.primarySoft },
    actionLabel: { flex: 1, fontFamily: 'Inter_500Medium', fontSize: 13, color: t.colors.textMuted },
    actionLabelActive: { color: t.colors.primaryInk, fontFamily: 'Inter_600SemiBold' },
    actionMeta: { fontFamily: 'Inter_400Regular', fontSize: 12, color: t.colors.textMuted },
    notesPreview: { backgroundColor: t.colors.surface2, borderRadius: t.radius.base, padding: 12, minHeight: 56 },
    notesText: { fontFamily: 'Inter_400Regular', fontSize: 14, color: t.colors.text, lineHeight: 20 },
    notesPlaceholder: { fontFamily: 'Inter_400Regular', fontSize: 14, color: t.colors.textMuted, fontStyle: 'italic' },
    notesEdit: { backgroundColor: t.colors.surface2, borderRadius: t.radius.base, padding: 12 },
    notesInput: { fontFamily: 'Inter_400Regular', fontSize: 14, color: t.colors.text, lineHeight: 20, minHeight: 80, textAlignVertical: 'top' },
    notesActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 16, marginTop: 8 },
    notesCancel: { fontFamily: 'Inter_500Medium', fontSize: 13, color: t.colors.textMuted },
    notesSave: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: t.colors.primary },
    removeBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      marginTop: 20,
      paddingVertical: 12,
      borderRadius: t.radius.base,
      borderWidth: 1,
      borderColor: t.colors.overpricedSoft,
    },
    removeText: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: t.colors.overpriced },
  } as const;
}
