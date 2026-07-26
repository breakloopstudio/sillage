import { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import Ionicons from '@react-native-vector-icons/ionicons/static';
import { useTheme, type Theme } from '../../src/theme/ThemeContext';
import { useNavigationChrome } from '../../src/features/navigation/NavigationChromeContext';
import { hapticsLight } from '../../src/services/haptics';
import FavoritesContent from '../../src/features/favorites/FavoritesContent';
import ScentListContent from '../../src/features/scentlist/ScentListContent';

type SelectionSegment = 'favoris' | 'carnet';

export default function SelectionScreen() {
  const { theme } = useTheme();
  const s = useMemo(() => getStyles(theme), [theme]);
  const { segment } = useLocalSearchParams<{ segment?: string }>();
  const [activeSegment, setActiveSegment] = useState<SelectionSegment>(
    segment === 'carnet' ? 'carnet' : 'favoris',
  );
  const { scrollY } = useNavigationChrome();

  useEffect(() => {
    if (segment === 'carnet' || segment === 'favoris') {
      setActiveSegment(segment);
    }
  }, [segment]);

  const handleSegmentTap = useCallback((seg: SelectionSegment) => {
    hapticsLight();
    setActiveSegment(seg);
  }, []);

  return (
    <SafeAreaView edges={['bottom']} style={s.container}>
      <View style={s.header}>
        {(['favoris', 'carnet'] as const).map(seg => {
          const active = activeSegment === seg;
          const icons: Record<SelectionSegment, string> = {
            favoris: 'heart',
            carnet: 'eyedrop',
          };
          const labels: Record<SelectionSegment, string> = {
            favoris: 'Favoris',
            carnet: 'Carnet',
          };
          return (
            <Pressable
              key={seg}
              style={[s.segment, active && s.segmentActive]}
              onPress={() => handleSegmentTap(seg)}
            >
              <Ionicons
                name={icons[seg] as never}
                size={16}
                color={active ? theme.colors.primary : theme.colors.textMuted}
              />
              <Text style={[s.segmentLabel, active && s.segmentLabelActive]} allowFontScaling={false}>
                {labels[seg]}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={{ flex: 1 }}>
        {activeSegment === 'favoris' ? (
          <FavoritesContent scrollY={scrollY} />
        ) : (
          <ScentListContent scrollY={scrollY} />
        )}
      </View>
    </SafeAreaView>
  );
}

function getStyles(t: Theme) {
  return {
    container: { flex: 1, backgroundColor: t.colors.background },
    header: {
      flexDirection: 'row' as const,
      backgroundColor: t.colors.surface2,
      borderRadius: t.radius.base,
      margin: t.spacing.md,
      padding: 4,
    },
    segment: {
      flex: 1,
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      gap: 6,
      paddingVertical: 10,
      borderRadius: t.radius.sm,
      minHeight: 44,
    },
    segmentActive: {
      backgroundColor: t.colors.primarySoft,
    },
    segmentLabel: {
      fontFamily: 'Inter_500Medium',
      fontSize: 13,
      color: t.colors.textMuted,
    },
    segmentLabelActive: {
      color: t.colors.primary,
      fontFamily: 'Inter_700Bold',
    },
  } as const;
}
