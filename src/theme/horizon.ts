import type { ColorTokens } from './palette';

/**
 * Colours for the "Horizon" layout: a brand field above one line, the ground
 * below it, and a gold bridge on the line where the person has to act.
 *
 * Everything is derived from the theme, so a firm's co-brand colour replaces
 * the field while the line, the gold and the ground stay Mizan's.
 */
export interface HorizonColors {
  /** The field above the line. */
  field: string;
  /** Top of the field: the same colour, darker, so the field reads as a sky. */
  fieldDeep: string;
  /** Lettering on the field. */
  onField: string;
  /** Softer lettering on the field: the second tone of a headline. */
  fieldMuted: string;
  /** Light that sits on the line under the bridge. */
  fieldLight: string;
  /** The gold bridge. Used nowhere else. */
  bridge: string;
  ground: string;
  ink: string;
  muted: string;
  rule: string;
}

const HEX = /^#([0-9a-f]{6})$/i;

function channels(hex: string): [number, number, number] | null {
  const match = HEX.exec(hex.trim());
  if (!match) return null;
  const value = parseInt(match[1], 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

/** Mix two `#rrggbb` colours. `amount` 0 returns `from`, 1 returns `to`. */
export function mixHex(from: string, to: string, amount: number): string {
  const a = channels(from);
  const b = channels(to);
  if (!a || !b) return from;
  const mixed = a.map((channel, i) => Math.round(channel + (b[i] - channel) * amount));
  return `#${mixed.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
}

const FIELD_DEEPEN = 0.34;
const FIELD_SOFTEN = 0.34;
const SOFT_SAGE = '#DCE5DC';

export function horizonColors(colors: ColorTokens): HorizonColors {
  return {
    field: colors.brand,
    fieldDeep: mixHex(colors.brand, '#000000', FIELD_DEEPEN),
    onField: colors.brandForeground,
    fieldMuted: mixHex(colors.brandForeground, colors.brand, FIELD_SOFTEN),
    fieldLight: SOFT_SAGE,
    bridge: colors.brandAccent,
    ground: colors.background,
    ink: colors.foreground,
    muted: colors.mutedForeground,
    rule: colors.border,
  };
}
