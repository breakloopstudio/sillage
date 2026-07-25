// app/(tabs)/scan.tsx — Scanner (accessible depuis le FAB)

import { useMemo } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScanScreen } from '../src/features/scan/ScanScreen';
import { useTheme, type Theme } from '../src/theme/ThemeContext';

export default function ScanPage() {
  const { theme } = useTheme();
  const s = useMemo(() => getStyles(theme), [theme]);
  return (
    <SafeAreaView style={s.container}>
      <ScanScreen />
    </SafeAreaView>
  );
}

function getStyles(t: Theme) {
  return { container: { flex: 1, backgroundColor: t.colors.background } } as const;
}