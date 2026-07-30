// app/_layout.tsx — Root layout (GestureHandler + Auth + SplashScreen + Edge-to-edge)

import { useEffect, useRef, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import * as SplashScreen from 'expo-splash-screen';
import { AuthProvider, useAuthContext } from '../src/contexts/AuthContext';
import { FavorisProvider } from '../src/contexts/FavorisContext';
import { UserParfumProvider } from '../src/contexts/UserParfumContext';
import { PriceAlertsProvider } from '../src/contexts/PriceAlertsContext';
import { ShelvesProvider } from '../src/contexts/ShelvesContext';
import { ThemeProvider, useTheme } from '../src/theme/ThemeContext';
import { ErrorBoundary } from '../src/components/ErrorBoundary';
import OfflineBanner from '../src/components/OfflineBanner';
import { useNetwork } from '../src/hooks/useNetwork';
import { createNotificationChannels, startFcmRegistration } from '../src/services/push';
import { useFonts } from 'expo-font';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold } from '@expo-google-fonts/inter';
import { PlayfairDisplay_500Medium, PlayfairDisplay_600SemiBold, PlayfairDisplay_700Bold, PlayfairDisplay_700Bold_Italic } from '@expo-google-fonts/playfair-display';

try {
  GoogleSignin.configure({
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  });
} catch (e: unknown) { console.warn('[app] GoogleSignin.configure failed:', (e as Error)?.message ?? String(e)); }

SplashScreen.preventAutoHideAsync().catch(() => {});

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { authReady, isAuthenticated, user } = useAuthContext();
  const segments = useSegments();
  const router = useRouter();
  const fcmCleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    createNotificationChannels();
  }, []);

  useEffect(() => {
    if (fcmCleanupRef.current) { fcmCleanupRef.current(); fcmCleanupRef.current = null; }
    if (authReady && isAuthenticated && user) {
      fcmCleanupRef.current = startFcmRegistration(user.uid);
    }
    return () => { if (fcmCleanupRef.current) fcmCleanupRef.current(); };
  }, [authReady, isAuthenticated, user]);

  useEffect(() => {
    if (authReady) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [authReady]);

  useEffect(() => {
    if (!authReady) return;
    if (!segments[0]) return;
    const inAuth = segments[0] === 'auth';
    if (isAuthenticated && inAuth) router.replace('/(tabs)');
  }, [authReady, isAuthenticated, segments]);

  if (!authReady) return null;
  return <>{children}</>;
}

function RootLayoutInner() {
  const { theme } = useTheme();
  const { isOnline } = useNetwork();
  const [reconnected, setReconnected] = useState(false);
  const prevOnlineRef = useRef(true);

  useEffect(() => {
    if (isOnline && !prevOnlineRef.current) {
      setReconnected(true);
      const t = setTimeout(() => setReconnected(false), 2500);
      prevOnlineRef.current = true;
      return () => clearTimeout(t);
    }
    prevOnlineRef.current = isOnline;
  }, [isOnline]);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AuthProvider>
        <FavorisProvider>
        <UserParfumProvider>
        <PriceAlertsProvider>
        <ShelvesProvider>
        <AuthGuard>
          <ErrorBoundary>
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.colors.background } }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="auth/login" options={{ animation: 'fade' }} />
            <Stack.Screen name="auth/register" options={{ animation: 'fade' }} />
            <Stack.Screen name="catalog/[id]" options={{ animation: 'slide_from_right', gestureEnabled: true, fullScreenGestureEnabled: true }} />
            <Stack.Screen name="wardrobe/[parfumId]" options={{ animation: 'none' }} />
            <Stack.Screen name="perfumer/[name]" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="brand/[name]" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="settings" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="profile" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="u/[pseudo]" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="u/[pseudo]/shelf/[shelfId]" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="scan" options={{ animation: 'slide_from_bottom' }} />
            <Stack.Screen name="runner" options={{ animation: 'slide_from_bottom' }} />
            <Stack.Screen name="search" options={{ animation: 'fade' }} />
            <Stack.Screen name="history" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="legal" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="privacy" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="delete-account" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="privacy-center" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="admin" options={{ animation: 'slide_from_bottom' }} />
            <Stack.Screen name="scentlist" options={{ animation: 'none' }} />
          </Stack>
          </ErrorBoundary>
        </AuthGuard>
        </ShelvesProvider>
        </PriceAlertsProvider>
        </UserParfumProvider>
        </FavorisProvider>
      </AuthProvider>
      <OfflineBanner visible={!isOnline || reconnected} variant={reconnected ? 'reconnected' : 'offline'} />
    </GestureHandlerRootView>
  );
}

export default function RootLayout() {
  // Chargement des polices AVANT tout rendu — le splash reste visible
  // (preventAutoHideAsync est appelé au niveau module, L22).
  const [fontsLoaded] = useFonts({
    Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold,
    PlayfairDisplay_500Medium, PlayfairDisplay_600SemiBold, PlayfairDisplay_700Bold, PlayfairDisplay_700Bold_Italic,
  });
  if (!fontsLoaded) return null;
  return (
    <ThemeProvider>
      <RootLayoutInner />
    </ThemeProvider>
  );
}
