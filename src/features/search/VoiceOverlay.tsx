import { useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  FlatList,
  ActivityIndicator,
  LayoutAnimation,
  useWindowDimensions,
  type LayoutAnimationConfig,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@react-native-vector-icons/ionicons/static';
import { useTheme, type Theme } from '../../theme/ThemeContext';
import ParfumCard from '../../components/ParfumCard';
import type { Parfum } from '../../models';

const SEARCH_BAR_AREA = 62;

export interface VoiceOverlayPhase {
  type: 'listening';
  transcript: string;
}

export interface VoiceOverlayPhaseSearching {
  type: 'searching';
  query?: string;
}

export interface VoiceOverlayPhaseError {
  type: 'error';
  message: string;
  /** Refus définitif du micro : propose un bouton vers les réglages système. */
  showSettings?: boolean;
}

export interface VoiceOverlayPhaseResults {
  type: 'results';
  results: Parfum[];
  query: string;
}

export interface VoiceOverlayPhaseEmpty {
  type: 'empty';
}

export type VoicePhase =
  | VoiceOverlayPhase
  | VoiceOverlayPhaseSearching
  | VoiceOverlayPhaseError
  | VoiceOverlayPhaseResults
  | VoiceOverlayPhaseEmpty;

interface Props {
  visible: boolean;
  phase: VoicePhase;
  onResultPress: (id: string) => void;
  onViewAll: () => void;
  onCancel: () => void;
  onRetry: () => void;
  onOpenSettings?: () => void;
}

const ANIM_CONFIG: LayoutAnimationConfig = {
  duration: 220,
  create: { type: 'easeInEaseOut', property: 'opacity' },
  update: { type: 'easeInEaseOut' },
  delete: { type: 'easeInEaseOut', property: 'opacity' },
};

function ResultSeparator(t: Theme) {
  const s = { height: 1, backgroundColor: t.colors.border, marginHorizontal: t.spacing.md };
  return () => <View style={s} />;
}

export default function VoiceOverlay({
  visible,
  phase,
  onResultPress,
  onViewAll,
  onCancel,
  onRetry,
  onOpenSettings,
}: Props) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const panelTop = insets.top + SEARCH_BAR_AREA;
  const s = useMemo(() => getStyles(theme), [theme]);
  const prevVisible = useRef(false);

  const listMaxHeight = useMemo(
    () => Math.min(windowHeight * 0.42, 360),
    [windowHeight],
  );

  const sep = useMemo(() => ResultSeparator(theme), [theme]);

  useEffect(() => {
    if (visible !== prevVisible.current) {
      LayoutAnimation.configureNext(ANIM_CONFIG);
      prevVisible.current = visible;
    }
  }, [visible]);

  useEffect(() => {
    if (visible) {
      LayoutAnimation.configureNext(ANIM_CONFIG);
    }
  }, [phase.type, visible]);

  if (!visible) return null;

  return (
    <View style={s.root} pointerEvents="box-none">
      <Pressable style={[s.backdrop, { top: panelTop }]} onPress={onCancel} />

      <View style={[s.panel, { top: panelTop }]}>
        {phase.type === 'listening' && (
          <View style={s.listeningRow}>
            <Ionicons name="mic" size={20} color={theme.colors.primary} />
            <View style={s.listeningContent}>
              <Text style={s.listeningLabel} allowFontScaling={false}>À l'écoute…</Text>
              <Text style={s.transcriptText} numberOfLines={3} maxFontSizeMultiplier={1.3}>
                {phase.transcript || 'Parlez maintenant…'}
              </Text>
            </View>
          </View>
        )}

        {phase.type === 'searching' && (
          <View style={s.searchingRow}>
            <ActivityIndicator size="small" color={theme.colors.primary} />
            <View style={s.searchingContent}>
              <Text style={s.searchingLabel}>Recherche en cours</Text>
              {phase.query ? (
                <Text style={s.searchingQuery} numberOfLines={1} maxFontSizeMultiplier={1.3}>
                  « {phase.query} »
                </Text>
              ) : null}
            </View>
          </View>
        )}

        {phase.type === 'error' && (
          <View style={s.centered}>
            <Ionicons name="alert-circle-outline" size={24} color={theme.colors.danger} />
            <Text style={s.errorText} maxFontSizeMultiplier={1.3}>{phase.message}</Text>
            <View style={s.actionRow}>
              <Pressable style={s.ghostBtn} onPress={onCancel} hitSlop={8}>
                <Text style={s.ghostBtnText} allowFontScaling={false}>Annuler</Text>
              </Pressable>
              {phase.showSettings && onOpenSettings ? (
                <Pressable style={s.retryBtn} onPress={onOpenSettings} hitSlop={8} accessibilityRole="button" accessibilityLabel="Ouvrir les réglages">
                  <Text style={s.retryText} allowFontScaling={false}>Réglages</Text>
                </Pressable>
              ) : (
                <Pressable style={s.retryBtn} onPress={onRetry} hitSlop={8}>
                  <Text style={s.retryText} allowFontScaling={false}>Réessayer</Text>
                </Pressable>
              )}
            </View>
          </View>
        )}

        {phase.type === 'empty' && (
          <View style={s.centered}>
            <Ionicons name="search-outline" size={24} color={theme.colors.textMuted} />
            <Text style={s.emptyTitle}>Aucun résultat</Text>
            <Text style={s.emptyDesc}>Essaie une autre formulation.</Text>
            <View style={s.actionRow}>
              <Pressable style={s.ghostBtn} onPress={onCancel} hitSlop={8}>
                <Text style={s.ghostBtnText} allowFontScaling={false}>Annuler</Text>
              </Pressable>
              <Pressable style={s.retryBtn} onPress={onRetry} hitSlop={8}>
                <Text style={s.retryText} allowFontScaling={false}>Réessayer</Text>
              </Pressable>
            </View>
          </View>
        )}

        {phase.type === 'results' && (
          <View style={s.resultsWrap}>
            <View style={s.resultsHeader}>
              <View style={s.resultsHeaderLeft}>
                <Text style={s.resultsQuery} numberOfLines={1} maxFontSizeMultiplier={1.3}>
                  « {phase.query} »
                </Text>
                <Text style={s.resultsCount} allowFontScaling={false}>
                  {phase.results.length} résultat{phase.results.length > 1 ? 's' : ''}
                </Text>
              </View>
              <Pressable onPress={onCancel} style={s.closeBtn} hitSlop={8}>
                <Ionicons name="close" size={20} color={theme.colors.textMuted} />
              </Pressable>
            </View>

            <FlatList
              data={phase.results.slice(0, 5)}
              keyExtractor={(p) => p.id}
              renderItem={({ item }) => (
                <View style={s.resultCard}>
                  <ParfumCard
                    parfum={item}
                    mode="list"
                    onPressOverride={() => onResultPress(item.id)}
                  />
                </View>
              )}
              ItemSeparatorComponent={sep}
              contentContainerStyle={s.resultListContent}
              scrollEnabled={true}
              style={[s.resultList, { maxHeight: listMaxHeight }]}
              showsVerticalScrollIndicator={false}
            />

            <Pressable style={s.viewAllRow} onPress={onViewAll}>
              <Text style={s.viewAllText} allowFontScaling={false}>
                Voir les {phase.results.length} résultats
              </Text>
              <Ionicons name="arrow-forward" size={14} color={theme.colors.primary} />
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
}

function getStyles(t: Theme) {
  return {
    root: {
      position: 'absolute' as const,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 100,
    },
    backdrop: {
      position: 'absolute' as const,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.4)',
    },
    panel: {
      position: 'absolute' as const,
      left: 0,
      right: 0,
      backgroundColor: t.colors.surface,
      borderBottomLeftRadius: t.radius.card,
      borderBottomRightRadius: t.radius.card,
      ...t.shadow.elevated,
      maxHeight: '55%' as const,
      overflow: 'hidden' as const,
    },

    // ── Listening ──
    listeningRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: t.spacing.base,
      paddingHorizontal: t.spacing.md,
      paddingVertical: t.spacing.md,
    },
    listeningContent: { flex: 1 },
    listeningLabel: {
      fontFamily: 'Inter_500Medium',
      fontSize: 12,
      color: t.colors.primary,
      textTransform: 'uppercase' as const,
      letterSpacing: 1,
      marginBottom: 4,
    },
    transcriptText: {
      fontFamily: 'Inter_400Regular',
      fontSize: 16,
      color: t.colors.text,
      lineHeight: 22,
    },

    // ── Searching ──
    searchingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing.base,
      paddingHorizontal: t.spacing.md,
      paddingVertical: t.spacing.md + 2,
    },
    searchingContent: { flex: 1 },
    searchingLabel: {
      fontFamily: 'Inter_500Medium',
      fontSize: 14,
      color: t.colors.text,
      marginBottom: 2,
    },
    searchingQuery: {
      fontFamily: 'Inter_400Regular',
      fontSize: 13,
      color: t.colors.textMuted,
    },

    // ── Shared: centered states ──
    centered: {
      alignItems: 'center' as const,
      paddingVertical: t.spacing.xl + 4,
      paddingHorizontal: t.spacing.md,
      gap: t.spacing.sm,
    },
    errorText: {
      fontFamily: 'Inter_400Regular',
      fontSize: 14,
      color: t.colors.overpricedInk,
      textAlign: 'center' as const,
      paddingHorizontal: t.spacing.sm,
    },
    actionRow: {
      flexDirection: 'row',
      gap: t.spacing.sm,
      marginTop: t.spacing.sm,
    },
    ghostBtn: {
      paddingHorizontal: t.spacing.md,
      paddingVertical: t.spacing.sm + 2,
      borderRadius: t.radius.base,
      minWidth: 88,
      alignItems: 'center' as const,
    },
    ghostBtnText: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 14,
      color: t.colors.textMuted,
    },
    retryBtn: {
      paddingHorizontal: t.spacing.md + 2,
      paddingVertical: t.spacing.sm + 2,
      borderRadius: t.radius.base,
      backgroundColor: t.colors.primarySoft,
      minWidth: 100,
      alignItems: 'center' as const,
    },
    retryText: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 14,
      color: t.colors.primary,
    },
    emptyTitle: {
      fontFamily: 'PlayfairDisplay_600SemiBold',
      fontSize: 16,
      color: t.colors.text,
    },
    emptyDesc: {
      fontFamily: 'Inter_400Regular',
      fontSize: 13,
      color: t.colors.textMuted,
    },

    // ── Results ──
    resultsWrap: {
    },
    resultsHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      paddingHorizontal: t.spacing.md,
      paddingTop: t.spacing.md,
      paddingBottom: t.spacing.sm,
    },
    resultsHeaderLeft: {
      flex: 1,
      marginRight: t.spacing.sm,
    },
    resultsQuery: {
      fontFamily: 'PlayfairDisplay_600SemiBold',
      fontSize: 18,
      color: t.colors.text,
      lineHeight: 22,
    },
    resultsCount: {
      fontFamily: 'Inter_400Regular',
      fontSize: 12,
      color: t.colors.textMuted,
      marginTop: 2,
    },
    closeBtn: {
      width: 44,
      height: 44,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      marginTop: -4,
    },
    resultList: {
    },
    resultListContent: {
      paddingHorizontal: t.spacing.md,
      paddingBottom: t.spacing.xs,
    },
    resultCard: {
      paddingVertical: 4,
    },
    viewAllRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: t.spacing.base + 2,
      borderTopWidth: 1,
      borderTopColor: t.colors.border,
      minHeight: 44,
    },
    viewAllText: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 14,
      color: t.colors.primary,
    },
  } as const;
}
