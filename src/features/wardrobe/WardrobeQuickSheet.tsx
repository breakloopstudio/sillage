// src/features/wardrobe/WardrobeQuickSheet.tsx

import { useMemo, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Image } from 'expo-image';
import Ionicons from '@react-native-vector-icons/ionicons/static';
import { useTheme, type Theme } from '../../theme/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import StarRating from './StarRating';
import { statusLabel } from '../catalog/useSaveController';
import { hapticsLight } from '../../services/haptics';
import type { UserParfum, UserParfumStatus, Shelf } from '../../models/user-parfum.interface';

const STATUS_OPTIONS: UserParfumStatus[] = ['have', 'had'];

interface Props {
  visible: boolean;
  item: UserParfum | null;
  shelves: Shelf[];
  signatureCount: number;
  onClose: () => void;
  onStatusChange: (status: UserParfumStatus) => void;
  onRatingChange: (rating: number) => void;
  onToggleShelf: (shelfId: string) => void;
  onToggleSignature: () => void;
  onViewMore: () => void;
  onRemove: () => void;
}

export default function WardrobeQuickSheet({
  visible,
  item,
  shelves,
  signatureCount,
  onClose,
  onStatusChange,
  onRatingChange,
  onToggleShelf,
  onToggleSignature,
  onViewMore,
  onRemove,
}: Props) {
  const { theme } = useTheme();
  const s = useMemo(() => getStyles(theme), [theme]);
  const insets = useSafeAreaInsets();
  const [imgFailed, setImgFailed] = useState(false);

  if (!visible || !item) return null;

  return (
    <View style={s.backdrop}>
      <Pressable style={s.backdropTouch} onPress={onClose} />
      <View style={[s.sheet, { paddingBottom: insets.bottom + 16 }]}>
        <View style={s.handle} />

        <View style={s.header}>
          {item.imageUrl && !imgFailed ? (
            <Image source={{ uri: item.imageUrl }} style={s.image} contentFit="cover" transition={200} onError={() => setImgFailed(true)} />
          ) : (
            <View style={s.imagePlaceholder}>
              <Ionicons name="flask-outline" size={22} color={theme.colors.textMuted} />
            </View>
          )}
          <View style={s.headerText}>
            <Text style={s.name} numberOfLines={1}>{item.nom ?? item.parfumId.replace(/_/g, ' ')}</Text>
            {item.marque && <Text style={s.brand} numberOfLines={1}>{item.marque}</Text>}
          </View>
        </View>

        <View style={s.section}>
          <StarRating
            rating={item.rating ?? 0}
            size={28}
            onChange={(r) => { hapticsLight(); onRatingChange(r); }}
          />
        </View>

        <View style={s.section}>
          <Text style={s.sectionLabel}>État</Text>
          <View style={s.chips}>
            {STATUS_OPTIONS.map(o => (
              <Pressable
                key={o}
                style={[s.chip, item.status === o && s.chipActive]}
                onPress={() => { hapticsLight(); onStatusChange(o); }}
              >
                <Text style={[s.chipText, item.status === o && s.chipTextActive]}>
                  {statusLabel(o)}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={s.section}>
          <Pressable
            style={s.signatureRow}
            onPress={() => { hapticsLight(); onToggleSignature(); }}
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

        {shelves.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionLabel}>Étagères</Text>
            <View style={s.chips}>
              {shelves.map(sh => {
                const assigned = item.shelfIds.includes(sh.id);
                return (
                  <Pressable
                    key={sh.id}
                    style={[s.chip, assigned && s.chipActive]}
                    onPress={() => onToggleShelf(sh.id)}
                  >
                    {sh.icon && <Ionicons name={sh.icon as never} size={12} color={assigned ? theme.colors.primaryInk : theme.colors.textMuted} />}
                    <Text style={[s.chipText, assigned && s.chipTextActive]}>{sh.name}</Text>
                    {assigned && <Ionicons name="close" size={12} color={theme.colors.primaryInk} />}
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}

        <View style={s.footer}>
          <Pressable onPress={onViewMore} style={s.viewMore} hitSlop={8}>
            <Text style={s.viewMoreText}>Voir plus...</Text>
            <Ionicons name="chevron-forward" size={14} color={theme.colors.primary} />
          </Pressable>

          <Pressable onPress={onRemove} hitSlop={8}>
            <Text style={s.removeText}>Retirer</Text>
          </Pressable>
        </View>
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
    section: {
      marginBottom: 16,
    },
    signatureRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 6,
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
    sectionLabel: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 11,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      color: t.colors.textMuted,
      marginBottom: 8,
    },
    chips: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
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
    footer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 4,
      paddingTop: 12,
      borderTopWidth: 0.5,
      borderTopColor: t.colors.border,
    },
    viewMore: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
    },
    viewMoreText: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 14,
      color: t.colors.primary,
    },
    removeText: {
      fontFamily: 'Inter_500Medium',
      fontSize: 14,
      color: t.colors.overpriced,
    },
  } as const;
}
