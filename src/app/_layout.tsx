import { ThemeProvider as NavigationThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';
import { navigationTheme, ThemeProvider, useTheme } from '@/theme';

SplashScreen.preventAutoHideAsync();

function ThemedApp() {
  const theme = useTheme();
  return (
    <NavigationThemeProvider value={navigationTheme(theme)}>
      <AnimatedSplashOverlay />
      <AppTabs />
    </NavigationThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <ThemedApp />
    </ThemeProvider>
  );
}
