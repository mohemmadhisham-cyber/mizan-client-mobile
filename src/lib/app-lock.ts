import * as LocalAuthentication from 'expo-local-authentication';

import { readDevicePrefOrThrow, writeDevicePref } from '@/lib/device-prefs';

/**
 * The app lock: when the person turns it on, the app asks the phone to
 * confirm who is holding it (Face ID, a fingerprint, or the phone's passcode)
 * before it shows anything.
 *
 * The phone does the confirming. The app never sees a face, a fingerprint or
 * a passcode: it is told only "yes" or "no".
 *
 * The lock is a choice kept on this device, per person. It is on top of
 * signing in, not in place of it: signing in with an emailed code already
 * proves who the person is, so a person who has just done that is not asked
 * again straight away.
 *
 * Where the app cannot tell, it stays locked: a choice that cannot be read
 * counts as "on", and a phone that will not say what it has is still asked.
 */

const ON = 'on';
const OFF = 'off';
const keyFor = (userId: string) => `app_lock.${userId}`;

/** How long the app may be out of view before it locks again. A glance at another app does not lock it. */
export const RELOCK_AFTER_MS = 60_000;

export function isAppLockOn(userId: string | null | undefined): boolean {
  if (!userId) return false;
  try {
    return readDevicePrefOrThrow(keyFor(userId)) === ON;
  } catch {
    // The choice could not be read. Locked is the safe reading: the person unlocks as usual.
    return true;
  }
}

/** Resolves to false if the choice could not be saved. */
export function setAppLock(userId: string, on: boolean): Promise<boolean> {
  return writeDevicePref(keyFor(userId), on ? ON : OFF);
}

type PhoneLock =
  /** A passcode, a fingerprint or a face is set up. */
  | 'ready'
  /** The phone says nothing is set up. */
  | 'none'
  /** The phone would not say. Not the same as "nothing": the app must not act as if it were. */
  | 'unknown';

async function phoneLock(): Promise<PhoneLock> {
  try {
    const level = await LocalAuthentication.getEnrolledLevelAsync();
    return level === LocalAuthentication.SecurityLevel.NONE ? 'none' : 'ready';
  } catch {
    return 'unknown';
  }
}

/** Whether this phone can lock the app: it needs a passcode, a fingerprint or a face set up. */
export async function phoneCanLock(): Promise<boolean> {
  return (await phoneLock()) === 'ready';
}

export type UnlockResult =
  /** The phone confirmed the person. */
  | 'unlocked'
  /** The person cancelled, the phone did not recognise them, or the phone could not be asked. */
  | 'refused'
  /** The phone says it has nothing to confirm with: no passcode, fingerprint or face is set up. */
  | 'unavailable';

/** Asks the phone to confirm who is holding it. Never throws. */
export async function askToUnlock(promptMessage: string): Promise<UnlockResult> {
  // Only the phone saying "nothing is set up" is 'unavailable'. A phone that fails to answer is
  // asked anyway, and a failure there is a refusal: an error must never open the app.
  if ((await phoneLock()) === 'none') return 'unavailable';
  try {
    // The phone's passcode is allowed as a way in: a wet finger or a mask must not lock a person out of their own app.
    const result = await LocalAuthentication.authenticateAsync({ promptMessage, disableDeviceFallback: false });
    return result.success ? 'unlocked' : 'refused';
  } catch {
    return 'refused';
  }
}

/**
 * Whether the lock may be switched on or off, given what the phone answered
 * when asked to confirm the person. The phone is asked either way: a person
 * holding an unlocked phone that is not theirs cannot switch the lock off.
 */
export function maySwitchLock(lockOn: boolean, answer: UnlockResult): boolean {
  if (answer === 'unlocked') return true;
  // Off, on a phone that can no longer confirm anyone: there is nothing left to lock with.
  return lockOn && answer === 'unavailable';
}

/**
 * Whether the app starts locked. A session that was already on the phone is
 * locked. A person who has just signed in with a code is not: they proved who
 * they are a moment ago.
 */
export function startsLocked(sessionWasOnPhone: boolean, lockOn: boolean): boolean {
  return sessionWasOnPhone && lockOn;
}

/** A moment by two clocks: the phone's own, which a person can set, and one that only runs forward. */
export interface Moment {
  wall: number;
  steady: number;
}

export function momentNow(): Moment {
  return { wall: Date.now(), steady: globalThis.performance?.now?.() ?? 0 };
}

/**
 * The time between two moments, by whichever clock says longer. Negative when
 * the phone's clock was set back in between.
 */
export function awayBetween(left: Moment, back: Moment): number {
  const wall = back.wall - left.wall;
  return wall < 0 ? wall : Math.max(wall, back.steady - left.steady);
}

/**
 * Whether the app locks again on coming back into view after `awayMs` out of
 * view. A negative time means the phone's clock was set back while the app
 * was away: that locks too, so the clock cannot be used to keep the app open.
 */
export function locksOnReturn(lockOn: boolean, awayMs: number): boolean {
  return lockOn && (awayMs < 0 || awayMs >= RELOCK_AFTER_MS);
}
