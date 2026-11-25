import { DefaultTheme } from 'expo-router';
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useColorScheme } from 'react-native';

import { readStoredThemeMode, storeThemeMode, type ThemeMode } from './mode-storage';
import {
  buildDarkPalette,
  buildLightPalette,
  MIZAN_BRAND,
  type BrandTokens,
  type ColorTokens,
} from './palette';
import {
  duration,
  easing,
  elevation,
  fonts,
  radius,
  spacing,
  typography,
} from './tokens';

export type ColorScheme = 'light' | 'dark';
export type { ThemeMode };

export interface Theme {
  scheme: ColorScheme;
  dark: boolean;
  colors: ColorTokens;
  radius: typeof radius;
  spacing: typeof spacing;
  typography: typeof typography;
  duration: typeof duration;
  easing: typeof easing;
  elevation: typeof elevation;
  fonts: typeof fonts;
}

interface ThemeContextValue {
  theme: Theme;
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  brand: BrandTokens;
  /** Pass a firm's brand to white-label the app; null resets to MIZAN. */
  setBrand: (brand: BrandTokens | null) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme() ?? 'light';
  // Lazy initial read: the saved choice applies from the first frame.
  const [mode, setModeState] = useState<ThemeMode>(readStoredThemeMode);
  const [brand, setBrandState] = useState<BrandTokens>(MIZAN_BRAND);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    storeThemeMode(next);
  }, []);

  const scheme: ColorScheme = mode === 'system' ? (system as ColorScheme) : mode;

  const theme = useMemo<Theme>(() => {
    const colors = scheme === 'dark' ? buildDarkPalette(brand) : buildLightPalette(brand);
    return {
      scheme,
      dark: scheme === 'dark',
      colors,
      radius,
      spacing,
      typography,
      duration,
      easing,
      elevation,
      fonts,
    };
  }, [scheme, brand]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      mode,
      setMode,
      brand,
      setBrand: (next) => setBrandState(next ?? MIZAN_BRAND),
    }),
    [theme, mode, setMode, brand],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
  return ctx.theme;
}

export function useThemeControls(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useThemeControls must be used within a ThemeProvider');
  return ctx;
}

/** Build a React Navigation theme from our palette so nav chrome matches. */
export function navigationTheme(theme: Theme) {
  return {
    dark: theme.dark,
    colors: {
      primary: theme.colors.primary,
      background: theme.colors.background,
      card: theme.colors.card,
      text: theme.colors.foreground,
      border: theme.colors.border,
      notification: theme.colors.danger,
    },
    fonts: DefaultTheme.fonts,
  };
}
