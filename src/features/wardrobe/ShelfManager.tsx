import { useState, useMemo, useCallback, useEffect } from 'react';
import { View, Text, Pressable, TouchableOpacity, TextInput, Alert, BackHandler, KeyboardAvoidingView } from 'react-native';
import Ionicons from '@react-native-vector-icons/ionicons/static';
import DraggableFlatList, { ScaleDecorator } from 'react-native-draggable-flatlist';
import { useTheme, type Theme } from '../../theme/ThemeContext';
import { textOn } from '../../utils/contrast';
import { hapticsLight } from '../../services/haptics';
import type { Shelf } from '../../models/user-parfum.interface';

type DragParams = { item: Shelf; drag: () => void; isActive: boolean; getIndex: () => number | undefined };

const SHELF_COLORS_LIGHT = ['#6C3ED9', '#C8945A', '#0D9488', '#D97706', '#E04444', '#2563EB', '#059669', '#7C3AED'];
const SHELF_COLORS_DARK = ['#8B6CF6', '#D4A960', '#2DD4BF', '#F59E0B', '#EF4444', '#60A5FA', '#34D399', '#A78BFA'];
const SHELF_ICONS = ['sunny-outline', 'moon-outline', 'briefcase-outline', 'rose-outline', 'gift-outline', 'star-outline', 'leaf-outline', 'sparkles-outline', 'water-outline', 'flame-outline', 'snow-outline', 'musical-notes-outline'] as const;
const DESC_MAX = 140;

interface Props {
  visible: boolean;
  shelves: Shelf[];
  orphanCount: number;
  editShelfId?: string | null;
  onClose: () => void;
  onCreate: (name: string, icon?: string, color?: string, description?: string) => void;
  onUpdate: (shelfId: string, data: { name: string; icon: string | null; color: string | null; description: string | null }) => void;
  onReorder: (items: { id: string; order: number }[]) => Promise<void>;
  onDelete: (shelfId: string) => void;
}

export default function ShelfManager({ visible, shelves, orphanCount, editShelfId = null, onClose, onCreate, onUpdate, onReorder, onDelete }: Props) {
  const { theme, resolvedMode } = useTheme();
  const s = useMemo(() => getStyles(theme), [theme]);
  const keyboardAppearance = resolvedMode === 'dark' ? 'dark' : 'light';

  const [local, setLocal] = useState<Shelf[]>(shelves);
  useEffect(() => { setLocal(shelves); }, [shelves]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editIcon, setEditIcon] = useState<string | null>(null);
  const [editColor, setEditColor] = useState<string | null>(null);
  const [editDesc, setEditDesc] = useState('');

  const [newName, setNewName] = useState('');
  const [newIcon, setNewIcon] = useState<string | null>(null);
  const [newColor, setNewColor] = useState<string | null>(null);
  const [newDesc, setNewDesc] = useState('');

  const shelfColors = resolvedMode === 'dark' ? SHELF_COLORS_DARK : SHELF_COLORS_LIGHT;

  useEffect(() => {
    if (!visible) {
      setEditingId(null);
      setNewName(''); setNewIcon(null); setNewColor(null); setNewDesc('');
      return;
    }
    if (editShelfId) {
      const sh = shelves.find((x) => x.id === editShelfId);
      if (sh) startEdit(sh);
    }
  }, [visible, editShelfId]);

  useEffect(() => {
    if (!visible) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { onClose(); return true; });
    return () => sub.remove();
  }, [visible, onClose]);

  const startEdit = useCallback((sh: Shelf) => {
    setEditingId(sh.id);
    setEditName(sh.name);
    setEditIcon(sh.icon);
    setEditColor(sh.color);
    setEditDesc(sh.description ?? '');
  }, []);

  const cancelEdit = useCallback(() => setEditingId(null), []);

  const commitEdit = useCallback(() => {
    if (!editingId || !editName.trim()) return;
    hapticsLight();
    onUpdate(editingId, {
      name: editName.trim(),
      icon: editIcon,
      color: editColor,
      description: editDesc.trim() ? editDesc.trim() : null,
    });
    setEditingId(null);
  }, [editingId, editName, editIcon, editColor, editDesc, onUpdate]);

  const handleCreate = useCallback(() => {
    if (!newName.trim()) return;
    hapticsLight();
    onCreate(newName.trim(), newIcon ?? undefined, newColor ?? undefined, newDesc.trim() ? newDesc.trim() : undefined);
    setNewName(''); setNewIcon(null); setNewColor(null); setNewDesc('');
  }, [newName, newIcon, newColor, newDesc, onCreate]);

  const handleDelete = useCallback((shelfId: string, shelfName: string) => {
    Alert.alert(
      'Supprimer l’étagère',
      `« ${shelfName} » sera supprimée. Les parfums ne seront pas effacés, ils perdront juste cette étagère.`,
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Supprimer', style: 'destructive', onPress: () => onDelete(shelfId) },
      ]
    );
  }, [onDelete]);

  const handleDragEnd = useCallback(({ data }: { data: Shelf[] }) => {
    setLocal(data);
    const items = data.map((sh, i) => ({ id: sh.id, order: i }));
    onReorder(items).catch(() => setLocal(shelves));
  }, [onReorder, shelves]);

  const renderItem = useCallback(({ item, drag, isActive }: DragParams) => {
    const editing = editingId === item.id;
    if (editing) {
      return (
        <ScaleDecorator>
          <View style={[s.row, s.rowEdit]}>
            <View style={s.grip} accessible={false}>
              <View style={s.gripBar} />
              <View style={s.gripBar} />
            </View>
            <View style={s.editBlock}>
              <TextInput
                style={s.editInput}
                value={editName}
                onChangeText={setEditName}
                keyboardAppearance={keyboardAppearance}
                placeholder="Nom de l’étagère"
                placeholderTextColor={theme.colors.textMuted}
                maxLength={40}
                autoFocus
              />
              <TextInput
                style={s.editDescInput}
                value={editDesc}
                onChangeText={setEditDesc}
                keyboardAppearance={keyboardAppearance}
                placeholder="Note (optionnelle)"
                placeholderTextColor={theme.colors.textMuted}
                maxLength={DESC_MAX}
                multiline
                textAlignVertical="top"
              />
              <Text style={s.miniLabel}>Icône</Text>
              <View style={s.iconGrid}>
                {SHELF_ICONS.map((icon) => (
                  <Pressable
                    key={icon}
                    style={[s.iconBtn, editIcon === icon && s.iconBtnActive]}
                    onPress={() => setEditIcon(editIcon === icon ? null : icon)}
                    accessibilityRole="button"
                    accessibilityLabel={icon}
                  >
                    <Ionicons name={icon} size={16} color={editIcon === icon ? theme.colors.primaryInk : theme.colors.textMuted} />
                  </Pressable>
                ))}
              </View>
              <Text style={s.miniLabel}>Couleur</Text>
              <View style={s.colorRow}>
                {shelfColors.map((color) => (
                  <Pressable
                    key={color}
                    style={[s.colorBtn, { backgroundColor: color }, editColor === color && s.colorBtnActive]}
                    onPress={() => setEditColor(editColor === color ? null : color)}
                    accessibilityRole="button"
                    accessibilityLabel={`Couleur ${color}`}
                  />
                ))}
              </View>
              <View style={s.editActions}>
                <Pressable style={s.cancelEditBtn} onPress={cancelEdit} accessibilityRole="button" accessibilityLabel="Annuler la modification">
                  <Text style={s.cancelEditText}>Annuler</Text>
                </Pressable>
                <Pressable
                  style={[s.saveEditBtn, !editName.trim() && s.saveEditBtnDisabled]}
                  onPress={commitEdit}
                  disabled={!editName.trim()}
                  accessibilityRole="button"
                  accessibilityLabel="Enregistrer"
                >
                  <Text style={[s.saveEditText, !editName.trim() && s.saveEditTextDisabled]}>Enregistrer</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </ScaleDecorator>
      );
    }
    return (
      <ScaleDecorator>
        <View style={[s.row, isActive && s.rowActive]}>
          <TouchableOpacity
            onLongPress={drag}
            delayLongPress={250}
            disabled={isActive}
            activeOpacity={0.6}
            style={s.grip}
            accessibilityRole="button"
            accessibilityLabel={`Réorganiser ${item.name}`}
          >
            <View style={s.gripBar} />
            <View style={s.gripBar} />
          </TouchableOpacity>
          <View style={s.shelfInfo}>
            {item.icon && <Ionicons name={item.icon as never} size={16} color={item.color ?? theme.colors.primary} />}
            {item.color && <View style={[s.colorDot, { backgroundColor: item.color }]} />}
            <View style={s.shelfTexts}>
              <Text style={s.shelfName} numberOfLines={1}>{item.name}</Text>
              {item.description ? <Text style={s.shelfTagline} numberOfLines={1}>{item.description}</Text> : null}
            </View>
          </View>
          <Pressable hitSlop={10} disabled={isActive} onPress={() => startEdit(item)} accessibilityRole="button" accessibilityLabel={`Modifier ${item.name}`}>
            <Ionicons name="pencil-outline" size={16} color={theme.colors.textMuted} />
          </Pressable>
          <Pressable hitSlop={10} disabled={isActive} onPress={() => handleDelete(item.id, item.name)} accessibilityRole="button" accessibilityLabel={`Supprimer ${item.name}`}>
            <Ionicons name="trash-outline" size={16} color={theme.colors.overpriced} />
          </Pressable>
        </View>
      </ScaleDecorator>
    );
  }, [editingId, editName, editIcon, editColor, editDesc, shelfColors, theme, s, keyboardAppearance, startEdit, cancelEdit, commitEdit, handleDelete]);

  const footer = useMemo(() => (
    <View style={s.footer}>
      <View style={s.createSection}>
        <Text style={s.sectionLabel}>Nouvelle étagère</Text>
        <TextInput
          style={s.input}
          placeholder="Nom de l’étagère"
          placeholderTextColor={theme.colors.textMuted}
          value={newName}
          onChangeText={setNewName}
          keyboardAppearance={keyboardAppearance}
          maxLength={40}
        />
        <Text style={s.miniLabel}>Note (optionnelle)</Text>
        <TextInput
          style={s.descInput}
          placeholder="Une ligne pour la décrire…"
          placeholderTextColor={theme.colors.textMuted}
          value={newDesc}
          onChangeText={setNewDesc}
          keyboardAppearance={keyboardAppearance}
          maxLength={DESC_MAX}
          multiline
          textAlignVertical="top"
        />
        <Text style={s.miniLabel}>Icône (optionnelle)</Text>
        <View style={s.iconGrid}>
          {SHELF_ICONS.map((icon) => (
            <Pressable
              key={icon}
              style={[s.iconBtn, newIcon === icon && s.iconBtnActive]}
              onPress={() => setNewIcon(newIcon === icon ? null : icon)}
              accessibilityRole="button"
              accessibilityLabel={icon}
            >
              <Ionicons name={icon} size={16} color={newIcon === icon ? theme.colors.primaryInk : theme.colors.textMuted} />
            </Pressable>
          ))}
        </View>
        <Text style={s.miniLabel}>Couleur (optionnelle)</Text>
        <View style={s.colorRow}>
          {shelfColors.map((color) => (
            <Pressable
              key={color}
              style={[s.colorBtn, { backgroundColor: color }, newColor === color && s.colorBtnActive]}
              onPress={() => setNewColor(newColor === color ? null : color)}
              accessibilityRole="button"
              accessibilityLabel={`Couleur ${color}`}
            />
          ))}
        </View>
        <Pressable
          style={[s.createBtn, !newName.trim() && s.createBtnDisabled]}
          onPress={handleCreate}
          disabled={!newName.trim()}
        >
          <Text style={[s.createBtnText, !newName.trim() && s.createBtnTextDisabled]}>Créer l’étagère</Text>
        </Pressable>
      </View>

      <View style={s.orphanRow}>
        <Ionicons name="alert-circle-outline" size={14} color={theme.colors.textMuted} />
        <Text style={s.orphanText}>{orphanCount} parfum{orphanCount !== 1 ? 's' : ''} sans étagère</Text>
      </View>
    </View>
  ), [theme, s, newName, newIcon, newColor, newDesc, shelfColors, orphanCount, keyboardAppearance, handleCreate]);

  if (!visible) return null;

  return (
    <KeyboardAvoidingView style={s.backdrop} behavior="padding">
      <Pressable style={s.backdropTouch} onPress={onClose} />
      <View style={s.modal}>
        <View style={s.header}>
          <Text style={s.title}>Gérer mes étagères</Text>
          <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Fermer">
            <Ionicons name="close" size={24} color={theme.colors.text} />
          </Pressable>
        </View>
        <Text style={s.hint}>Maintiens la poignée pour réorganiser</Text>
        <DraggableFlatList
          data={local}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          onDragEnd={handleDragEnd}
          ListFooterComponent={footer}
          contentContainerStyle={s.listContent}
          style={s.list}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        />
      </View>
    </KeyboardAvoidingView>
  );
}

function getStyles(t: Theme) {
  return {
    backdrop: {
      position: 'absolute' as const,
      inset: 0,
      zIndex: 60,
      justifyContent: 'center' as const,
      alignItems: 'center' as const,
      padding: 20,
    } as const,
    backdropTouch: {
      ...({ position: 'absolute' as const, inset: 0, backgroundColor: 'rgba(0,0,0,0.4)' } as const),
    },
    modal: {
      backgroundColor: t.colors.surface,
      borderRadius: t.radius.card,
      paddingVertical: 20,
      width: '100%',
      maxWidth: 400,
      maxHeight: '85%' as const,
    },
    header: {
      flexDirection: 'row' as const,
      justifyContent: 'space-between' as const,
      alignItems: 'center' as const,
      paddingHorizontal: 20,
    },
    title: {
      fontFamily: 'PlayfairDisplay_600SemiBold',
      fontSize: 20,
      color: t.colors.text,
    },
    hint: {
      fontFamily: 'Inter_400Regular',
      fontSize: 11,
      color: t.colors.textMuted,
      paddingHorizontal: 20,
      marginTop: 4,
      marginBottom: 8,
    },
    list: {
      flex: 1,
    },
    listContent: {
      paddingHorizontal: 20,
      paddingBottom: 20,
    },
    row: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: 8,
      paddingVertical: 10,
      borderBottomWidth: 0.5,
      borderBottomColor: t.colors.border,
    },
    rowActive: {
      backgroundColor: t.colors.primarySoft,
      borderRadius: t.radius.sm,
    },
    rowEdit: {
      alignItems: 'flex-start' as const,
      paddingVertical: 12,
    },
    grip: {
      width: 24,
      minHeight: 44,
      justifyContent: 'center' as const,
      alignItems: 'center' as const,
      gap: 3,
    },
    gripBar: {
      width: 16,
      height: 2,
      borderRadius: 1,
      backgroundColor: t.colors.textMuted,
      opacity: 0.6,
    },
    shelfInfo: {
      flex: 1,
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: 8,
    },
    shelfTexts: {
      flex: 1,
      gap: 1,
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
    shelfTagline: {
      fontFamily: 'PlayfairDisplay_700Bold_Italic',
      fontSize: 12,
      color: t.colors.textMuted,
    },
    editBlock: {
      flex: 1,
      gap: 2,
    },
    editInput: {
      fontFamily: 'Inter_500Medium',
      fontSize: 14,
      color: t.colors.text,
      backgroundColor: t.colors.surface2,
      borderRadius: t.radius.sm,
      paddingHorizontal: 12,
      paddingVertical: 9,
    },
    editDescInput: {
      fontFamily: 'Inter_400Regular',
      fontSize: 13,
      color: t.colors.text,
      backgroundColor: t.colors.surface2,
      borderRadius: t.radius.sm,
      paddingHorizontal: 12,
      paddingVertical: 8,
      minHeight: 48,
      lineHeight: 18,
      marginTop: 6,
    },
    editActions: {
      flexDirection: 'row' as const,
      gap: 8,
      marginTop: 12,
    },
    cancelEditBtn: {
      flex: 1,
      paddingVertical: 10,
      alignItems: 'center' as const,
      borderRadius: t.radius.base,
      backgroundColor: t.colors.surface2,
      minHeight: 44,
    },
    cancelEditText: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 13,
      color: t.colors.textMuted,
    },
    saveEditBtn: {
      flex: 1,
      paddingVertical: 10,
      alignItems: 'center' as const,
      borderRadius: t.radius.base,
      backgroundColor: t.colors.primary,
      minHeight: 44,
    },
    saveEditBtnDisabled: {
      backgroundColor: t.colors.surface2,
    },
    saveEditText: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 13,
      color: textOn(t.colors.primary),
    },
    saveEditTextDisabled: {
      color: t.colors.textMuted,
    },
    footer: {
      paddingTop: 8,
    },
    sectionLabel: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 12,
      textTransform: 'uppercase' as const,
      letterSpacing: 0.8,
      color: t.colors.textMuted,
      marginTop: 8,
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
      borderTopWidth: 0.5,
      borderTopColor: t.colors.border,
      paddingTop: 8,
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
    descInput: {
      fontFamily: 'Inter_400Regular',
      fontSize: 13,
      color: t.colors.text,
      backgroundColor: t.colors.surface2,
      borderRadius: t.radius.sm,
      paddingHorizontal: 12,
      paddingVertical: 10,
      minHeight: 56,
      lineHeight: 19,
    },
    iconGrid: {
      flexDirection: 'row' as const,
      flexWrap: 'wrap' as const,
      gap: 8,
    },
    iconBtn: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: t.colors.surface2,
      justifyContent: 'center' as const,
      alignItems: 'center' as const,
    },
    iconBtnActive: {
      backgroundColor: t.colors.primarySoft,
      borderWidth: 1.5,
      borderColor: t.colors.primary,
    },
    colorRow: {
      flexDirection: 'row' as const,
      flexWrap: 'wrap' as const,
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
      alignItems: 'center' as const,
      minHeight: 44,
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
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      gap: 6,
      paddingTop: 16,
    },
    orphanText: {
      fontFamily: 'Inter_400Regular',
      fontSize: 12,
      color: t.colors.textMuted,
    },
  } as const;
}
