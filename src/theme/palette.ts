/**
 * MIZAN design system: colours from the brand kit (MIZAN_BRAND_GUIDE.md v1.0).
 *
 * Deep Forest Green (#153F35) leads. Muted Gold (#B69A68) is the signature
 * accent: lines, marks and a few highlights, never body text on a light
 * surface (it fails contrast there; use `brandAccentText`). Warm Ivory
 * (#F5F3EE) is the light ground and the lettering on dark; Deep Black
 * (#111816) is the dark ground. Soft Sage (#DCE5DC) is the supporting tint.
 *
 * Co-branding still works: the four BrandTokens drive brand/primary/ring; a
 * firm swap re-themes the app.
 */

export interface BrandTokens {
  brand: string;
  brandForeground: string;
  brandAccent: string;
  brandAccentForeground: string;
}

export const MIZAN_BRAND: BrandTokens = {
  brand: '#153F35',
  brandForeground: '#F5F3EE',
  brandAccent: '#B69A68',
  brandAccentForeground: '#111816',
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
  /** The accent at a strength that passes 4.5:1 as text on the theme's surfaces. */
  brandAccentText: string;
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
  /** Soft status fills with their readable text colour (badges, banners, chips). */
  successSoft: string;
  successSoftForeground: string;
  warningSoft: string;
  warningSoftForeground: string;
  dangerSoft: string;
  dangerSoftForeground: string;
  infoSoft: string;
  infoSoftForeground: string;
  /** Dimmed backdrop behind sheets and modals. */
  scrim: string;
  /** Shadow tint. */
  shadow: string;
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

const GOLD_INK_LIGHT = '#7A6233';
const GOLD_INK_DARK = '#C9AE7C';

/**
 * Text-safe version of the brand accent. Mizan's gold is too light for text on
 * ivory, so it maps to a darker ink; a firm's accent is used as supplied until
 * the co-branding contrast clamp lands (Mizan Connect plan, Phase 2).
 */
function accentText(b: BrandTokens, scheme: 'light' | 'dark'): string {
  if (b.brandAccent.toUpperCase() !== MIZAN_BRAND.brandAccent) return b.brandAccent;
  return scheme === 'light' ? GOLD_INK_LIGHT : GOLD_INK_DARK;
}

export function buildLightPalette(b: BrandTokens = MIZAN_BRAND): ColorTokens {
  const ink = '#111816';
  return {
    brand: b.brand,
    brandForeground: b.brandForeground,
    brandAccent: b.brandAccent,
    brandAccentForeground: b.brandAccentForeground,
    brandAccentText: accentText(b, 'light'),
    background: '#F5F3EE',
    foreground: ink,
    card: '#FFFFFF',
    cardForeground: ink,
    popover: '#FFFFFF',
    popoverForeground: ink,
    surface: '#FFFFFF',
    surfaceForeground: ink,
    primary: b.brand,
    primaryForeground: b.brandForeground,
    secondary: '#EBE8E0',
    secondaryForeground: ink,
    muted: '#EFECE5',
    mutedForeground: '#5A6862',
    // Soft Sage: active-tab pill and icon tiles.
    accent: '#DCE5DC',
    accentForeground: b.brand,
    destructive: '#B42318',
    destructiveForeground: '#FFFFFF',
    border: '#DDD9CE',
    input: '#CFCABD',
    ring: b.brand,
    success: '#1F6F4F',
    successForeground: '#FFFFFF',
    warning: '#8A5A0B',
    warningForeground: '#FFFFFF',
    danger: '#B42318',
    dangerForeground: '#FFFFFF',
    successSoft: '#DDEBE2',
    successSoftForeground: '#1F6F4F',
    warningSoft: '#F4E8CC',
    warningSoftForeground: '#7A4E0B',
    dangerSoft: '#F6DDD5',
    dangerSoftForeground: '#9C3A22',
    infoSoft: '#DCE5DC',
    infoSoftForeground: '#153F35',
    scrim: 'rgba(17,24,22,0.5)',
    shadow: '#111816',
    // Forest to sage, with gold as the contrasting series.
    chart1: '#153F35',
    chart2: '#2F6B57',
    chart3: '#5E9C84',
    chart4: '#B69A68',
    chart5: '#D9C7A3',
    sidebar: '#F5F3EE',
    sidebarForeground: ink,
    sidebarPrimary: b.brand,
    sidebarPrimaryForeground: b.brandForeground,
    sidebarAccent: '#DCE5DC',
    sidebarAccentForeground: b.brand,
    sidebarBorder: '#DDD9CE',
    sidebarRing: b.brand,
  };
}

export function buildDarkPalette(b: BrandTokens = MIZAN_BRAND): ColorTokens {
  // Brand guide section 8: Warm Ivory lettering on Deep Black. Ivory is the
  // actionable colour in dark; the brand colour stays for brand surfaces.
  const ivory = '#F5F3EE';
  const black = '#111816';
  return {
    brand: b.brand,
    brandForeground: b.brandForeground,
    brandAccent: b.brandAccent,
    brandAccentForeground: b.brandAccentForeground,
    brandAccentText: accentText(b, 'dark'),
    background: black,
    foreground: ivory,
    card: '#19221F',
    cardForeground: ivory,
    popover: '#19221F',
    popoverForeground: ivory,
    surface: '#1D2723',
    surfaceForeground: ivory,
    primary: ivory,
    primaryForeground: black,
    secondary: '#222D29',
    secondaryForeground: ivory,
    muted: '#222D29',
    mutedForeground: '#9AA8A1',
    accent: '#1E3A31',
    accentForeground: ivory,
    destructive: '#F08B74',
    destructiveForeground: black,
    border: 'rgba(245,243,238,0.12)',
    input: 'rgba(245,243,238,0.16)',
    ring: ivory,
    success: '#7FD0A8',
    successForeground: black,
    warning: '#E0B45C',
    warningForeground: black,
    danger: '#F08B74',
    dangerForeground: black,
    successSoft: '#1B3329',
    successSoftForeground: '#7FD0A8',
    warningSoft: '#3A2F14',
    warningSoftForeground: '#E0B45C',
    dangerSoft: '#3D211A',
    dangerSoftForeground: '#F08B74',
    infoSoft: '#22302B',
    infoSoftForeground: '#A9D2C2',
    scrim: 'rgba(0,0,0,0.6)',
    shadow: '#000000',
    chart1: '#A9D2C2',
    chart2: '#6FB39A',
    chart3: '#3F8A72',
    chart4: '#B69A68',
    chart5: '#D9C7A3',
    sidebar: black,
    sidebarForeground: ivory,
    sidebarPrimary: ivory,
    sidebarPrimaryForeground: black,
    sidebarAccent: '#1E3A31',
    sidebarAccentForeground: ivory,
    sidebarBorder: 'rgba(245,243,238,0.1)',
    sidebarRing: ivory,
  };
}

/**
 * Fixed colours for the camera screen. The viewfinder is always dark, whatever
 * the app theme, so its controls do not follow light/dark.
 */
export const cameraChrome = {
  surface: '#111816',
  surfaceRaised: 'rgba(17,24,22,0.95)',
  foreground: '#F5F3EE',
  foregroundMuted: 'rgba(245,243,238,0.7)',
  foregroundSubtle: 'rgba(245,243,238,0.6)',
  scrim: 'rgba(0,0,0,0.25)',
  glass: 'rgba(245,243,238,0.16)',
  glassSubtle: 'rgba(245,243,238,0.1)',
  glassBorder: 'rgba(245,243,238,0.1)',
  frame: 'rgba(245,243,238,0.5)',
  pill: 'rgba(21,63,53,0.85)',
  pillSolid: '#153F35',
  pillBorder: 'rgba(182,154,104,0.3)',
  accent: '#B69A68',
  accentSoft: 'rgba(182,154,104,0.2)',
  accentBorder: 'rgba(182,154,104,0.35)',
  success: '#7FD0A8',
  danger: '#F08B74',
} as const;
