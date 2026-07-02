import { oklchToColor, type Oklch } from './oklch';

/**
 * Semantic color palettes, ported 1:1 from firm-guide-app styles.css.
 *
 * White-label: only the four BrandTokens are firm-overridable at runtime; every
 * other semantic token derives from them or is fixed, so a single firm swap
 * re-themes the whole app and dark mode keeps working — matching the web engine.
 */

export interface BrandTokens {
  brand: Oklch;
  brandForeground: Oklch;
  brandAccent: Oklch;
  brandAccentForeground: Oklch;
}

export const MIZAN_BRAND: BrandTokens = {
  brand: [0.46, 0.08, 195],
  brandForeground: [0.99, 0.005, 180],
  brandAccent: [0.7, 0.12, 75],
  brandAccentForeground: [0.24, 0.05, 70],
};

/** Demo firms for white-label verification (from firm-guide-app theme.tsx). */
export const FIRM_PRESETS: Record<string, BrandTokens> = {
  mizan: MIZAN_BRAND,
  'falcon-books': {
    brand: [0.42, 0.14, 260],
    brandForeground: [0.99, 0.005, 260],
    brandAccent: [0.72, 0.13, 75],
    brandAccentForeground: [0.24, 0.05, 70],
  },
  'oasis-advisory': {
    brand: [0.5, 0.13, 160],
    brandForeground: [0.99, 0.005, 160],
    brandAccent: [0.7, 0.14, 55],
    brandAccentForeground: [0.24, 0.05, 60],
  },
};

export interface ColorTokens {
  brand: string;
  brandForeground: string;
  brandAccent: string;
  brandAccentForeground: string;
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  popover: string;
  popoverForeground: string;
  surface: string;
  surfaceForeground: string;
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  muted: string;
  mutedForeground: string;
  accent: string;
  accentForeground: string;
  destructive: string;
  destructiveForeground: string;
  border: string;
  input: string;
  ring: string;
  success: string;
  successForeground: string;
  warning: string;
  warningForeground: string;
  danger: string;
  dangerForeground: string;
  chart1: string;
  chart2: string;
  chart3: string;
  chart4: string;
  chart5: string;
  sidebar: string;
  sidebarForeground: string;
  sidebarPrimary: string;
  sidebarPrimaryForeground: string;
  sidebarAccent: string;
  sidebarAccentForeground: string;
  sidebarBorder: string;
  sidebarRing: string;
}

function brandColors(b: BrandTokens) {
  return {
    brand: oklchToColor(b.brand),
    brandForeground: oklchToColor(b.brandForeground),
    brandAccent: oklchToColor(b.brandAccent),
    brandAccentForeground: oklchToColor(b.brandAccentForeground),
    primary: oklchToColor(b.brand),
    primaryForeground: oklchToColor(b.brandForeground),
  };
}

export function buildLightPalette(b: BrandTokens = MIZAN_BRAND): ColorTokens {
  const brand = brandColors(b);
  return {
    ...brand,
    background: oklchToColor([0.99, 0.004, 95]),
    foreground: oklchToColor([0.22, 0.02, 220]),
    card: oklchToColor([1, 0, 0]),
    cardForeground: oklchToColor([0.22, 0.02, 220]),
    popover: oklchToColor([1, 0, 0]),
    popoverForeground: oklchToColor([0.22, 0.02, 220]),
    surface: oklchToColor([0.975, 0.006, 90]),
    surfaceForeground: oklchToColor([0.22, 0.02, 220]),
    secondary: oklchToColor([0.96, 0.008, 90]),
    secondaryForeground: oklchToColor([0.3, 0.02, 215]),
    muted: oklchToColor([0.965, 0.007, 90]),
    mutedForeground: oklchToColor([0.45, 0.015, 220]),
    accent: oklchToColor([0.95, 0.014, 195]),
    accentForeground: oklchToColor([0.3, 0.04, 200]),
    destructive: oklchToColor([0.58, 0.21, 27]),
    destructiveForeground: oklchToColor([0.99, 0.005, 30]),
    border: oklchToColor([0.92, 0.006, 90]),
    input: oklchToColor([0.92, 0.006, 90]),
    ring: brand.brand,
    success: oklchToColor([0.62, 0.13, 155]),
    successForeground: oklchToColor([0.99, 0.005, 160]),
    warning: oklchToColor([0.76, 0.13, 80]),
    warningForeground: oklchToColor([0.27, 0.05, 70]),
    danger: oklchToColor([0.58, 0.21, 27]),
    dangerForeground: oklchToColor([0.99, 0.005, 30]),
    chart1: oklchToColor([0.48, 0.09, 200]),
    chart2: oklchToColor([0.58, 0.11, 175]),
    chart3: oklchToColor([0.66, 0.13, 150]),
    chart4: oklchToColor([0.74, 0.13, 110]),
    chart5: oklchToColor([0.8, 0.13, 85]),
    sidebar: oklchToColor([0.975, 0.006, 90]),
    sidebarForeground: oklchToColor([0.24, 0.02, 220]),
    sidebarPrimary: brand.brand,
    sidebarPrimaryForeground: brand.brandForeground,
    sidebarAccent: oklchToColor([0.95, 0.014, 195]),
    sidebarAccentForeground: oklchToColor([0.3, 0.04, 200]),
    sidebarBorder: oklchToColor([0.92, 0.006, 90]),
    sidebarRing: brand.brand,
  };
}

export function buildDarkPalette(b: BrandTokens = MIZAN_BRAND): ColorTokens {
  const brand = brandColors(b);
  return {
    ...brand,
    background: oklchToColor([0.16, 0.018, 215]),
    foreground: oklchToColor([0.96, 0.004, 95]),
    card: oklchToColor([0.205, 0.02, 215]),
    cardForeground: oklchToColor([0.96, 0.004, 95]),
    popover: oklchToColor([0.205, 0.02, 215]),
    popoverForeground: oklchToColor([0.96, 0.004, 95]),
    surface: oklchToColor([0.2, 0.02, 215]),
    surfaceForeground: oklchToColor([0.96, 0.004, 95]),
    secondary: oklchToColor([0.26, 0.02, 215]),
    secondaryForeground: oklchToColor([0.96, 0.004, 95]),
    muted: oklchToColor([0.26, 0.02, 215]),
    mutedForeground: oklchToColor([0.72, 0.02, 210]),
    accent: oklchToColor([0.28, 0.03, 200]),
    accentForeground: oklchToColor([0.96, 0.004, 95]),
    destructive: oklchToColor([0.55, 0.22, 27]),
    destructiveForeground: oklchToColor([0.99, 0.005, 30]),
    border: oklchToColor([1, 0, 0, 0.12]),
    input: oklchToColor([1, 0, 0, 0.16]),
    ring: oklchToColor([0.65, 0.09, 190]),
    success: oklchToColor([0.68, 0.14, 155]),
    successForeground: oklchToColor([0.16, 0.018, 215]),
    warning: oklchToColor([0.8, 0.13, 80]),
    warningForeground: oklchToColor([0.2, 0.04, 70]),
    danger: oklchToColor([0.55, 0.22, 27]),
    dangerForeground: oklchToColor([0.99, 0.005, 30]),
    chart1: oklchToColor([0.62, 0.1, 195]),
    chart2: oklchToColor([0.68, 0.12, 175]),
    chart3: oklchToColor([0.74, 0.13, 150]),
    chart4: oklchToColor([0.8, 0.13, 110]),
    chart5: oklchToColor([0.84, 0.12, 85]),
    sidebar: oklchToColor([0.19, 0.02, 215]),
    sidebarForeground: oklchToColor([0.96, 0.004, 95]),
    sidebarPrimary: brand.brand,
    sidebarPrimaryForeground: brand.brandForeground,
    sidebarAccent: oklchToColor([0.26, 0.02, 215]),
    sidebarAccentForeground: oklchToColor([0.96, 0.004, 95]),
    sidebarBorder: oklchToColor([1, 0, 0, 0.1]),
    sidebarRing: oklchToColor([0.65, 0.09, 190]),
  };
}
