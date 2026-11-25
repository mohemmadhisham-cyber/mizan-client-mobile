import { readDevicePref, writeDevicePref } from '@/lib/device-prefs';

/**
 * Whether this person has agreed to their questions being sent to an outside
 * AI provider. Asked once, before the AI advisor is first used, and kept on
 * this device per person, so a second person on the same phone is asked too.
 *
 * Kept on the device for now. A record on the server (who agreed, to which
 * wording, when) is the durable form and is asked of the backend.
 */

/** Bump when the wording people agree to changes: everyone is then asked again. */
const CONSENT_VERSION = 'v1';

const keyFor = (userId: string) => `ai_consent.${userId}`;

export function hasAiConsent(userId: string | undefined): boolean {
  if (!userId) return false;
  return readDevicePref(keyFor(userId)) === CONSENT_VERSION;
}

/** Resolves to false if the choice could not be saved, so the screen can say so. */
export async function setAiConsent(userId: string, granted: boolean): Promise<boolean> {
  return writeDevicePref(keyFor(userId), granted ? CONSENT_VERSION : 'withdrawn');
}
