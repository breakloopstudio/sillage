// src/features/scan/ScanClarify.tsx — Formulaire de correction après low-confidence

import { useState, useMemo } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import Ionicons from "@react-native-vector-icons/ionicons/static";
import { useTheme, type Theme } from '../../theme/ThemeContext';
import { textOn } from '../../utils/contrast';
import type { ScanResult } from '../../models';

const POPULAR_BRANDS = ['Dior', 'Chanel', 'Guerlain', 'Yves Saint Laurent', 'Lancôme', 'Paco Rabanne', 'Jean Paul Gaultier', 'Givenchy', 'Armani', 'Tom Ford', 'Creed', 'Xerjoff'];

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
  const keyboardAppearance = resolvedMode === 'dark' ? 'dark' : 'light';
  const [marque, setMarque] = useState(scanResult.marque ?? '');
  const [nom, setNom] = useState(scanResult.nom ?? '');
  const [typeParfum, setTypeParfum] = useState(scanResult.typeParfum ?? '');
  const [volumeMl, setVolumeMl] = useState(scanResult.volumeMl ? String(scanResult.volumeMl) : '');

  const isValid = marque.trim().length > 0 || nom.trim().length > 0;

  return (
    <KeyboardAvoidingView
      style={s.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'android' ? 0 : 0}
    >
    <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">
      <View style={s.iconWrap}>
        <Ionicons name="bulb-outline" size={48} color={theme.colors.secondary} />
      </View>
      {reason === 'manual' ? (
        <>
          <Text style={s.title}>Recherche manuelle</Text>
          <Text style={s.desc}>Renseigne la marque et le nom du parfum pour le trouver dans notre catalogue.</Text>
        </>
      ) : reason === 'empty-response' ? (
        <>
          <Text style={s.title}>On n'a rien pu lire</Text>
          <Text style={s.desc}>Reprends la photo en cadrant bien l'étiquette, ou saisis le nom ci-dessous.</Text>
        </>
      ) : (
        <>
          <Text style={s.title}>L'IA a besoin d'un coup de pouce</Text>
          <Text style={s.desc}>Elle n'est pas totalement sûre de sa lecture. Vérifie et corrige si besoin :</Text>
        </>
      )}

      {reason !== 'manual' && (
        <Pressable style={s.retakeBtn} onPress={onRescan} accessibilityRole="button" accessibilityLabel="Reprendre la photo">
          <Ionicons name="camera-outline" size={18} color={textOn(theme.colors.primary)} style={{ marginRight: 8 }} />
          <Text style={s.retakeText}>Reprendre la photo</Text>
        </Pressable>
      )}

      <View style={s.fields}>
        <Text style={s.fieldLabel}>Marque</Text>
        <TextInput style={s.input} value={marque} onChangeText={setMarque} placeholder={scanResult.marque ?? 'ex: Dior'} placeholderTextColor={theme.colors.textMuted} keyboardAppearance={keyboardAppearance} />
        <Text style={s.fieldLabel}>Nom du parfum</Text>
        <TextInput style={s.input} value={nom} onChangeText={setNom} placeholder={scanResult.nom ?? 'ex: Sauvage'} placeholderTextColor={theme.colors.textMuted} keyboardAppearance={keyboardAppearance} />
        <Text style={s.fieldLabel}>Type (optionnel)</Text>
        <View style={s.picker}>
          {['', 'Parfum', 'Eau de Parfum', 'Eau de Toilette', 'Extrait', 'Eau de Cologne'].map(t => (
            <Pressable key={t} style={[s.pickItem, typeParfum === t && s.pickActive]} onPress={() => setTypeParfum(t)}>
              <Text style={[s.pickText, typeParfum === t && s.pickTextActive]}>{t || 'Recherche large'}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={s.fieldLabel}>Volume (ml) — optionnel</Text>
        <TextInput style={s.input} value={volumeMl} onChangeText={setVolumeMl} placeholder={scanResult.volumeMl ? `${scanResult.volumeMl} ml` : 'ex: 100'} placeholderTextColor={theme.colors.textMuted} keyboardType="numeric" keyboardAppearance={keyboardAppearance} />
      </View>

      <View style={s.chips}>
        {POPULAR_BRANDS.map(b => (
          <Pressable key={b} style={s.chip} onPress={() => setMarque(b)}><Text style={s.chipText}>{b}</Text></Pressable>
        ))}
      </View>

      <Pressable style={[s.cta, !isValid && s.ctaDisabled]} onPress={() => onSearch(marque.trim(), nom.trim(), typeParfum || null, volumeMl ? Number(volumeMl) : null)} disabled={!isValid}>
        <Ionicons name="search-outline" size={20} color={textOn(theme.colors.primary)} style={{ marginRight: 8 }} />
        <Text style={s.ctaText}>Trouver ce parfum</Text>
      </Pressable>

      <Pressable style={s.resetBtn} onPress={onReset}>
        <Ionicons name={reason === 'manual' ? 'arrow-back-outline' : 'refresh-outline'} size={18} color={theme.colors.textMuted} style={{ marginRight: 6 }} />
        <Text style={s.resetText}>{reason === 'manual' ? 'Retour' : 'Réessayer le scan'}</Text>
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
    retakeBtn: { flexDirection: 'row', backgroundColor: t.colors.primary, borderRadius: t.radius.base, height: 48, paddingHorizontal: 24, justifyContent: 'center', alignItems: 'center', marginBottom: 20, ...t.shadow.button },
    retakeText: { color: textOn(t.colors.primary), fontFamily: 'Inter_600SemiBold', fontSize: 15 },
    fields: { width: '100%', maxWidth: 360, gap: 8, marginBottom: 16 },
    fieldLabel: { fontSize: 13, fontFamily: 'Inter_500Medium', color: t.colors.text, marginTop: 4 },
    input: { borderRadius: t.radius.base, backgroundColor: t.colors.surface, borderWidth: 1, borderColor: t.colors.border, paddingHorizontal: 12, height: 44, fontSize: 15, color: t.colors.text },
    picker: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    pickItem: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: t.colors.surface2 },
    pickActive: { backgroundColor: t.colors.violetSoft, borderWidth: 1, borderColor: t.colors.primary },
    pickText: { fontSize: 13, color: t.colors.textMuted },
    pickTextActive: { color: t.colors.primary, fontFamily: 'Inter_500Medium' },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center', marginBottom: 24 },
    chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: t.colors.violetSoft },
    chipText: { fontSize: 12, fontFamily: 'Inter_500Medium', color: t.colors.violetInk },
    cta: { flexDirection: 'row', width: '100%', maxWidth: 360, backgroundColor: t.colors.primary, borderRadius: t.radius.base, height: 48, justifyContent: 'center', alignItems: 'center', ...t.shadow.button },
    ctaDisabled: { opacity: 0.5 },
    ctaText: { color: textOn(t.colors.primary), fontFamily: 'Inter_600SemiBold', fontSize: 16 },
    resetBtn: { flexDirection: 'row', marginTop: 16, alignItems: 'center' },
    resetText: { fontSize: 14, color: t.colors.textMuted },
  } as const;
}