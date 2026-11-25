import * as LocalAuthentication from 'expo-local-authentication';

import { readDevicePref, writeDevicePref } from '@/lib/device-prefs';

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
 */

const ON = 'on';
const OFF = 'off';
const keyFor = (userId: string) => `app_lock.${userId}`;

/** How long the app may be out of sight before it locks again. A glance at another app does not lock it. */
export const RELOCK_AFTER_MS = 60_000;

export function isAppLockOn(userId: string | null | undefined): boolean {
  if (!userId) return false;
  return readDevicePref(keyFor(userId)) === ON;
}

/** Resolves to false if the choice could not be saved. */
export function setAppLock(userId: string, on: boolean): Promise<boolean> {
  return writeDevicePref(keyFor(userId), on ? ON : OFF);
}

/** Whether this phone can lock the app at all: it needs a passcode, a fingerprint or a face set up. */
export async function phoneCanLock(): Promise<boolean> {
  try {
    return (await LocalAuthentication.getEnrolledLevelAsync()) !== LocalAuthentication.SecurityLevel.NONE;
  } catch {
    return false;
  }
}

export type UnlockResult =
  /** The phone confirmed the person. */
  | 'unlocked'
  /** The person cancelled, or the phone did not recognise them. */
  | 'refused'
  /** The phone has nothing to confirm with: no passcode, fingerprint or face is set up. */
  | 'unavailable';

/** Asks the phone to confirm who is holding it. Never throws. */
export async function askToUnlock(promptMessage: string): Promise<UnlockResult> {
  try {
    if (!(await phoneCanLock())) return 'unavailable';
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

/** Whether the app locks again on coming back into view after `awayMs` out of sight. */
export function locksOnReturn(lockOn: boolean, awayMs: number): boolean {
  return lockOn && awayMs >= RELOCK_AFTER_MS;
}
