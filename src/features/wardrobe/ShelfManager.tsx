// src/features/wardrobe/ShelfManager.tsx

import { useState, useMemo, useCallback } from 'react';
import { View, Text, Pressable, TextInput, Alert } from 'react-native';
import Ionicons from '@react-native-vector-icons/ionicons/static';
import { useTheme, type Theme } from '../../theme/ThemeContext';
import { textOn } from '../../utils/contrast';
import { hapticsLight } from '../../services/haptics';
import type { Shelf } from '../../models/wardrobe.interface';

const SHELF_COLORS_LIGHT = ['#6C3ED9', '#C8945A', '#0D9488', '#D97706', '#E04444', '#2563EB', '#059669', '#7C3AED'];
const SHELF_COLORS_DARK  = ['#8B6CF6', '#D4A960', '#2DD4BF', '#F59E0B', '#EF4444', '#60A5FA', '#34D399', '#A78BFA'];
const SHELF_ICONS = ['sunny-outline', 'moon-outline', 'briefcase-outline', 'rose-outline', 'gift-outline', 'star-outline', 'leaf-outline', 'sparkles-outline', 'water-outline', 'flame-outline', 'snow-outline', 'musical-notes-outline'] as const;

interface Props {
  visible: boolean;
  shelves: Shelf[];
  orphanCount: number;
  onClose: () => void;
  onCreate: (name: string, icon?: string, color?: string) => void;
  onRename: (shelfId: string, name: string) => void;
  onDelete: (shelfId: string) => void;
}

export default function ShelfManager({ visible, shelves, orphanCount, onClose, onCreate, onRename, onDelete }: Props) {
  const { theme, resolvedMode } = useTheme();
  const s = useMemo(() => getStyles(theme), [theme]);
  const keyboardAppearance = resolvedMode === 'dark' ? 'dark' : 'light';
  const [newName, setNewName] = useState('');
  const [selectedIcon, setSelectedIcon] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const shelfColors = resolvedMode === 'dark' ? SHELF_COLORS_DARK : SHELF_COLORS_LIGHT;

  const handleCreate = useCallback(() => {
    if (!newName.trim()) return;
    hapticsLight();
    onCreate(newName.trim(), selectedIcon ?? undefined, selectedColor ?? undefined);
    setNewName('');
    setSelectedIcon(null);
    setSelectedColor(null);
  }, [newName, selectedIcon, selectedColor, onCreate]);

  const handleDelete = useCallback((shelfId: string, shelfName: string) => {
    Alert.alert(
      'Supprimer l\'étagère',
      `« ${shelfName} » sera supprimée. Les parfums ne seront pas effacés, ils perdront juste cette étagère.`,
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Supprimer', style: 'destructive', onPress: () => onDelete(shelfId) },
      ]
    );
  }, [onDelete]);

  if (!visible) return null;

  return (
    <View style={s.backdrop}>
      <Pressable style={s.backdropTouch} onPress={onClose} />
      <View style={s.modal}>
        <View style={s.header}>
          <Text style={s.title}>Gérer mes étagères</Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <Ionicons name="close" size={24} color={theme.colors.text} />
          </Pressable>
        </View>

        <View style={s.list}>
          {shelves.map(sh => (
            <View key={sh.id} style={s.shelfRow}>
              {editingId === sh.id ? (
                <View style={s.editRow}>
                  <TextInput
                    style={s.editInput}
                    value={editName}
                    onChangeText={setEditName}
                    keyboardAppearance={keyboardAppearance}
                    autoFocus
                    onSubmitEditing={() => {
                      if (editName.trim()) onRename(sh.id, editName.trim());
                      setEditingId(null);
                    }}
                    onBlur={() => setEditingId(null)}
                  />
                </View>
              ) : (
                <>
                  <View style={s.shelfInfo}>
                    {sh.icon && <Ionicons name={sh.icon as never} size={16} color={sh.color ?? theme.colors.primary} />}
                    {sh.color && <View style={[s.colorDot, { backgroundColor: sh.color }]} />}
                    <Text style={s.shelfName}>{sh.name}</Text>
                  </View>
                  <View style={s.shelfActions}>
                    <Pressable
                      hitSlop={10}
                      onPress={() => { setEditingId(sh.id); setEditName(sh.name); }}
                    >
                      <Ionicons name="pencil-outline" size={16} color={theme.colors.textMuted} />
                    </Pressable>
                    <Pressable hitSlop={10} onPress={() => handleDelete(sh.id, sh.name)}>
                      <Ionicons name="trash-outline" size={16} color={theme.colors.overpriced} />
                    </Pressable>
                  </View>
                </>
              )}
            </View>
          ))}
        </View>

        <View style={s.createSection}>
          <Text style={s.sectionLabel}>Nouvelle étagère</Text>
          <TextInput
            style={s.input}
            placeholder="Nom de l'étagère"
            placeholderTextColor={theme.colors.textMuted}
            value={newName}
            onChangeText={setNewName}
            keyboardAppearance={keyboardAppearance}
          />

          <Text style={s.miniLabel}>Icône (optionnelle)</Text>
          <View style={s.iconGrid}>
            {SHELF_ICONS.map(icon => (
              <Pressable
                key={icon}
                style={[s.iconBtn, selectedIcon === icon && s.iconBtnActive]}
                onPress={() => setSelectedIcon(selectedIcon === icon ? null : icon)}
              >
                <Ionicons name={icon} size={18} color={selectedIcon === icon ? theme.colors.primaryInk : theme.colors.textMuted} />
              </Pressable>
            ))}
          </View>

          <Text style={s.miniLabel}>Couleur (optionnelle)</Text>
          <View style={s.colorRow}>
            {shelfColors.map(color => (
              <Pressable
                key={color}
                style={[s.colorBtn, { backgroundColor: color }, selectedColor === color && s.colorBtnActive]}
                onPress={() => setSelectedColor(selectedColor === color ? null : color)}
              />
            ))}
          </View>

          <Pressable
            style={[s.createBtn, !newName.trim() && s.createBtnDisabled]}
            onPress={handleCreate}
            disabled={!newName.trim()}
          >
            <Text style={[s.createBtnText, !newName.trim() && s.createBtnTextDisabled]}>Créer l'étagère</Text>
          </Pressable>
        </View>

        <View style={s.orphanRow}>
          <Ionicons name="alert-circle-outline" size={14} color={theme.colors.textMuted} />
          <Text style={s.orphanText}>{orphanCount} parfum{orphanCount !== 1 ? 's' : ''} sans étagère</Text>
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
      zIndex: 60,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    } as const,
    backdropTouch: {
      ...({ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)' } as const),
    },
    modal: {
      backgroundColor: t.colors.surface,
      borderRadius: t.radius.card,
      padding: 20,
      width: '100%',
      maxWidth: 400,
      maxHeight: '80%',
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    },
    title: {
      fontFamily: 'PlayfairDisplay_600SemiBold',
      fontSize: 20,
      color: t.colors.text,
    },
    list: {
      marginBottom: 16,
    },
    shelfRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 10,
      borderBottomWidth: 0.5,
      borderBottomColor: t.colors.border,
    },
    editRow: {
      flex: 1,
    },
    editInput: {
      fontFamily: 'Inter_400Regular',
      fontSize: 14,
      color: t.colors.text,
      borderBottomWidth: 1,
      borderBottomColor: t.colors.primary,
      paddingVertical: 4,
    },
    shelfInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    colorDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
    },
    shelfName: {
      fontFamily: 'Inter_500Medium',
      fontSize: 14,
      color: t.colors.text,
    },
    shelfActions: {
      flexDirection: 'row',
      gap: 16,
    },
    sectionLabel: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 12,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      color: t.colors.textMuted,
      marginBottom: 8,
    },
    miniLabel: {
      fontFamily: 'Inter_500Medium',
      fontSize: 11,
      color: t.colors.textMuted,
      marginTop: 12,
      marginBottom: 6,
    },
    createSection: {
      marginBottom: 16,
    },
    input: {
      fontFamily: 'Inter_400Regular',
      fontSize: 14,
      color: t.colors.text,
      backgroundColor: t.colors.surface2,
      borderRadius: t.radius.sm,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    iconGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    iconBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: t.colors.surface2,
      justifyContent: 'center',
      alignItems: 'center',
    },
    iconBtnActive: {
      backgroundColor: t.colors.primarySoft,
      borderWidth: 1.5,
      borderColor: t.colors.primary,
    },
    colorRow: {
      flexDirection: 'row',
      gap: 10,
    },
    colorBtn: {
      width: 28,
      height: 28,
      borderRadius: 14,
    },
    colorBtnActive: {
      borderWidth: 3,
      borderColor: t.colors.text,
    },
    createBtn: {
      marginTop: 16,
      backgroundColor: t.colors.primary,
      borderRadius: t.radius.base,
      paddingVertical: 12,
      alignItems: 'center',
    },
    createBtnDisabled: {
      backgroundColor: t.colors.surface2,
    },
    createBtnText: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 14,
      color: textOn(t.colors.primary),
    },
    createBtnTextDisabled: {
      color: t.colors.textMuted,
    },
    orphanRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
    },
    orphanText: {
      fontFamily: 'Inter_400Regular',
      fontSize: 12,
      color: t.colors.textMuted,
    },
  } as const;
}
