import {
  IBMPlexSansArabic_400Regular,
  IBMPlexSansArabic_500Medium,
  IBMPlexSansArabic_600SemiBold,
  IBMPlexSansArabic_700Bold,
} from '@expo-google-fonts/ibm-plex-sans-arabic';
import { IBMPlexMono_400Regular, IBMPlexMono_500Medium } from '@expo-google-fonts/ibm-plex-mono';
import {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
} from '@expo-google-fonts/manrope';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { type ErrorBoundaryProps, Stack, ThemeProvider as NavigationThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef } from 'react';

import { IntroOverlay } from '@/components/horizon/intro-overlay';
import { AppError } from '@/components/support/app-error';
import { useAuthGate } from '@/hooks/use-auth-gate';
import { syncAiConsent } from '@/lib/ai-consent';
import { clearDashboardCache } from '@/services/client-data';
import { wireOnlineManager } from '@/lib/online';
import { AuthProvider, useAuth } from '@/lib/auth-context';
import { navigationTheme, ThemeProvider, useTheme } from '@/theme';

import '@/i18n';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 60_000, retry: 1, refetchOnWindowFocus: false },
  },
});

// Once, when the app starts: requests wait while the phone is offline and are made again when it is back.
wireOnlineManager();

function RootNav() {
  const theme = useTheme();
  const { loading, user } = useAuth();
  useAuthGate();

  // Everything read from the server is cached for a while. When the signed-in
  // person changes (sign out, another sign in), that cache belongs to someone
  // else: drop all of it, so no screen can show the previous person's data.
  const userId = user?.id ?? null;
  const cachedFor = useRef(userId);
  useEffect(() => {
    if (cachedFor.current === userId) return;
    cachedFor.current = userId;
    queryClient.clear();
    // The dashboard keeps its own short cache outside the query cache: that goes too.
    clearDashboardCache();
  }, [userId]);

  // The agreement to AI is kept on the server and on this device. After sign-in
  // the two are brought into line: a withdrawal made on another phone applies
  // here, and an agreement made here before the server kept a record is sent up.
  useEffect(() => {
    if (!userId) return;
    let current = true;
    void syncAiConsent(userId, () => current);
    return () => {
      current = false;
    };
  }, [userId]);

  useEffect(() => {
    // Hold the native splash until the session is resolved, so the auth gate
    // can route to the right place before anything renders (no flash of tabs).
    if (!loading) SplashScreen.hideAsync();
  }, [loading]);

  return (
    <NavigationThemeProvider value={navigationTheme(theme)}>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.colors.background },
        }}>
        <Stack.Screen name="capture" options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
      </Stack>
      <IntroOverlay ready={!loading} />
    </NavigationThemeProvider>
  );
}

/** Expo Router shows this in place of a screen that threw. */
export function ErrorBoundary(props: ErrorBoundaryProps) {
  return <AppError {...props} />;
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    IBMPlexMono_400Regular,
    IBMPlexMono_500Medium,
    IBMPlexSansArabic_400Regular,
    IBMPlexSansArabic_500Medium,
    IBMPlexSansArabic_600SemiBold,
    IBMPlexSansArabic_700Bold,
  });

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <RootNav />
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
