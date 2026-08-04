// src/components/ErrorBoundary.tsx — Barrière d'erreur React (theme-aware via wrapper fonctionnel)

import React, { useMemo } from 'react';
import { View, Text, Pressable } from 'react-native';
import Ionicons from "@react-native-vector-icons/ionicons/static";
import i18next from 'i18next';
import { useTheme, type Theme } from '../theme/ThemeContext';
import { textOn } from '../utils/contrast';

interface Props { children: React.ReactNode; }
interface State { hasError: boolean; error: Error | null; }

interface InnerProps extends Props {
  s: ReturnType<typeof getStyles>;
  dangerColor: string;
}

function getStyles(t: Theme) {
  return {
    container: { flex: 1, justifyContent: 'center' as const, alignItems: 'center' as const, padding: 32, backgroundColor: t.colors.background },
    title: { fontFamily: 'PlayfairDisplay_700Bold' as const, fontSize: 24, color: t.colors.text, marginTop: 16 },
    desc: { fontSize: 15, color: t.colors.textMuted, textAlign: 'center' as const, marginTop: 8, lineHeight: 22 },
    btn: { marginTop: 24, backgroundColor: t.colors.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: t.radius.base, ...t.shadow.button },
    btnText: { color: textOn(t.colors.primary), fontFamily: 'Inter_600SemiBold' as const, fontSize: 16 },
  } as const;
}

class ErrorBoundaryInner extends React.Component<InnerProps, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  handleReset = () => this.setState({ hasError: false, error: null });

  render() {
    const { s, dangerColor } = this.props;
    if (this.state.hasError) {
      return (
        <View style={s.container}>
          <Ionicons name="alert-circle-outline" size={64} color={dangerColor} />
          <Text style={s.title}>{i18next.t('errorBoundary.title')}</Text>
          <Text style={s.desc}>{i18next.t('errorBoundary.desc')}</Text>
          <Pressable style={s.btn} onPress={this.handleReset}>
            <Text style={s.btnText}>{i18next.t('errorBoundary.retry')}</Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}

export function ErrorBoundary({ children }: Props) {
  const { theme } = useTheme();
  const s = useMemo(() => getStyles(theme), [theme]);
  return (
    <ErrorBoundaryInner s={s} dangerColor={theme.colors.danger}>
      {children}
    </ErrorBoundaryInner>
  );
}
