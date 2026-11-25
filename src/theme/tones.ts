import type { ColorTokens } from './palette';

/**
 * Soft status tones for badges, chips, banners and icon tiles: a quiet fill and
 * a text colour that passes contrast on it, in both light and dark.
 * `neutral` is for states that carry no judgement.
 */
export type SoftTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

export interface SoftToneColors {
  bg: string;
  fg: string;
}

export function softTone(colors: ColorTokens, tone: SoftTone): SoftToneColors {
  switch (tone) {
    case 'success':
      return { bg: colors.successSoft, fg: colors.successSoftForeground };
    case 'warning':
      return { bg: colors.warningSoft, fg: colors.warningSoftForeground };
    case 'danger':
      return { bg: colors.dangerSoft, fg: colors.dangerSoftForeground };
    case 'info':
      return { bg: colors.infoSoft, fg: colors.infoSoftForeground };
    case 'neutral':
      return { bg: colors.secondary, fg: colors.secondaryForeground };
  }
}
