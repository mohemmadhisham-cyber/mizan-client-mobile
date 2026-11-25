import { readDevicePref, writeDevicePref } from '@/lib/device-prefs';
import { readServerConsent, writeServerConsent } from '@/services/ai-consent-server';

/**
 * Whether this person has agreed to their questions and receipt photos being
 * sent to an outside AI provider. Asked once, before the first use of a
 * feature that does so (the AI advisor, the reading of a receipt), and kept
 * on this device per person, so a second person on the same phone is asked
 * too.
 *
 * Kept in two places. The server holds the record of who agreed to which
 * wording and when, and can refuse an AI call without it. The device holds a
 * copy, so the question "has this person agreed?" is answered at once and
 * with no connection. A server that keeps no such record yet is not an
 * error: the device copy then stands alone, as it did before.
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

/**
 * Records the person's choice: on the server where it keeps such a record,
 * then on this device. Resolves to false if it could not be saved, so the
 * screen can say so and the person can try again.
 *
 * The server goes first. If it should have recorded the choice and did not,
 * nothing is changed on the device either: the two must not disagree about
 * a withdrawal.
 */
export async function recordAiConsent(userId: string, granted: boolean): Promise<boolean> {
  const server = await writeServerConsent(granted, CONSENT_VERSION);
  if (server === 'failed') return false;
  return setAiConsent(userId, granted);
}

/**
 * Brings this device and the server into line, once after sign-in. Never
 * throws and changes nothing when the server is not known.
 *
 *  - Withdrawn on the server (on another phone): withdrawn here too.
 *  - Agreed on the server to this wording, not yet here (a new phone): agreed here.
 *  - Agreed here before the server kept a record: the agreement is sent up, once.
 */
export async function syncAiConsent(userId: string): Promise<void> {
  const server = await readServerConsent();
  if (!server.known) return;
  const here = hasAiConsent(userId);

  if (server.withdrawn) {
    if (here) await setAiConsent(userId, false);
    return;
  }
  if (server.granted) {
    // An agreement to an older wording does not carry over: the person is asked again.
    if (!here && server.version === CONSENT_VERSION) await setAiConsent(userId, true);
    return;
  }
  // The server has never heard from this person, and they agreed on this device.
  if (here) await writeServerConsent(true, CONSENT_VERSION);
}

/** Resolves to false if the choice could not be saved, so the screen can say so. */
// The device copy only. Screens use recordAiConsent, which also tells the server.
export async function setAiConsent(userId: string, granted: boolean): Promise<boolean> {
  if (granted) declinedThisRun.delete(userId);
  return writeDevicePref(keyFor(userId), granted ? CONSENT_VERSION : 'withdrawn');
}
