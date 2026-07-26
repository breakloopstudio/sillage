import { useMemo, useState, useCallback } from 'react';
import { View, Text, Pressable, TextInput, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import Ionicons from '@react-native-vector-icons/ionicons/static';
import { useTheme, type Theme } from '../../theme/ThemeContext';
import { textOn } from '../../utils/contrast';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { hapticsLight, hapticsSuccess, hapticsError } from '../../services/haptics';
import type { PossessionType } from '../../models/user-parfum.interface';

const POSSESSION_OPTIONS: { type: PossessionType; label: string }[] = [
  { type: 'bottle', label: 'Flacon' },
  { type: 'decant', label: 'Décant' },
  { type: 'sample', label: 'Échantillon' },
];

interface Props {
  visible: boolean;
  parfumName?: string;
  parfumBrand?: string | null;
  parfumImageUrl?: string | null;
  onClose: () => void;
  onSelect: (type: PossessionType, sizeMl?: number | null) => Promise<void>;
}

export default function WardrobeAddSheet({
  visible, parfumName, parfumBrand, parfumImageUrl, onClose, onSelect,
}: Props) {
  const { theme, resolvedMode } = useTheme();
  const s = useMemo(() => getStyles(theme), [theme]);
  const keyboardAppearance = resolvedMode === 'dark' ? 'dark' : 'light';
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<PossessionType | null>(null);
  const [sizeMl, setSizeMl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imgFailed, setImgFailed] = useState(false);

  const handleSelect = useCallback((type: PossessionType) => {
    hapticsLight();
    setSelected(type);
    setSizeMl('');
    setError(null);
  }, []);

  const handleConfirm = useCallback(async () => {
    if (!selected || loading) return;
    const ml = selected === 'decant' ? parseFloat(sizeMl) : null;
    if (selected === 'decant' && (!sizeMl || isNaN(ml!) || ml! <= 0)) {
      setError('Veuillez indiquer une taille en ml valide.');
      return;
    }
    hapticsLight();
    setLoading(true);
    setError(null);
    try {
      await onSelect(selected, selected === 'decant' ? ml : null);
      hapticsSuccess();
      setSelected(null);
      setSizeMl('');
      onClose();
    } catch (e) {
      hapticsError();
      setError((e as Error)?.message ?? 'Impossible d\'ajouter à la parfumerie.');
    } finally {
      setLoading(false);
    }
  }, [selected, loading, sizeMl, onSelect, onClose]);

  if (!visible) return null;

  return (
    <View style={s.backdrop}>
      <Pressable style={s.backdropTouch} onPress={onClose} />
      <View style={[s.sheet, { paddingBottom: insets.bottom + 16 }]}>
        <View style={s.handle} />

        <View style={s.header}>
          {parfumImageUrl && !imgFailed ? (
            <Image source={{ uri: parfumImageUrl }} style={s.image} contentFit="cover" transition={200} onError={() => setImgFailed(true)} />
          ) : (
            <View style={s.imagePlaceholder}>
              <Ionicons name="flask-outline" size={22} color={theme.colors.textMuted} />
            </View>
          )}
          <View style={s.headerText}>
            <Text style={s.name} numberOfLines={1}>{parfumName ?? 'Parfum'}</Text>
            {parfumBrand && <Text style={s.brand} numberOfLines={1}>{parfumBrand}</Text>}
          </View>
        </View>

        <Text style={s.sectionLabel}>Type de possession</Text>
        <View style={s.chips}>
          {POSSESSION_OPTIONS.map(o => (
            <Pressable
              key={o.type}
              style={[s.chip, selected === o.type && s.chipActive]}
              onPress={() => handleSelect(o.type)}
            >
              <Text style={[s.chipText, selected === o.type && s.chipTextActive]}>
                {o.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {selected === 'decant' && (
          <View style={s.mlRow}>
            <Text style={s.mlLabel}>Taille (ml)</Text>
            <TextInput
              style={s.mlInput}
              value={sizeMl}
              onChangeText={setSizeMl}
              keyboardType="numeric"
              keyboardAppearance={keyboardAppearance}
              placeholder="Ex: 10"
              placeholderTextColor={theme.colors.textMuted}
              maxLength={5}
            />
          </View>
        )}

        {error && <Text style={s.errorText}>{error}</Text>}

        <Pressable
          style={[s.confirmBtn, ((!selected || (selected === 'decant' && !sizeMl)) || loading) && s.confirmBtnDisabled]}
          onPress={handleConfirm}
          disabled={!selected || (selected === 'decant' && !sizeMl) || loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color={textOn(theme.colors.primary)} />
          ) : (
            <Text style={s.confirmBtnText}>Ajouter à ma parfumerie</Text>
          )}
        </Pressable>

        <Pressable onPress={onClose} style={s.cancelBtn} hitSlop={8}>
          <Text style={s.cancelBtnText}>Annuler</Text>
        </Pressable>
      </View>
    </View>
  );
}

function getStyles(t: Theme) {
  return {
    backdrop: {
      position: 'absolute',
      inset: 0,
      zIndex: 50,
      justifyContent: 'flex-end',
    } as const,
    backdropTouch: {
      ...({ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)' } as const),
    },
    sheet: {
      backgroundColor: t.colors.surface,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingHorizontal: 20,
      paddingTop: 6,
    },
    handle: {
      width: 36,
      height: 5,
      borderRadius: 3,
      backgroundColor: t.colors.border,
      alignSelf: 'center',
      marginTop: 10,
      marginBottom: 16,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: 16,
    },
    image: {
      width: 48,
      height: 48,
      borderRadius: 10,
      backgroundColor: t.colors.surface2,
    },
    imagePlaceholder: {
      width: 48,
      height: 48,
      borderRadius: 10,
      backgroundColor: t.colors.surface2,
      justifyContent: 'center',
      alignItems: 'center',
    },
    headerText: {
      flex: 1,
    },
    name: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 16,
      color: t.colors.text,
    },
    brand: {
      fontFamily: 'Inter_400Regular',
      fontSize: 12,
      textTransform: 'uppercase',
      letterSpacing: 1,
      color: t.colors.textMuted,
      marginTop: 2,
    },
    sectionLabel: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 11,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      color: t.colors.textMuted,
      marginBottom: 10,
    },
    chips: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 8,
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 14,
      paddingVertical: 8,
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
    errorText: {
      fontFamily: 'Inter_400Regular',
      fontSize: 13,
      color: t.colors.overpriced,
      marginBottom: 12,
      textAlign: 'center',
    },
    mlRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: 12,
    },
    mlLabel: {
      fontFamily: 'Inter_500Medium',
      fontSize: 13,
      color: t.colors.textMuted,
    },
    mlInput: {
      flex: 1,
      height: 40,
      borderRadius: 10,
      backgroundColor: t.colors.surface2,
      paddingHorizontal: 12,
      fontFamily: 'Inter_500Medium',
      fontSize: 14,
      color: t.colors.text,
      borderWidth: 1,
      borderColor: t.colors.border,
    },
    confirmBtn: {
      backgroundColor: t.colors.primary,
      borderRadius: 12,
      height: 50,
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: 8,
      ...t.shadow.button,
    },
    confirmBtnDisabled: {
      opacity: 0.5,
      shadowOpacity: 0,
      elevation: 0,
    },
    confirmBtnText: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 15,
      color: textOn(t.colors.primary),
    },
    cancelBtn: {
      alignSelf: 'center',
      marginTop: 12,
      paddingVertical: 8,
    },
    cancelBtnText: {
      fontFamily: 'Inter_500Medium',
      fontSize: 14,
      color: t.colors.textMuted,
    },
  } as const;
}
