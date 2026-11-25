import { Platform } from 'react-native';
import { z } from 'zod';

import { currentAppVersion, isOlderThan, isStorePlatform, safeStoreUrl } from '@/lib/app-version';
import { assertSupabaseConfigured } from '@/lib/env';
import { supabase } from '@/lib/supabase';

/**
 * Asks the server (edge function `app-version`) for the lowest version of
 * this app it still accepts. Asked before anyone has signed in.
 *
 * The function may not exist yet on the server the app is talking to, and the
 * phone may be offline. Neither blocks the app: only a clear answer that this
 * version is too old does.
 */

const FUNCTION = 'app-version';

export type UpdateCheck =
  /** This version is accepted, or the server sets no minimum. */
  | { status: 'current' }
  /** This version is older than the server accepts. */
  | { status: 'required'; storeUrl: string | null }
  /** The server could not be asked, or its answer could not be read. Ask again later. */
  | { status: 'unknown' };

const answerSchema = z.object({
  ok: z.literal(true),
  minVersion: z.string().max(20).nullish(),
  storeUrl: z.string().max(300).nullish(),
});

/** Never throws. */
export async function checkUpdateRequired(
  platform: string = Platform.OS,
  current: string | null = currentAppVersion(),
): Promise<UpdateCheck> {
  // The web build has no store version to fall behind.
  if (!isStorePlatform(platform)) return { status: 'current' };
  try {
    assertSupabaseConfigured();
    const { data, error } = await supabase.functions.invoke<unknown>(FUNCTION, { body: { platform } });
    if (error) return { status: 'unknown' };
    const answer = answerSchema.safeParse(data);
    if (!answer.success) return { status: 'unknown' };
    if (!isOlderThan(current, answer.data.minVersion)) return { status: 'current' };
    return { status: 'required', storeUrl: safeStoreUrl(platform, answer.data.storeUrl) };
  } catch {
    return { status: 'unknown' };
  }
}
