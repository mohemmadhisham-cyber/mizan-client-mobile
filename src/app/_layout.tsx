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
import {
  type ErrorBoundaryProps,
  Stack,
  ThemeProvider as NavigationThemeProvider,
  useRouter,
  useSegments,
} from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

import { IntroOverlay } from '@/components/horizon/intro-overlay';
import { AppError } from '@/components/support/app-error';
import { AppLockScreen } from '@/components/support/app-lock-screen';
import { UpdateRequiredScreen } from '@/components/support/update-required-screen';
import { AppLockedContext, useAppLock } from '@/hooks/use-app-lock';
import { useAuthGate } from '@/hooks/use-auth-gate';
import { useUpdateRequired } from '@/hooks/use-update-required';
import { syncAiConsent } from '@/lib/ai-consent';
import { clearDashboardCache } from '@/services/client-data';
import { wireOnlineManager } from '@/lib/online';
import { AuthProvider, useAuth } from '@/lib/auth-context';
import { navigationTheme, ThemeProvider, useTheme } from '@/theme';
import { horizonColors } from '@/theme/horizon';

import '@/i18n';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
      // A request is always made, connection or not, and fails at once without one. The
      // library's default is to hold it until the connection returns, which leaves a screen
      // on "loading" for ever when the app is opened offline; failing lets the screen say it
      // could not load and offer to try again.
      networkMode: 'always',
      // When the connection returns, what is on screen and out of date is asked for again.
      refetchOnReconnect: true,
    },
  },
});

// Once, when the app starts: the data layer is told when the connection goes and returns.
wireOnlineManager();

function RootNav() {
  const theme = useTheme();
  const { loading, user, signOut } = useAuth();
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

  const lock = useAppLock(userId, loading);
  // This version of the app may be older than the server still accepts.
  const update = useUpdateRequired();
  /** Something is drawn over the whole app: its screens are not to be reached or read out. */
  const blocked = lock.locked || update !== null;
  const hidden = blocked || lock.covered;

  // The camera opens as a full-screen window, which iOS draws above everything else in the
  // app, the lock included. It is closed when the app is blocked, so what blocks it is seen.
  const router = useRouter();
  const onCamera = useSegments()[0] === 'capture';
  useEffect(() => {
    if (blocked && onCamera && router.canGoBack()) router.back();
  }, [blocked, onCamera, router]);

  useEffect(() => {
    // Hold the native splash until the session is resolved, so the auth gate
    // can route to the right place before anything renders (no flash of tabs).
    if (!loading) SplashScreen.hideAsync();
  }, [loading]);

  return (
    <NavigationThemeProvider value={navigationTheme(theme)}>
      {/* While the app is locked its screens are still there under the lock: a screen reader must not reach them. */}
      <View
        style={styles.app}
        accessibilityElementsHidden={hidden}
        importantForAccessibility={hidden ? 'no-hide-descendants' : 'auto'}>
        <AppLockedContext.Provider value={blocked}>
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: theme.colors.background },
            }}>
            <Stack.Screen name="capture" options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
          </Stack>
        </AppLockedContext.Provider>
      </View>
      {update ? (
        // Before the lock: a version that cannot be used is not worth unlocking.
        <View style={StyleSheet.absoluteFill} accessibilityViewIsModal>
          <UpdateRequiredScreen storeUrl={update.storeUrl} />
        </View>
      ) : lock.locked && userId ? (
        <View style={StyleSheet.absoluteFill} accessibilityViewIsModal>
          <AppLockScreen userId={userId} onUnlocked={lock.unlock} onSignOut={() => void signOut()} />
        </View>
      ) : lock.covered ? (
        // Out of sight with the lock on: nothing of the app is drawn until the phone has been asked.
        <View style={[StyleSheet.absoluteFill, { backgroundColor: horizonColors(theme.colors).field }]} />
      ) : null}
      <IntroOverlay ready={!loading} />
    </NavigationThemeProvider>
  );
}

const styles = StyleSheet.create({ app: { flex: 1 } });

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
