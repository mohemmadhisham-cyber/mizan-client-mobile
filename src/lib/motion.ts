import { Easing, type WithTimingConfig } from 'react-native-reanimated';

import { duration, easing } from '@/theme';

/**
 * Reanimated timing configs derived from the design tokens. When the OS
 * "reduce motion" setting is on, transitions collapse to instant (duration 0)
 * so nothing animates — mirroring the web app's prefers-reduced-motion rule.
 */
export function timingConfig(reduced: boolean): WithTimingConfig {
  if (reduced) return { duration: 0 };
  return { duration: duration.normal, easing: Easing.bezier(...easing.outExpo) };
}

export function fastConfig(reduced: boolean): WithTimingConfig {
  if (reduced) return { duration: 0 };
  return { duration: duration.fast, easing: Easing.bezier(...easing.standard) };
}
