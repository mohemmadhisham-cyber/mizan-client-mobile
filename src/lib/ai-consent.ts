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
 *
 * The two are not equal when they disagree. Agreeing needs the server to
 * record it first. Withdrawing takes effect on this device first and always,
 * and the server is told after: a withdrawal must never wait for a
 * connection.
 */

/** Bump when the wording people agree to changes: everyone is then asked again. */
const CONSENT_VERSION = 'v1';
/** Withdrawn on this device; the server has not been told yet. The next sync sends it. */
const WITHDRAWN_PENDING = 'withdrawn';
/** Withdrawn, and the server knows (or keeps no record). Nothing left to send. */
const WITHDRAWN_SENT = 'withdrawn-sent';

const keyFor = (userId: string) => `ai_consent.${userId}`;

/**
 * Counts the choices written on this device. A sync that was asking the
 * server while the person made a choice sees the count has moved and writes
 * nothing: what it read is older than what the person just did.
 */
let choiceCount = 0;

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

function writeChoice(userId: string, value: string): Promise<boolean> {
  choiceCount += 1;
  return writeDevicePref(keyFor(userId), value);
}

/**
 * The device copy only. Screens use recordAiConsent, which also tells the
 * server. A withdrawal written here is marked as not yet sent, so the next
 * sync sends it. Resolves to false if the choice could not be saved.
 */
export async function setAiConsent(userId: string, granted: boolean): Promise<boolean> {
  if (granted) declinedThisRun.delete(userId);
  return writeChoice(userId, granted ? CONSENT_VERSION : WITHDRAWN_PENDING);
}

/**
 * Records the person's choice. Resolves to false if it could not be saved, so
 * the screen can say so and the person can try again.
 *
 * Agreeing: the server first. If it should have recorded the agreement and
 * did not, nothing changes on the device.
 *
 * Withdrawing: this device first, whatever the connection. From that moment
 * nothing more is sent to an AI provider from this phone. The server is told
 * straight after; if it cannot be reached, the next sync sends it.
 */
export async function recordAiConsent(userId: string, granted: boolean): Promise<boolean> {
  if (!granted) {
    const saved = await setAiConsent(userId, false);
    const server = await writeServerConsent(false, CONSENT_VERSION, userId);
    if (saved && server !== 'failed') await writeChoice(userId, WITHDRAWN_SENT);
    return saved;
  }
  const server = await writeServerConsent(true, CONSENT_VERSION, userId);
  if (server === 'failed') return false;
  return setAiConsent(userId, true);
}

/**
 * Brings this device and the server into line, after sign-in. Never throws.
 * Writes nothing when the server is not known, when the person made a choice
 * while the server was being asked, or when `isCurrent` says this person is
 * no longer the one signed in.
 *
 *  - Withdrawn here and not yet sent: the withdrawal is sent. It is never
 *    undone by what the server still has.
 *  - Withdrawn on the server (on another phone): withdrawn here too.
 *  - Agreed on the server to this wording, not agreed here (a new phone, or
 *    agreed again elsewhere after a withdrawal): agreed here.
 *  - Agreed here before the server kept a record: the agreement is sent up.
 */
export async function syncAiConsent(userId: string, isCurrent: () => boolean = () => true): Promise<void> {
  const countBefore = choiceCount;
  const server = await readServerConsent(userId);
  if (!server.known || countBefore !== choiceCount || !isCurrent()) return;

  const here = readDevicePref(keyFor(userId));

  if (here === WITHDRAWN_PENDING) {
    if (server.granted && (await writeServerConsent(false, CONSENT_VERSION, userId)) === 'failed') return;
    if (isCurrent()) await writeChoice(userId, WITHDRAWN_SENT);
    return;
  }
  if (server.withdrawn) {
    if (here === CONSENT_VERSION) await writeChoice(userId, WITHDRAWN_SENT);
    return;
  }
  if (server.granted) {
    // An agreement to an older wording does not carry over: the person is asked again.
    if (here !== CONSENT_VERSION && server.version === CONSENT_VERSION) await writeChoice(userId, CONSENT_VERSION);
    return;
  }
  // The server has never heard from this person, and they agreed on this device.
  if (here === CONSENT_VERSION) await writeServerConsent(true, CONSENT_VERSION, userId);
}
