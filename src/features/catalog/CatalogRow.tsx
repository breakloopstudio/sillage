// src/features/catalog/CatalogRow.tsx — Rangée éditoriale horizontale avec collapse

import { useState, useMemo, useCallback } from 'react';
import { View, Text, Pressable, ScrollView, type NativeSyntheticEvent, type NativeScrollEvent } from 'react-native';
import Ionicons from '@react-native-vector-icons/ionicons/static';
import { useTheme, type Theme } from '../../theme/ThemeContext';
import SectionHeader from '../../components/SectionHeader';

interface Props {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  children: React.ReactNode;
}

export default function CatalogRow({
  title,
  subtitle,
  actionLabel,
  onAction,
  collapsible = true,
  defaultCollapsed = false,
  children,
}: Props) {
  const { theme } = useTheme();
  const s = useMemo(() => getStyles(theme), [theme]);
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  return (
    <View style={s.container}>
      <Pressable
        style={s.headerRow}
        onPress={collapsible ? () => setCollapsed(!collapsed) : undefined}
      >
        <View style={s.headerTexts}>
          <SectionHeader
            title={title}
            subtitle={subtitle}
            actionLabel={collapsible ? undefined : actionLabel}
            onAction={collapsible ? undefined : onAction}
          />
        </View>
        <View style={s.headerRight}>
          {actionLabel && !collapsible && onAction ? (
            <Pressable onPress={onAction} hitSlop={12} style={s.actionBtn}>
              <Text style={s.actionLabel}>{actionLabel}</Text>
            </Pressable>
          ) : collapsible ? (
            <>
              {actionLabel && onAction && (
                <Pressable onPress={onAction} hitSlop={12} style={s.actionBtn}>
                  <Text style={s.actionLabel}>{actionLabel}</Text>
                </Pressable>
              )}
              <Pressable
                onPress={() => setCollapsed(!collapsed)}
                hitSlop={8}
                style={s.chevron}
              >
                <Ionicons
                  name={collapsed ? 'chevron-forward' : 'chevron-down'}
                  size={18}
                  color={theme.colors.textMuted}
                />
              </Pressable>
            </>
          ) : null}
        </View>
      </Pressable>
      {!collapsed && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.scrollContent}
          style={s.scrollView}
        >
          {children}
        </ScrollView>
      )}
    </View>
  );
}

function getStyles(t: Theme) {
  return {
    container: { marginBottom: t.spacing.xl },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: t.spacing.md,
    },
    headerTexts: { flex: 1 },
    headerRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingLeft: 8,
    },
    actionBtn: { paddingVertical: 4 },
    actionLabel: {
      fontFamily: 'Inter_500Medium',
      fontSize: 13,
      color: t.colors.primary,
    },
    chevron: {
      width: 32,
      height: 32,
      borderRadius: 16,
      justifyContent: 'center',
      alignItems: 'center',
    },
    scrollView: { marginTop: 4 },
    scrollContent: { paddingHorizontal: t.spacing.md, gap: 12 },
  } as const;
}
