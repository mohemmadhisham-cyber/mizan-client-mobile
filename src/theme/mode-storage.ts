import * as SecureStore from 'expo-secure-store';

/** The appearance the person chose in Settings. `system` follows the device. */
export type ThemeMode = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'theme_mode';
const THEME_MODES: readonly string[] = ['system', 'light', 'dark'];

interface WebStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function isThemeMode(value: unknown): value is ThemeMode {
  return typeof value === 'string' && THEME_MODES.includes(value);
}

// SecureStore has no web implementation; the web preview uses localStorage.
function webStorage(): WebStorageLike | null {
  const ls = (globalThis as { localStorage?: WebStorageLike }).localStorage;
  return ls && typeof ls.getItem === 'function' ? ls : null;
}

/**
 * Reads the saved appearance synchronously, so the first frame already uses it
 * and the app never flashes the wrong theme on launch. Anything unreadable or
 * unexpected falls back to `system`.
 */
export function readStoredThemeMode(): ThemeMode {
  try {
    const raw = process.env.EXPO_OS === 'web' ? (webStorage()?.getItem(STORAGE_KEY) ?? null) : SecureStore.getItem(STORAGE_KEY);
    return isThemeMode(raw) ? raw : 'system';
  } catch {
    return 'system';
  }
}

/**
 * Saves the appearance choice on this device. A failed write is not surfaced:
 * the choice still applies for this session and the person can set it again.
 */
export function storeThemeMode(mode: ThemeMode): void {
  try {
    if (process.env.EXPO_OS === 'web') {
      webStorage()?.setItem(STORAGE_KEY, mode);
      return;
    }
    SecureStore.setItemAsync(STORAGE_KEY, mode).catch(() => {});
  } catch {
    // Storage unavailable (private mode, locked keychain): keep the in-memory choice.
  }
}
