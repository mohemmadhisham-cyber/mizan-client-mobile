import Constants from 'expo-constants';

/**
 * The app's own version, and whether it is older than the lowest version the
 * server still accepts. Used to show "update the app" instead of running a
 * version that a later change on the server would break.
 *
 * Every doubt is settled in favour of carrying on: a version that cannot be
 * read, on either side, never blocks the app.
 */

export type StorePlatform = 'ios' | 'android';

export const isStorePlatform = (value: unknown): value is StorePlatform => value === 'ios' || value === 'android';

const VERSION = /^(\d{1,4})\.(\d{1,4})\.(\d{1,4})$/;

/** A version as three numbers, or null when the text is not "major.minor.patch". */
export function parseVersion(text: unknown): [number, number, number] | null {
  if (typeof text !== 'string') return null;
  const match = VERSION.exec(text.trim());
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null;
}

/** True only when both are readable versions and `current` comes before `minimum`. */
export function isOlderThan(current: unknown, minimum: unknown): boolean {
  const mine = parseVersion(current);
  const least = parseVersion(minimum);
  if (!mine || !least) return false;
  for (let part = 0; part < mine.length; part += 1) {
    if (mine[part] !== least[part]) return mine[part] < least[part];
  }
  return false;
}

/** The version this app was built as, from app.json. */
export function currentAppVersion(): string | null {
  return Constants.expoConfig?.version ?? null;
}

// The only places the app sends a person for an update. The server checks the
// same; it is checked again here so that nothing the server says can send a
// person anywhere else.
const STORE_START: Record<StorePlatform, string> = {
  ios: 'https://apps.apple.com/',
  android: 'https://play.google.com/',
};

/** The store address if it is an https link to this platform's own store, and null otherwise. */
export function safeStoreUrl(platform: StorePlatform, value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const url = value.trim();
  // The host is followed at once by "/", so nothing can sit between it and the path.
  return url.startsWith(STORE_START[platform]) && !/\s/.test(url) ? url : null;
}
