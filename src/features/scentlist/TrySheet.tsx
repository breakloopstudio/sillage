// src/features/scentlist/TrySheet.tsx — Bottom sheet « Marquer comme senti »

import { useState, useMemo, useCallback } from 'react';
import { View, Text, Pressable, TextInput, Modal, ScrollView, ActivityIndicator, KeyboardAvoidingView } from 'react-native';
import Ionicons from '@react-native-vector-icons/ionicons/static';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useTheme, type Theme } from '../../theme/ThemeContext';
import StarRating from '../wardrobe/StarRating';
import type { UserParfum, ScentVerdict } from '../../models/user-parfum.interface';
import { VERDICT_OPTIONS } from '../../utils/verdicts';

export interface TrySheetSaveData {
  verdict: ScentVerdict | null;
  rating: number | null;
  notes: string | null;
  addToWardrobe: boolean;
}

interface Props {
  visible: boolean;
  parfumName: string;
  parfumBrand: string;
  parfumImageUrl: string | null;
  existingItem: UserParfum | null;
  saving?: boolean;
  onClose: () => void;
  onSave: (data: TrySheetSaveData) => void;
  onRemove?: () => void;
}

export default function TrySheet({
  visible, parfumName, parfumBrand, parfumImageUrl,
  existingItem, saving, onClose, onSave, onRemove,
}: Props) {
  const { theme } = useTheme();
  const s = useMemo(() => getStyles(theme), [theme]);
  const { t } = useTranslation('common');
  const insets = useSafeAreaInsets();

  const isEditing = existingItem !== null && existingItem.status === 'tried';
  const [verdict, setVerdict] = useState<ScentVerdict | null>(() => existingItem?.verdict ?? null);
  const [rating, setRating] = useState<number>(() => existingItem?.rating ?? 0);
  const [notes, setNotes] = useState(() => existingItem?.notes ?? '');
  const [addToWardrobe, setAddToWardrobe] = useState(false);

  const handleSave = useCallback(() => {
    onSave({
      verdict,
      rating: rating === 0 ? null : rating,
      notes: notes.trim() || null,
      addToWardrobe,
    });
  }, [verdict, rating, notes, addToWardrobe, onSave]);

  const handleBackdrop = useCallback(() => {
    if (!saving) onClose();
  }, [saving, onClose]);

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent>
      <Pressable style={s.backdrop} onPress={handleBackdrop}>
        <KeyboardAvoidingView
          behavior="padding"
          style={s.sheetWrap}
        >
          <Pressable style={[s.sheet, { paddingBottom: insets.bottom + 16 }]} onPress={() => {}}>
            <ScrollView bounces={false} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <View style={s.handleRow}>
                <View style={s.handleBar} />
              </View>

              <View style={s.header}>
                <View style={s.headerImgWrap}>
                  {parfumImageUrl ? (
                    <View style={[s.headerImg, { backgroundColor: theme.colors.surface2 }]} />
                  ) : (
                    <View style={[s.headerImg, s.headerImgEmpty, { backgroundColor: theme.colors.surface2 }]}>
                      <Ionicons name="eyedrop-outline" size={22} color={theme.colors.textMuted} />
                    </View>
                  )}
                </View>
                <View style={s.headerBody}>
                  <Text style={s.headerBrand} numberOfLines={1}>{parfumBrand}</Text>
                  <Text style={s.headerName} numberOfLines={2}>{parfumName}</Text>
                </View>
                <Pressable onPress={handleBackdrop} hitSlop={12} style={s.closeBtn}>
                  <Ionicons name="close" size={22} color={theme.colors.textMuted} />
                </Pressable>
              </View>

              <View style={s.section}>
                <Text style={s.sectionTitle}>{t('trySheet.verdict')}</Text>
                <View style={s.verdictRow}>
                  {VERDICT_OPTIONS.map(opt => {
                    const active = verdict === opt.key;
                    const color = (theme.colors as Record<string, string>)[opt.token];
                    const soft = `${opt.token}Soft`;
                    return (
                      <Pressable
                        key={opt.key}
                        style={[s.verdictChip,
                          active
                            ? { backgroundColor: (theme.colors as Record<string, string>)[soft], borderColor: color }
                            : { backgroundColor: theme.colors.surface2, borderColor: 'transparent' },
                        ]}
                        onPress={() => setVerdict(active ? null : opt.key)}
                      >
                        <Ionicons name={opt.icon as never} size={14} color={active ? color : theme.colors.textMuted} />
                        <Text style={[s.verdictChipText, active ? { color } : { color: theme.colors.textMuted }]} allowFontScaling={false}>
                          {opt.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View style={s.section}>
                <Text style={s.sectionTitle}>{t('trySheet.yourRating')}</Text>
                <StarRating rating={rating} size={28} onChange={(r) => setRating(r)} />
              </View>

              <View style={s.section}>
                <Text style={s.sectionTitle}>{t('trySheet.impressions')}</Text>
                <TextInput
                  style={s.notesInput}
                  placeholder={t('trySheet.notesPlaceholder')}
                  placeholderTextColor={theme.colors.textMuted}
                  multiline
                  numberOfLines={4}
                  value={notes}
                  onChangeText={setNotes}
                  textAlignVertical="top"
                />
              </View>

              <View style={s.toggleRow}>
                <View style={s.toggleLeft}>
                  <Text style={s.toggleLabel}>{t('trySheet.addToParfumerie')}</Text>
                  <Text style={s.toggleHint}>{t('trySheet.sampleHint')}</Text>
                </View>
                <Pressable
                  style={[s.toggleSwitch, addToWardrobe ? { backgroundColor: theme.colors.primary } : { backgroundColor: theme.colors.border }]}
                  onPress={() => setAddToWardrobe(p => !p)}
                >
                  <View style={[s.toggleThumb, addToWardrobe ? s.toggleThumbOn : s.toggleThumbOff]} />
                </Pressable>
              </View>

              <View style={s.actions}>
                <Pressable style={[s.saveBtn, { backgroundColor: theme.colors.primary }]} onPress={handleSave} disabled={saving}>
                  {saving ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={s.saveBtnText}>{isEditing ? t('trySheet.editSave') : t('trySheet.save')}</Text>
                  )}
                </Pressable>

                {isEditing && onRemove ? (
                  <Pressable style={s.removeBtn} onPress={onRemove} disabled={saving}>
                    <Text style={s.removeBtnText}>{t('trySheet.removeFromNotebook')}</Text>
                  </Pressable>
                ) : null}
              </View>
            </ScrollView>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

function getStyles(t: Theme) {
  return {
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.4)',
      justifyContent: 'flex-end',
    },
    sheetWrap: {
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: t.colors.surface,
      borderTopLeftRadius: t.radius.card,
      borderTopRightRadius: t.radius.card,
      maxHeight: '85%',
    },
    handleRow: {
      alignItems: 'center',
      paddingTop: 10,
      paddingBottom: 6,
    },
    handleBar: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: t.colors.border,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: t.spacing.md,
      paddingTop: 4,
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: t.colors.border,
    },
    headerImgWrap: {
      width: 44,
      height: 56,
      borderRadius: t.radius.base,
      overflow: 'hidden',
    },
    headerImg: {
      flex: 1,
    },
    headerImgEmpty: {
      justifyContent: 'center',
      alignItems: 'center',
    },
    headerBody: {
      flex: 1,
    },
    headerBrand: {
      fontFamily: 'Inter_400Regular',
      fontSize: 10,
      color: t.colors.textMuted,
      letterSpacing: 1.5,
    },
    headerName: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 15,
      color: t.colors.text,
      marginTop: 2,
    },
    closeBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      justifyContent: 'center',
      alignItems: 'center',
    },
    section: {
      paddingHorizontal: t.spacing.md,
      paddingTop: 16,
      gap: 10,
    },
    sectionTitle: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 13,
      color: t.colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    verdictRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },
    verdictChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 12,
      paddingVertical: 9,
      borderRadius: 20,
      borderWidth: 1,
      minHeight: 44,
    },
    verdictChipText: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 12,
    },
    notesInput: {
      backgroundColor: t.colors.surface2,
      borderRadius: t.radius.base,
      padding: 14,
      fontFamily: 'Inter_400Regular',
      fontSize: 14,
      color: t.colors.text,
      minHeight: 100,
    },
    toggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: t.spacing.md,
      paddingVertical: 16,
      marginTop: 8,
    },
    toggleLeft: {
      flex: 1,
    },
    toggleLabel: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 14,
      color: t.colors.text,
    },
    toggleHint: {
      fontFamily: 'Inter_400Regular',
      fontSize: 12,
      color: t.colors.textMuted,
      marginTop: 2,
    },
    toggleSwitch: {
      width: 48,
      height: 28,
      borderRadius: 14,
      justifyContent: 'center',
      paddingHorizontal: 3,
    },
    toggleThumb: {
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: '#FFFFFF',
    },
    toggleThumbOn: {
      alignSelf: 'flex-end',
    },
    toggleThumbOff: {
      alignSelf: 'flex-start',
    },
    actions: {
      paddingHorizontal: t.spacing.md,
      paddingTop: 12,
      gap: 10,
    },
    saveBtn: {
      height: 50,
      borderRadius: t.radius.base,
      justifyContent: 'center',
      alignItems: 'center',
      ...t.shadow.button,
    },
    saveBtnText: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 15,
      color: '#FFFFFF',
    },
    removeBtn: {
      height: 44,
      borderRadius: t.radius.base,
      justifyContent: 'center',
      alignItems: 'center',
    },
    removeBtnText: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 14,
      color: t.colors.overpriced,
    },
  } as const;
}
