import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { checkUpdateRequired } from '@/services/app-version';

/** How long a clear answer from the server stands before it is asked again. */
export const RECHECK_AFTER_MS = 6 * 60 * 60 * 1000;

export interface UpdateNotice {
  /** The store page for this phone, or null when the server gave none the app will follow. */
  storeUrl: string | null;
}

/**
 * Whether this version of the app is too old to be used. Null means carry on.
 *
 * The server is asked when the app starts, and again when the app comes back
 * into view after a long while, or after a try that got no answer. Once the
 * answer is "too old" it stays: only a newer app changes it.
 */
export function useUpdateRequired(): UpdateNotice | null {
  const [notice, setNotice] = useState<UpdateNotice | null>(null);

  useEffect(() => {
    let mounted = true;
    /** When the server last gave a clear answer. Null: not yet, so the next chance asks again. */
    let answeredAt: number | null = null;
    let asking = false;

    const ask = () => {
      if (asking) return;
      asking = true;
      checkUpdateRequired().then(
        (check) => {
          asking = false;
          if (check.status === 'unknown') return;
          answeredAt = Date.now();
          if (mounted && check.status === 'required') setNotice({ storeUrl: check.storeUrl });
        },
        () => {
          asking = false;
        },
      );
    };

    ask();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      if (answeredAt === null || Date.now() - answeredAt >= RECHECK_AFTER_MS) ask();
    });
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  return notice;
}
