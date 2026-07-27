import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import Ionicons from '@react-native-vector-icons/ionicons/static';
import { useTheme, type Theme } from '../../theme/ThemeContext';
import { getParfumVerdicts, type ParfumVerdict } from '../../services/community';
import { hapticsLight } from '../../services/haptics';
import { VERDICT_OPTIONS } from '../../utils/verdicts';

const VERDICT_ICON: Record<string, string> = { love: 'heart', like: 'thumbs-up', meh: 'remove', dislike: 'thumbs-down' };
const VERDICT_TOKEN: Record<string, 'deal' | 'fair' | 'textMuted' | 'overpriced'> = { love: 'deal', like: 'fair', meh: 'textMuted', dislike: 'overpriced' };

interface Props {
  parfumId: string;
  onOpenProfiles: (verdicts: ParfumVerdict[]) => void;
}

export default function CommunityVerdicts({ parfumId, onOpenProfiles }: Props) {
  const { theme } = useTheme();
  const s = useMemo(() => getStyles(theme), [theme]);
  const router = useRouter();
  const [verdicts, setVerdicts] = useState<ParfumVerdict[]>([]);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    setLoading(true);
    getParfumVerdicts(parfumId).then((v) => {
      if (mountedRef.current) { setVerdicts(v); setLoading(false); }
    });
    return () => { mountedRef.current = false; };
  }, [parfumId]);

  const handlePress = useCallback(() => {
    hapticsLight();
    onOpenProfiles(verdicts);
  }, [verdicts, onOpenProfiles]);

  if (loading || verdicts.length === 0) return null;

  const positive = verdicts.filter(v => v.verdict === 'love' || v.verdict === 'like');
  const negative = verdicts.filter(v => v.verdict === 'dislike');

  const positiveLabel = buildLabel(positive, 'adore');
  const negativeLabel = negative.length > 0 ? buildLabel(negative, 'pas convaincu') : null;

  return (
    <View style={s.container}>
      <View style={s.sectionTitle}>
        <View style={[s.sectionIconWrap, { backgroundColor: theme.colors.primarySoft }]}>
          <Ionicons name="people-outline" size={14} color={theme.colors.primaryInk} />
        </View>
        <Text style={s.sectionTitleText}>La communauté</Text>
      </View>

      <Pressable style={s.verdictRow} onPress={handlePress} accessibilityRole="button" accessibilityLabel={positiveLabel}>
        <Ionicons name="heart" size={14} color={theme.colors.deal} />
        <Text style={s.verdictText} maxFontSizeMultiplier={1.3}>{positiveLabel}</Text>
        <Ionicons name="chevron-forward" size={14} color={theme.colors.textMuted} />
      </Pressable>

      {negativeLabel ? (
        <Pressable style={s.verdictRow} onPress={handlePress} accessibilityRole="button" accessibilityLabel={negativeLabel}>
          <Ionicons name="thumbs-down-outline" size={14} color={theme.colors.overpriced} />
          <Text style={[s.verdictText, { color: theme.colors.textMuted }]} maxFontSizeMultiplier={1.3}>{negativeLabel}</Text>
          <Ionicons name="chevron-forward" size={14} color={theme.colors.textMuted} />
        </Pressable>
      ) : null}
    </View>
  );
}

function buildLabel(items: ParfumVerdict[], verb: string): string {
  if (items.length === 0) return '';
  if (items.length === 1) return `${verb === 'adore' ? 'Adoré' : 'Pas convaincu'} par @${items[0].pseudo}`;
  if (items.length === 2) return `${verb === 'adore' ? 'Adoré' : 'Pas convaincus'} par @${items[0].pseudo} et @${items[1].pseudo}`;
  return `${verb === 'adore' ? 'Adoré' : 'Pas convaincus'} par @${items[0].pseudo}, @${items[1].pseudo} et ${items.length - 2} autre${items.length - 2 > 1 ? 's' : ''}`;
}

export function VerdictProfilesSheet({ visible, verdicts, onClose }: { visible: boolean; verdicts: ParfumVerdict[]; onClose: () => void }) {
  const { theme } = useTheme();
  const s = useMemo(() => getSheetStyles(theme), [theme]);
  const router = useRouter();

  const handleProfilePress = useCallback((pseudo: string) => {
    hapticsLight();
    onClose();
    router.push(`/u/${pseudo}`);
  }, [onClose, router]);

  if (!visible) return null;

  return (
    <View style={s.backdrop}>
      <Pressable style={s.backdropPress} onPress={onClose} />
      <View style={s.sheet}>
        <View style={s.handle} />
        <Text style={s.sheetTitle}>Verdicts de la communauté</Text>
        <ScrollView style={s.sheetScroll} showsVerticalScrollIndicator={false}>
          {verdicts.map((v, i) => {
            const token = VERDICT_TOKEN[v.verdict] ?? 'textMuted';
            const icon = VERDICT_ICON[v.verdict] ?? 'remove';
            const color = theme.colors[token];
            return (
              <Pressable key={`${v.pseudo}-${i}`} style={s.profileRow} onPress={() => handleProfilePress(v.pseudo)} accessibilityRole="button">
                {v.avatar_url ? (
                  <Image source={{ uri: v.avatar_url }} style={s.avatar} contentFit="cover" transition={200} />
                ) : (
                  <View style={[s.avatar, s.avatarPlaceholder]}>
                    <Text allowFontScaling={false} style={s.avatarInitial}>{v.pseudo.charAt(0).toUpperCase()}</Text>
                  </View>
                )}
                <Text style={s.pseudo}>@{v.pseudo}</Text>
                <View style={s.verdictBadge}>
                  <Ionicons name={icon as never} size={12} color={color} />
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
}

function getStyles(t: Theme) {
  return {
    container: { marginTop: 24 },
    sectionTitle: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8, marginBottom: 12 },
    sectionIconWrap: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center' as const, alignItems: 'center' as const },
    sectionTitleText: { fontFamily: 'PlayfairDisplay_600SemiBold', fontSize: 18, color: t.colors.text },
    verdictRow: {
      flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8,
      backgroundColor: t.colors.surface, borderRadius: t.radius.base, padding: 14, marginBottom: 8, ...t.shadow.card,
    },
    verdictText: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 14, color: t.colors.text },
  } as const;
}

function getSheetStyles(t: Theme) {
  return {
    backdrop: { position: 'absolute' as const, top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'flex-end' as const, backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 100 },
    backdropPress: { position: 'absolute' as const, top: 0, left: 0, right: 0, bottom: 0 },
    sheet: { backgroundColor: t.colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '70%', paddingBottom: 24 },
    handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: t.colors.textMuted, opacity: 0.4, alignSelf: 'center' as const, marginTop: 8, marginBottom: 12 },
    sheetTitle: { fontFamily: 'PlayfairDisplay_600SemiBold', fontSize: 18, color: t.colors.text, paddingHorizontal: 20, marginBottom: 12 },
    sheetScroll: { paddingHorizontal: 20 },
    profileRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 12, paddingVertical: 10 },
    avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: t.colors.surface2 },
    avatarPlaceholder: { justifyContent: 'center' as const, alignItems: 'center' as const, backgroundColor: t.colors.primarySoft },
    avatarInitial: { fontFamily: 'Inter_700Bold', fontSize: 14, color: t.colors.primaryInk },
    pseudo: { flex: 1, fontFamily: 'Inter_500Medium', fontSize: 14, color: t.colors.text },
    verdictBadge: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center' as const, alignItems: 'center' as const },
  } as const;
}
