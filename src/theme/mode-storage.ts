import { readDevicePref, writeDevicePref } from '@/lib/device-prefs';

/** The appearance the person chose in Settings. `system` follows the device. */
export type ThemeMode = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'theme_mode';
const THEME_MODES: readonly string[] = ['system', 'light', 'dark'];

function isThemeMode(value: unknown): value is ThemeMode {
  return typeof value === 'string' && THEME_MODES.includes(value);
}

/**
 * Reads the saved appearance synchronously, so the first frame already uses it
 * and the app never flashes the wrong theme on launch. Anything unreadable or
 * unexpected falls back to `system`.
 */
export function readStoredThemeMode(): ThemeMode {
  const raw = readDevicePref(STORAGE_KEY);
  return isThemeMode(raw) ? raw : 'system';
}

/**
 * Saves the appearance choice on this device. A failed write is not surfaced:
 * the choice still applies for this session and the person can set it again.
 */
export function storeThemeMode(mode: ThemeMode): void {
  void writeDevicePref(STORAGE_KEY, mode);
}
