// src/features/scan/ScanError.tsx — Erreur + retry (avec ou sans re-capture)

import { useMemo } from 'react';
import { View, Text, Pressable } from 'react-native';
import Ionicons from "@react-native-vector-icons/ionicons/static";
import { useTranslation } from 'react-i18next';
import { useTheme, type Theme } from '../../theme/ThemeContext';
import { textOn } from '../../utils/contrast';

interface Props {
  message: string;
  onReset: () => void;
  onRetryAnalysis?: () => void;
}

export function ScanError({ message, onReset, onRetryAnalysis }: Props) {
  const { theme } = useTheme();
  const s = useMemo(() => getStyles(theme), [theme]);
  const { t } = useTranslation('common');
  return (
    <View style={s.container}>
      <Ionicons name="alert-circle-outline" size={64} color={theme.colors.danger} />
      <Text style={s.title}>{t('scan.errorOops')}</Text>
      <Text style={s.desc}>{message}</Text>
      {onRetryAnalysis && (
        <Pressable style={s.btn} onPress={onRetryAnalysis}>
          <Ionicons name="refresh-outline" size={20} color={textOn(theme.colors.primary)} style={{ marginRight: 8 }} />
          <Text style={s.btnText}>{t('scan.retryAnalysis')}</Text>
        </Pressable>
      )}
      <Pressable style={onRetryAnalysis ? s.textBtn : s.btn} onPress={onReset}>
        <Ionicons name="camera-outline" size={20} color={onRetryAnalysis ? theme.colors.textMuted : textOn(theme.colors.primary)} style={{ marginRight: 8 }} />
        <Text style={onRetryAnalysis ? s.textBtnText : s.btnText}>{t('scan.newScan')}</Text>
      </Pressable>
    </View>
  );
}

function getStyles(t: Theme) {
  return {
    container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, backgroundColor: t.colors.background },
    title: { fontFamily: 'PlayfairDisplay_600SemiBold', fontSize: 20, color: t.colors.text, marginTop: 16, marginBottom: 8 },
    desc: { fontSize: 14, color: t.colors.textMuted, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
    btn: { flexDirection: 'row', backgroundColor: t.colors.primary, borderRadius: t.radius.base, height: 48, paddingHorizontal: 24, justifyContent: 'center', alignItems: 'center', ...t.shadow.button, marginBottom: 12 },
    btnText: { color: textOn(t.colors.primary), fontFamily: 'Inter_600SemiBold', fontSize: 16 },
    textBtn: { flexDirection: 'row', paddingVertical: 12, paddingHorizontal: 24, alignItems: 'center' },
    textBtnText: { fontSize: 14, fontFamily: 'Inter_500Medium', color: t.colors.textMuted },
  } as const;
}
