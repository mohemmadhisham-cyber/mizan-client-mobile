import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { isAppLockOn, locksOnReturn, startsLocked } from '@/lib/app-lock';

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
 * whenever the app comes back into view after being out of sight for a while.
 * Not locked straight after signing in with a code.
 *
 * `covered` is true while the app is out of sight with the lock on: a plain
 * cover is drawn then, so that on coming back nothing of the app is seen, not
 * even for a moment, before the lock is.
 */
export function useAppLock(userId: string | null, authLoading: boolean) {
  // The person the app is locked for. Signing out, or another person signing in, is then not locked.
  const [lockedFor, setLockedFor] = useState<string | null>(null);
  const [startDecided, setStartDecided] = useState(false);
  const [covered, setCovered] = useState(false);
  const leftAt = useRef<number | null>(null);

  // The start is decided once, the first time the session is known: a person
  // present at that moment was signed in before the app opened.
  if (!authLoading && !startDecided) {
    setStartDecided(true);
    if (startsLocked(userId !== null, isAppLockOn(userId))) setLockedFor(userId);
  }

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      const lockOn = userId !== null && isAppLockOn(userId);
      if (state === 'background') {
        if (!lockOn) return;
        leftAt.current ??= Date.now();
        setCovered(true);
        return;
      }
      // A prompt drawn over the app (Face ID, a permission) makes it "inactive", not out of sight.
      if (state !== 'active') return;
      const away = leftAt.current === null ? 0 : Date.now() - leftAt.current;
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
