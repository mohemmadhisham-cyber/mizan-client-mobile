/**
 * MIZAN design system — ported from the Figma "Mizan" file (design-to-code).
 *
 * Palette: deep-navy brand (#001E40) + mint-green accent (#6BFE9C / dark-green
 * #006D37 for text), on a light lavender-white (#F9F9FE). Cards are white
 * surfaces (the Figma's translucent glass, flattened for native; expo-blur can
 * layer real glass later). Values are hex straight from Figma.
 *
 * White-label still works: the four BrandTokens drive primary/ring; a firm swap
 * re-themes the app.
 */

export interface BrandTokens {
  brand: string;
  brandForeground: string;
  brandAccent: string;
  brandAccentForeground: string;
}

export const MIZAN_BRAND: BrandTokens = {
  brand: '#001E40',
  brandForeground: '#FFFFFF',
  brandAccent: '#006D37',
  brandAccentForeground: '#FFFFFF',
};

/** Demo firms for white-label verification. */
export const FIRM_PRESETS: Record<string, BrandTokens> = {
  mizan: MIZAN_BRAND,
  'falcon-books': {
    brand: '#2B2D6E',
    brandForeground: '#FFFFFF',
    brandAccent: '#B45309',
    brandAccentForeground: '#FFFFFF',
  },
  'oasis-advisory': {
    brand: '#0B5E4F',
    brandForeground: '#FFFFFF',
    brandAccent: '#B45309',
    brandAccentForeground: '#FFFFFF',
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

export function buildLightPalette(b: BrandTokens = MIZAN_BRAND): ColorTokens {
  return {
    brand: b.brand,
    brandForeground: b.brandForeground,
    brandAccent: b.brandAccent,
    brandAccentForeground: b.brandAccentForeground,
    background: '#F9F9FE',
    foreground: '#1A1C1F',
    card: '#FFFFFF',
    cardForeground: '#1A1C1F',
    popover: '#FFFFFF',
    popoverForeground: '#1A1C1F',
    surface: '#FFFFFF',
    surfaceForeground: '#1A1C1F',
    primary: b.brand,
    primaryForeground: b.brandForeground,
    secondary: '#E8E8ED',
    secondaryForeground: '#1A1C1F',
    muted: '#EFEFF4',
    mutedForeground: '#6B7280',
    // Flattened mint pill (Figma active-tab bg over the light surface).
    accent: '#B2FBCD',
    accentForeground: b.brand,
    destructive: '#DC2626',
    destructiveForeground: '#FFFFFF',
    border: '#C3C6D1',
    input: '#C3C6D1',
    ring: b.brand,
    success: '#006D37',
    successForeground: '#FFFFFF',
    warning: '#B45309',
    warningForeground: '#FFFFFF',
    danger: '#DC2626',
    dangerForeground: '#FFFFFF',
    // Brand-derived ramp: navy → mint.
    chart1: '#001E40',
    chart2: '#134E63',
    chart3: '#2E8C6A',
    chart4: '#4FD18B',
    chart5: '#6BFE9C',
    sidebar: '#F9F9FE',
    sidebarForeground: '#1A1C1F',
    sidebarPrimary: b.brand,
    sidebarPrimaryForeground: b.brandForeground,
    sidebarAccent: '#B2FBCD',
    sidebarAccentForeground: b.brand,
    sidebarBorder: '#C3C6D1',
    sidebarRing: b.brand,
  };
}

export function buildDarkPalette(b: BrandTokens = MIZAN_BRAND): ColorTokens {
  // Figma is light-first; this is a coherent deep-navy dark variant where mint
  // green becomes the actionable accent.
  const mint = '#6BFE9C';
  return {
    brand: b.brand,
    brandForeground: b.brandForeground,
    brandAccent: mint,
    brandAccentForeground: '#001E40',
    background: '#0A1626',
    foreground: '#EAF0F5',
    card: '#0F2135',
    cardForeground: '#EAF0F5',
    popover: '#0F2135',
    popoverForeground: '#EAF0F5',
    surface: '#12233A',
    surfaceForeground: '#EAF0F5',
    primary: mint,
    primaryForeground: '#001E40',
    secondary: '#1B2E47',
    secondaryForeground: '#EAF0F5',
    muted: '#1B2E47',
    mutedForeground: '#9AA6B2',
    accent: '#123A28',
    accentForeground: mint,
    destructive: '#F04438',
    destructiveForeground: '#FFFFFF',
    border: 'rgba(255,255,255,0.12)',
    input: 'rgba(255,255,255,0.16)',
    ring: mint,
    success: '#34D399',
    successForeground: '#001E40',
    warning: '#F59E0B',
    warningForeground: '#001E40',
    danger: '#F04438',
    dangerForeground: '#FFFFFF',
    chart1: '#3B82F6',
    chart2: '#22D3B7',
    chart3: '#34D399',
    chart4: '#5FE0A0',
    chart5: '#6BFE9C',
    sidebar: '#0A1626',
    sidebarForeground: '#EAF0F5',
    sidebarPrimary: mint,
    sidebarPrimaryForeground: '#001E40',
    sidebarAccent: '#123A28',
    sidebarAccentForeground: mint,
    sidebarBorder: 'rgba(255,255,255,0.1)',
    sidebarRing: mint,
  };
}
