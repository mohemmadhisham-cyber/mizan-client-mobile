import {
  IBMPlexSansArabic_400Regular,
  IBMPlexSansArabic_500Medium,
  IBMPlexSansArabic_600SemiBold,
  IBMPlexSansArabic_700Bold,
} from '@expo-google-fonts/ibm-plex-sans-arabic';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import { useFonts } from 'expo-font';
import { Stack, ThemeProvider as NavigationThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';

import { useAuthGate } from '@/hooks/use-auth-gate';
import { AuthProvider, useAuth } from '@/lib/auth-context';
import { navigationTheme, ThemeProvider, useTheme } from '@/theme';

import '@/i18n';

SplashScreen.preventAutoHideAsync();

function RootNav() {
  const theme = useTheme();
  const { loading } = useAuth();
  useAuthGate();

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
        }}
      />
    </NavigationThemeProvider>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
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
      <AuthProvider>
        <RootNav />
      </AuthProvider>
    </ThemeProvider>
  );
}
