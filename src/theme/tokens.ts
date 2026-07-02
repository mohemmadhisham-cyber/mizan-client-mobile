import { oklchToColor } from './oklch';

/**
 * Non-color design tokens ported from firm-guide-app's styles.css.
 * Fluid `clamp()` web scales are resolved to fixed mobile values (the clamp
 * lower-bounds, which target small viewports).
 */

// Border radius — CSS base --radius: 0.75rem (12px), sm/md offsets, xl..4xl.
export const radius = {
  sm: 8,
  md: 10,
  lg: 12,
  xl: 16,
  '2xl': 20,
  '3xl': 24,
  '4xl': 28,
  full: 9999,
} as const;

// Spacing rhythm. gutter/section mirror the CSS layout variables.
export const spacing = {
  none: 0,
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  '2xl': 32,
  '3xl': 40,
  '4xl': 48,
  '5xl': 64,
  gutter: 16,
  section: 40,
} as const;

// Font family names as registered by @expo-google-fonts (loaded in the shell).
// On native, weight is selected by family variant, not by fontWeight, so we
// keep the per-weight names and resolve them in the Text component.
export const fonts = {
  sans: {
    regular: 'Inter_400Regular',
    medium: 'Inter_500Medium',
    semibold: 'Inter_600SemiBold',
    bold: 'Inter_700Bold',
  },
  arabic: {
    regular: 'IBMPlexSansArabic_400Regular',
    medium: 'IBMPlexSansArabic_500Medium',
    semibold: 'IBMPlexSansArabic_600SemiBold',
    bold: 'IBMPlexSansArabic_700Bold',
  },
} as const;

// Type scale (px). letterSpacing converted from em → px at the given size.
export const typography = {
  hero: { fontSize: 44, lineHeight: 45, letterSpacing: -1.1, fontWeight: '700' },
  display: { fontSize: 36, lineHeight: 38, letterSpacing: -0.72, fontWeight: '700' },
  h1: { fontSize: 30, lineHeight: 34, fontWeight: '700' },
  h2: { fontSize: 24, lineHeight: 29, fontWeight: '600' },
  title: { fontSize: 20, lineHeight: 26, fontWeight: '600' },
  body: { fontSize: 16, lineHeight: 24, fontWeight: '400' },
  callout: { fontSize: 15, lineHeight: 22, fontWeight: '400' },
  subhead: { fontSize: 14, lineHeight: 20, fontWeight: '500' },
  footnote: { fontSize: 13, lineHeight: 18, fontWeight: '400' },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '500' },
} as const;

// Motion. Durations in ms; easings as cubic-bezier control points for
// Reanimated's Easing.bezier(...easing.outExpo).
export const duration = {
  fast: 150,
  normal: 250,
  slow: 400,
} as const;

export const easing = {
  outExpo: [0.16, 1, 0.3, 1],
  standard: [0.4, 0, 0.2, 1],
  spring: [0.34, 1.56, 0.64, 1],
} as const;

// Elevation — soft, teal-tinted (CSS shadows use oklch(0.22 0.02 220)).
const shadowColor = oklchToColor([0.22, 0.02, 220]);

export const elevation = {
  xs: { shadowColor, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
  sm: { shadowColor, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 3, elevation: 2 },
  md: { shadowColor, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 4 },
  lg: { shadowColor, shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.14, shadowRadius: 28, elevation: 8 },
  xl: { shadowColor, shadowOffset: { width: 0, height: 24 }, shadowOpacity: 0.18, shadowRadius: 48, elevation: 16 },
} as const;
