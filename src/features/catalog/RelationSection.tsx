import { useMemo, useCallback } from 'react';
import { View, Text, Pressable, Alert } from 'react-native';
import Ionicons from '@react-native-vector-icons/ionicons/static';
import { useTheme, type Theme } from '../../theme/ThemeContext';
import { useAuthContext } from '../../contexts/AuthContext';
import { useUserParfumContext } from '../../contexts/UserParfumContext';
import { usePossessions } from '../../hooks/usePossessions';
import { useShelvesContext } from '../../contexts/ShelvesContext';
import { useSotd } from '../../hooks/useSotd';
import { hapticsLight } from '../../services/haptics';
import { STATUS_CHIPS, chipForStatus } from '../../utils/status-chips';
import { VERDICT_OPTIONS } from '../../utils/verdicts';
import StarRating from '../wardrobe/StarRating';
import { useSaveController } from './useSaveController';
import type { Parfum } from '../../models';

const MAX_SIGNATURES = 3;

interface Props {
  parfum: Parfum;
  save: ReturnType<typeof useSaveController>;
}

// Outer : lit seulement l'item. Aucun hook de données → pas de fetch à vide
// quand il n'y a pas de relation (perf). L'édition lourde (statut, verdict,
// possessions, notes, retirer) vit dans la SaveSheet via « Gérer ».
export default function RelationSection({ parfum, save }: Props) {
  if (!save.item) return null;
  return <RelationInner parfum={parfum} save={save} />;
}

function RelationInner({ parfum, save }: Props) {
  const { theme } = useTheme();
  const s = useMemo(() => getStyles(theme), [theme]);
  const { user } = useAuthContext();
  const uid = user?.uid ?? null;

  const { item, setRating, toggleShelf, toggleSignature, openSaveSheet } = save;

  const { items: allItems } = useUserParfumContext();
  const signatureCount = useMemo(() => allItems.filter(i => i.isSignature).length, [allItems]);

  const { items: possessions } = usePossessions(uid, parfum.id);
  const { shelves } = useShelvesContext();
  const { sotd, setTodaySotd } = useSotd(uid);

  const handleRating = useCallback((r: number) => {
    hapticsLight();
    setRating(r === 0 ? null : r);
  }, [setRating]);

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

  // item est garanti non null par le outer.
  const statusChip = STATUS_CHIPS.find(c => c.id === chipForStatus(item!.status)) ?? null;
  const verdictOpt = item!.verdict ? VERDICT_OPTIONS.find(o => o.key === item!.verdict) ?? null : null;
  const showVerdict = item!.status !== 'to_try' && item!.status !== 'want';
  const possessionCount = possessions.length;

  return (
    <View style={s.root}>
      <View style={s.summaryRow}>
        <View style={s.headerIconWrap}>
          <Ionicons name="bookmark" size={14} color={theme.colors.primaryInk} />
        </View>
        <Text style={s.headerTitle}>Ma relation</Text>

        {statusChip ? (
          <View style={s.readChip}>
            <Ionicons name={statusChip.icon as never} size={13} color={theme.colors.primaryInk} />
            <Text style={s.readChipText} allowFontScaling={false}>{statusChip.label}</Text>
          </View>
        ) : null}

        {verdictOpt ? (
          <View style={[s.readChip, { backgroundColor: (theme.colors as Record<string, string>)[`${verdictOpt.token}Soft`] }]}>
            <Ionicons name={verdictOpt.icon as never} size={13} color={(theme.colors as Record<string, string>)[verdictOpt.token]} />
            <Text style={[s.readChipText, { color: (theme.colors as Record<string, string>)[verdictOpt.token] }]} allowFontScaling={false}>{verdictOpt.label}</Text>
          </View>
        ) : null}

        {possessionCount > 0 ? (
          <View style={s.readChip}>
            <Ionicons name="flask-outline" size={13} color={theme.colors.textMuted} />
            <Text style={s.readChipMuted} allowFontScaling={false}>{possessionCount}</Text>
          </View>
        ) : null}

        <Pressable
          style={s.manageBtn}
          onPress={openSaveSheet}
          hitSlop={{ top: 14, bottom: 14, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Gérer ma relation"
        >
          <Text style={s.manageText}>Gérer</Text>
          <Ionicons name="chevron-forward" size={16} color={theme.colors.primary} />
        </Pressable>
      </View>

      {showVerdict ? (
        <View style={s.block}>
          <Text style={s.subLabel}>Ta note</Text>
          <StarRating rating={item!.rating ?? 0} size={26} onChange={handleRating} />
        </View>
      ) : null}

      <View style={s.toggleRow}>
        <Pressable
          style={[s.toggleChip, item!.isSignature && s.toggleChipActive]}
          onPress={handleToggleSignature}
          hitSlop={{ top: 6, bottom: 6 }}
          accessibilityRole="button"
          accessibilityLabel={item!.isSignature ? 'Parfum signature (activé)' : 'Définir comme signature'}
        >
          <Ionicons name={item!.isSignature ? 'star' : 'star-outline'} size={14} color={item!.isSignature ? theme.colors.secondary : theme.colors.textMuted} />
          <Text style={[s.toggleText, item!.isSignature && s.toggleTextActive]} allowFontScaling={false}>Signature</Text>
        </Pressable>

        <Pressable
          style={[s.toggleChip, isSotd && s.toggleChipActive]}
          onPress={handleSotd}
          hitSlop={{ top: 6, bottom: 6 }}
          accessibilityRole="button"
          accessibilityLabel={isSotd ? 'Porté aujourd’hui (activé)' : 'Marquer comme porté aujourd’hui'}
        >
          <Ionicons name={isSotd ? 'checkmark-circle' : 'sunny-outline'} size={14} color={isSotd ? theme.colors.primary : theme.colors.textMuted} />
          <Text style={[s.toggleText, isSotd && s.toggleTextActive]} allowFontScaling={false}>Aujourd’hui</Text>
        </Pressable>
      </View>

      {shelves.length > 0 ? (
        <View style={s.block}>
          <Text style={s.subLabel}>Étagères</Text>
          <View style={s.chips}>
            {shelves.map(sh => {
              const assigned = item!.shelfIds.includes(sh.id);
              return (
                <Pressable
                  key={sh.id}
                  style={[s.chip, assigned && s.chipActive]}
                  onPress={() => handleToggleShelf(sh.id)}
                  hitSlop={{ top: 6, bottom: 6 }}
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
    summaryRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
    headerIconWrap: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: t.colors.primarySoft,
      justifyContent: 'center',
      alignItems: 'center',
    },
    headerTitle: { fontFamily: 'PlayfairDisplay_600SemiBold', fontSize: 18, color: t.colors.text, marginRight: 'auto' },
    readChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 20,
      backgroundColor: t.colors.primarySoft,
    },
    readChipText: { fontFamily: 'Inter_600SemiBold', fontSize: 12, color: t.colors.primaryInk },
    readChipMuted: { fontFamily: 'Inter_600SemiBold', fontSize: 12, color: t.colors.textMuted },
    manageBtn: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingLeft: 4 },
    manageText: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: t.colors.primary },
    block: { marginTop: 14 },
    subLabel: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 11,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      color: t.colors.textMuted,
      marginBottom: 8,
    },
    toggleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
    toggleChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 14,
      paddingVertical: 9,
      borderRadius: 20,
      backgroundColor: t.colors.surface2,
      borderWidth: 1,
      borderColor: 'transparent',
    },
    toggleChipActive: { backgroundColor: t.colors.primarySoft, borderColor: t.colors.primary },
    toggleText: { fontFamily: 'Inter_500Medium', fontSize: 13, color: t.colors.textMuted },
    toggleTextActive: { color: t.colors.primaryInk, fontFamily: 'Inter_600SemiBold' },
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
  } as const;
}
