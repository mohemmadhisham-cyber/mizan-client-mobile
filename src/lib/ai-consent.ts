import { readDevicePref, writeDevicePref } from '@/lib/device-prefs';

/**
 * Whether this person has agreed to their questions and receipt photos being
 * sent to an outside AI provider. Asked once, before the first use of a
 * feature that does so (the AI advisor, the reading of a receipt), and kept
 * on this device per person, so a second person on the same phone is asked
 * too.
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

// "Not now" is not saved. It is remembered only while the app stays open, so a
// screen that asks in passing (the receipt form) does not ask at every receipt.
const declinedThisRun = new Set<string>();

export function noteAiDeclined(userId: string): void {
  declinedThisRun.add(userId);
}

export function aiDeclinedThisRun(userId: string | undefined): boolean {
  return !!userId && declinedThisRun.has(userId);
}

/** Resolves to false if the choice could not be saved, so the screen can say so. */
export async function setAiConsent(userId: string, granted: boolean): Promise<boolean> {
  if (granted) declinedThisRun.delete(userId);
  return writeDevicePref(keyFor(userId), granted ? CONSENT_VERSION : 'withdrawn');
}
