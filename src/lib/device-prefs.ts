import * as SecureStore from 'expo-secure-store';

/**
 * Small per-device preferences (appearance, language). Not secrets: SecureStore
 * is used because it is already in the app and offers a synchronous read, which
 * lets a preference apply before the first frame. Keys must match
 * [A-Za-z0-9._-]. On web, where SecureStore does not exist, localStorage is used.
 */

interface WebStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const isWeb = process.env.EXPO_OS === 'web';

function webStorage(): WebStorageLike | null {
  const ls = (globalThis as { localStorage?: WebStorageLike }).localStorage;
  return ls && typeof ls.getItem === 'function' ? ls : null;
}

/** Synchronous read. Returns null when nothing is stored or storage is unavailable. */
export function readDevicePref(key: string): string | null {
  try {
    return isWeb ? (webStorage()?.getItem(key) ?? null) : SecureStore.getItem(key);
  } catch {
    return null;
  }
}

/**
 * Saves a preference. Resolves to false when the write failed, so a caller that
 * must not lose the value (for example before reloading the app) can react; a
 * caller that only wants best effort can ignore the result.
 */
export async function writeDevicePref(key: string, value: string): Promise<boolean> {
  try {
    if (isWeb) {
      const storage = webStorage();
      if (!storage) return false;
      storage.setItem(key, value);
      return true;
    }
    await SecureStore.setItemAsync(key, value);
    return true;
  } catch {
    return false;
  }
}
