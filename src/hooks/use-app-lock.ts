import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { awayBetween, isAppLockOn, locksOnReturn, type Moment, momentNow, startsLocked } from '@/lib/app-lock';

/**
 * Whether the app is locked right now. A sheet that opens over the app (a
 * native window above every screen, the lock included) reads this and closes
 * itself while the app is locked, so nothing shows over the lock.
 */
export const AppLockedContext = createContext(false);

export function useAppLocked(): boolean {
  return useContext(AppLockedContext);
}

/**
 * Whether the app is locked right now, for the signed-in person.
 *
 * Locked when the app starts with a session already on the phone, and again
 * whenever the app comes back into view after being out of view for a while.
 * Not locked straight after signing in with a code.
 *
 * `covered` is true while the app is not in view with the lock on: a plain
 * cover is drawn then, so that the phone's picture of the app in its app
 * switcher, and the first moment on coming back, show nothing of the app.
 */
export function useAppLock(userId: string | null, authLoading: boolean) {
  // The person the app is locked for.
  const [lockedFor, setLockedFor] = useState<string | null>(null);
  const [startDecided, setStartDecided] = useState(false);
  const [covered, setCovered] = useState(false);
  const leftAt = useRef<Moment | null>(null);

  // The start is decided once, the first time the session is known: a person
  // present at that moment was signed in before the app opened.
  if (!authLoading && !startDecided) {
    setStartDecided(true);
    if (startsLocked(userId !== null, isAppLockOn(userId))) setLockedFor(userId);
  }

  // Signed out, or someone else signed in: the lock was the other person's. Whoever
  // signs in next has just proved who they are with a code.
  if (lockedFor !== null && lockedFor !== userId) setLockedFor(null);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      const lockOn = userId !== null && isAppLockOn(userId);
      if (state !== 'active') {
        if (!lockOn) return;
        // Counted from the first moment out of view. A prompt over the app counts as well:
        // the phone takes its picture of the app for the app switcher at that same moment.
        leftAt.current ??= momentNow();
        setCovered(true);
        return;
      }
      const away = leftAt.current === null ? 0 : awayBetween(leftAt.current, momentNow());
      leftAt.current = null;
      setCovered(false);
      if (locksOnReturn(lockOn, away)) setLockedFor(userId);
    });
    return () => subscription.remove();
  }, [userId]);

  const unlock = useCallback(() => {
    leftAt.current = null;
    setLockedFor(null);
  }, []);

  return {
    locked: userId !== null && lockedFor === userId,
    covered: userId !== null && covered,
    unlock,
  };
}
