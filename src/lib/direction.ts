import type { Ionicons } from '@expo/vector-icons';
import { I18nManager } from 'react-native';

type IconName = keyof typeof Ionicons.glyphMap;

/**
 * Chevrons that follow the reading direction. "Forward" points to the next
 * screen (right in English, left in Arabic); "back" points to the previous one.
 * Layout direction is fixed for a run of the app: changing language reloads it.
 */
export function chevronForward(): IconName {
  return I18nManager.isRTL ? 'chevron-back' : 'chevron-forward';
}

export function chevronBack(): IconName {
  return I18nManager.isRTL ? 'chevron-forward' : 'chevron-back';
}
