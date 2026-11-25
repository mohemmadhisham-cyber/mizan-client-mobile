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

/** This app's own identifier on Google Play, from app.json. */
export function ownAndroidPackage(): string | null {
  return Constants.expoConfig?.android?.package ?? null;
}

// The only places the app sends a person for an update: an app's own page on
// the platform's store. The server checks the same; it is checked again here
// so that nothing the server says can send a person anywhere else. Each
// pattern runs from the first character to the last, and the host is followed
// at once by "/", so nothing can sit between it and the path.
//   https://apps.apple.com/app/id123456789, with an optional country and name in the path
//   https://play.google.com/store/apps/details?id=com.example.app
const APP_STORE_PAGE = /^https:\/\/apps\.apple\.com\/([a-z]{2}\/)?app\/([^/?#\s]+\/)?id\d{5,15}(\?[^\s#]*)?$/;
const PLAY_PAGE = /^https:\/\/play\.google\.com\/store\/apps\/details\?id=([A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z][A-Za-z0-9_]*)+)(&[^\s#]*)?$/;

/**
 * The store address if it is an https link to an app's page on this
 * platform's own store, and null otherwise. On Android the page must be this
 * app's own, when the app knows its identifier.
 */
export function safeStoreUrl(
  platform: StorePlatform,
  value: unknown,
  ownPackage: string | null = ownAndroidPackage(),
): string | null {
  if (typeof value !== 'string') return null;
  const url = value.trim();
  if (platform === 'ios') return APP_STORE_PAGE.test(url) ? url : null;
  const page = PLAY_PAGE.exec(url);
  if (!page) return null;
  return ownPackage === null || page[1] === ownPackage ? url : null;
}
