import { useCallback, useMemo } from 'react';
import { View, Text } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@react-native-vector-icons/ionicons/static';
import { useTheme, type Theme } from '../theme/ThemeContext';
import Button from './Button';

interface Props {
  icon: string;
  description: string;
}

export default function AuthGate({ icon, description }: Props) {
  const { theme } = useTheme();
  const router = useRouter();
  const s = useMemo(() => getStyles(theme), [theme]);

  const goLogin = useCallback(() => {
    router.push('/auth/login');
  }, [router]);

  return (
    <View style={s.wrap}>
      <Ionicons name={icon as never} size={64} color={theme.colors.textMuted} />
      <Text style={s.title}>Connecte-toi</Text>
      <Text style={s.desc} maxFontSizeMultiplier={1.3}>
        {description}
      </Text>
      <Button onPress={goLogin}>Se connecter</Button>
    </View>
  );
}

function getStyles(t: Theme) {
  return {
    wrap: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 32,
    },
    title: {
      fontFamily: 'PlayfairDisplay_600SemiBold',
      fontSize: 20,
      color: t.colors.text,
      marginTop: 12,
    },
    desc: {
      fontFamily: 'Inter_400Regular',
      fontSize: 14,
      color: t.colors.textMuted,
      textAlign: 'center',
      lineHeight: 20,
      marginTop: 6,
      marginBottom: 20,
    },
  } as const;
}
