// src/features/scan/ScanClarify.tsx — Formulaire de correction après low-confidence

import { useState, useMemo } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, KeyboardAvoidingView } from 'react-native';
import Ionicons from "@react-native-vector-icons/ionicons/static";
import { useTranslation } from 'react-i18next';
import { useTheme, type Theme } from '../../theme/ThemeContext';
import { textOn } from '../../utils/contrast';
import type { ScanResult } from '../../models';

const POPULAR_BRANDS = ['Dior', 'Chanel', 'Guerlain', 'Yves Saint Laurent', 'Lancôme', 'Paco Rabanne', 'Jean Paul Gaultier', 'Givenchy', 'Armani', 'Tom Ford', 'Creed', 'Xerjoff'];

// Guidage selon la raison d'échec remontée par l'IA (failureReason).
// Clés dynamiques : arbre scan.hint* protégé par preservePatterns (§23.9).
type FailureHintKey =
  | 'scan.hintBlur'
  | 'scan.hintGlare'
  | 'scan.hintLabelUnreadable'
  | 'scan.hintBadFraming'
  | 'scan.hintNotAPerfume';
const FAILURE_HINT_KEYS: Record<string, FailureHintKey> = {
  blur: 'scan.hintBlur',
  glare: 'scan.hintGlare',
  label_unreadable: 'scan.hintLabelUnreadable',
  bad_framing: 'scan.hintBadFraming',
  not_a_perfume: 'scan.hintNotAPerfume',
};

interface Props {
  scanResult: ScanResult;
  reason: 'low-confidence' | 'empty-response' | 'manual';
  onSearch: (marque: string, nom: string, typeParfum: string | null, volumeMl: number | null) => void;
  onRescan: () => void;
  onReset: () => void;
}

export function ScanClarify({ scanResult, reason, onSearch, onRescan, onReset }: Props) {
  const { theme, resolvedMode } = useTheme();
  const s = useMemo(() => getStyles(theme), [theme]);
  const { t } = useTranslation('common');
  const keyboardAppearance = resolvedMode === 'dark' ? 'dark' : 'light';
  const [marque, setMarque] = useState(scanResult.marque ?? '');
  const [nom, setNom] = useState(scanResult.nom ?? '');
  const [typeParfum, setTypeParfum] = useState(scanResult.typeParfum ?? '');
  const [volumeMl, setVolumeMl] = useState(scanResult.volumeMl ? String(scanResult.volumeMl) : '');

  const isValid = marque.trim().length > 0 || nom.trim().length > 0;
  // Hint de prise de vue pour toute lecture IA en échec (empty-response OU low-confidence).
  const hint = reason !== 'manual' && scanResult.failureReason && scanResult.failureReason !== 'none'
    ? t(FAILURE_HINT_KEYS[scanResult.failureReason])
    : undefined;
  const notAPerfume = reason === 'empty-response' && scanResult.failureReason === 'not_a_perfume';

  return (
    <KeyboardAvoidingView
      style={s.flex}
      behavior="padding"
    >
    <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">
      <View style={s.iconWrap}>
        <Ionicons name="bulb-outline" size={48} color={theme.colors.secondary} />
      </View>
      {reason === 'manual' ? (
        <>
          <Text style={s.title}>{t('clarify.manualTitle')}</Text>
          <Text style={s.desc}>{t('clarify.manualDesc')}</Text>
        </>
      ) : notAPerfume ? (
        <>
          <Text style={s.title}>{t('clarify.notPerfumeTitle')}</Text>
          <Text style={s.desc}>{t('clarify.notPerfumeDesc')}</Text>
        </>
      ) : reason === 'empty-response' ? (
        <>
          <Text style={s.title}>{t('clarify.nothingReadTitle')}</Text>
          <Text style={s.desc}>{t('clarify.nothingReadDesc')}</Text>
        </>
      ) : (
        <>
          <Text style={s.title}>{t('clarify.helpTitle')}</Text>
          <Text style={s.desc}>{t('clarify.helpDesc')}</Text>
        </>
      )}

      {hint ? <Text style={s.hint}>{hint}</Text> : null}

      {reason !== 'manual' && (
        <Pressable style={s.retakeBtn} onPress={onRescan} accessibilityRole="button" accessibilityLabel={t('scan.retakePhoto')}>
          <Ionicons name="camera-outline" size={18} color={textOn(theme.colors.primary)} style={{ marginRight: 8 }} />
          <Text style={s.retakeText}>{t('scan.retakePhoto')}</Text>
        </Pressable>
      )}

      <View style={s.fields}>
        <Text style={s.fieldLabel}>{t('clarify.brandField')}</Text>
        <TextInput style={s.input} value={marque} onChangeText={setMarque} placeholder={scanResult.marque ?? t('clarify.brandPlaceholder')} placeholderTextColor={theme.colors.textMuted} keyboardAppearance={keyboardAppearance} />
        <Text style={s.fieldLabel}>{t('clarify.nameField')}</Text>
        <TextInput style={s.input} value={nom} onChangeText={setNom} placeholder={scanResult.nom ?? t('clarify.namePlaceholder')} placeholderTextColor={theme.colors.textMuted} keyboardAppearance={keyboardAppearance} />
        <Text style={s.fieldLabel}>{t('clarify.typeField')}</Text>
        <View style={s.picker}>
          {['', 'Parfum', 'Eau de Parfum', 'Eau de Toilette', 'Extrait', 'Eau de Cologne'].map(val => (
            <Pressable key={val} style={[s.pickItem, typeParfum === val && s.pickActive]} onPress={() => setTypeParfum(val)}>
              <Text style={[s.pickText, typeParfum === val && s.pickTextActive]}>{val || t('clarify.broadSearch')}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={s.fieldLabel}>{t('clarify.volumeField')}</Text>
        <TextInput style={s.input} value={volumeMl} onChangeText={setVolumeMl} placeholder={scanResult.volumeMl ? `${scanResult.volumeMl} ml` : t('clarify.volumePlaceholder')} placeholderTextColor={theme.colors.textMuted} keyboardType="numeric" keyboardAppearance={keyboardAppearance} />
      </View>

      <View style={s.chips}>
        {POPULAR_BRANDS.map(b => (
          <Pressable key={b} style={s.chip} onPress={() => setMarque(b)}><Text style={s.chipText}>{b}</Text></Pressable>
        ))}
      </View>

      <Pressable style={[s.cta, !isValid && s.ctaDisabled]} onPress={() => {
        const v = Number(volumeMl);
        onSearch(marque.trim(), nom.trim(), typeParfum || null, Number.isFinite(v) ? v : null);
      }} disabled={!isValid}>
        <Ionicons name="search-outline" size={20} color={textOn(theme.colors.primary)} style={{ marginRight: 8 }} />
        <Text style={s.ctaText}>{t('clarify.findCta')}</Text>
      </Pressable>

      <Pressable style={s.resetBtn} onPress={onReset}>
        <Ionicons name={reason === 'manual' ? 'arrow-back-outline' : 'refresh-outline'} size={18} color={theme.colors.textMuted} style={{ marginRight: 6 }} />
        <Text style={s.resetText}>{reason === 'manual' ? t('back') : t('clarify.retryScan')}</Text>
      </Pressable>
    </ScrollView>
    </KeyboardAvoidingView>
  );
}

function getStyles(t: Theme) {
  return {
    flex: { flex: 1 },
    container: { padding: 24, paddingTop: 40, alignItems: 'center' },
    iconWrap: { marginBottom: 16 },
    title: { fontFamily: 'PlayfairDisplay_600SemiBold', fontSize: 20, color: t.colors.text, marginBottom: 8, textAlign: 'center' },
    desc: { fontSize: 14, color: t.colors.textMuted, textAlign: 'center', marginBottom: 24, lineHeight: 20 },
    hint: { fontFamily: 'Inter_400Regular', fontSize: 12, color: t.colors.textMuted, textAlign: 'center', marginBottom: 16, lineHeight: 17, maxWidth: 300 },
    retakeBtn: { flexDirection: 'row', backgroundColor: t.colors.primary, borderRadius: t.radius.base, height: 48, paddingHorizontal: 24, justifyContent: 'center', alignItems: 'center', marginBottom: 20, ...t.shadow.button },
    retakeText: { color: textOn(t.colors.primary), fontFamily: 'Inter_600SemiBold', fontSize: 15 },
    fields: { width: '100%', maxWidth: 360, gap: 8, marginBottom: 16 },
    fieldLabel: { fontSize: 13, fontFamily: 'Inter_500Medium', color: t.colors.text, marginTop: 4 },
    input: { borderRadius: t.radius.base, backgroundColor: t.colors.surface, borderWidth: 1, borderColor: t.colors.border, paddingHorizontal: 12, height: 44, fontSize: 15, color: t.colors.text },
    picker: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    pickItem: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: t.colors.surface2 },
    pickActive: { backgroundColor: t.colors.primarySoft, borderWidth: 1, borderColor: t.colors.primary },
    pickText: { fontSize: 13, color: t.colors.textMuted },
    pickTextActive: { color: t.colors.primary, fontFamily: 'Inter_500Medium' },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center', marginBottom: 24 },
    chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: t.colors.primarySoft },
    chipText: { fontSize: 12, fontFamily: 'Inter_500Medium', color: t.colors.primaryInk },
    cta: { flexDirection: 'row', width: '100%', maxWidth: 360, backgroundColor: t.colors.primary, borderRadius: t.radius.base, height: 48, justifyContent: 'center', alignItems: 'center', ...t.shadow.button },
    ctaDisabled: { opacity: 0.5 },
    ctaText: { color: textOn(t.colors.primary), fontFamily: 'Inter_600SemiBold', fontSize: 16 },
    resetBtn: { flexDirection: 'row', marginTop: 16, alignItems: 'center' },
    resetText: { fontSize: 14, color: t.colors.textMuted },
  } as const;
}