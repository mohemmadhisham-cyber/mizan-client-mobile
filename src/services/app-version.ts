import { Platform } from 'react-native';
import { z } from 'zod';

import { currentAppVersion, isOlderThan, isStorePlatform, safeStoreUrl, type StorePlatform } from '@/lib/app-version';
import { assertSupabaseConfigured } from '@/lib/env';
import { supabase } from '@/lib/supabase';

/**
 * Asks the server (edge function `connect`, action `app_version`) for the lowest version of
 * this app it still accepts. Asked before anyone has signed in.
 *
 * The function may not exist yet on the server the app is talking to, and the
 * phone may be offline. Neither blocks the app: only a clear answer that this
 * version is too old does.
 */

const FUNCTION = 'connect';
/** How long the server has to answer. A request that hangs must not stop the next try from being made. */
export const ANSWER_TIMEOUT_MS = 10_000;

export type UpdateCheck =
  /** This version is accepted, or the server sets no minimum. */
  | { status: 'current' }
  /** This version is older than the server accepts. */
  | { status: 'required'; storeUrl: string | null }
  /** The server could not be asked, or its answer could not be read. Ask again later. */
  | { status: 'unknown' };

// Only `ok` decides whether this is an answer. The two values are read by the functions
// that judge them, each on its own: a store link the app will not follow must not hide
// a minimum that is clear.
const answerSchema = z.object({
  ok: z.literal(true),
  minVersion: z.unknown().optional(),
  storeUrl: z.unknown().optional(),
});

async function ask(platform: StorePlatform, current: string | null): Promise<UpdateCheck> {
  try {
    assertSupabaseConfigured();
    const { data, error } = await supabase.functions.invoke<unknown>(FUNCTION, { body: { action: 'app_version', platform } });
    if (error) return { status: 'unknown' };
    const answer = answerSchema.safeParse(data);
    if (!answer.success) return { status: 'unknown' };
    if (!isOlderThan(current, answer.data.minVersion)) return { status: 'current' };
    return { status: 'required', storeUrl: safeStoreUrl(platform, answer.data.storeUrl) };
  } catch {
    return { status: 'unknown' };
  }
}

/** Never throws, and always answers: after `ANSWER_TIMEOUT_MS` with no word from the server, nothing is known. */
export async function checkUpdateRequired(
  platform: string = Platform.OS,
  current: string | null = currentAppVersion(),
): Promise<UpdateCheck> {
  // The web build has no store version to fall behind.
  if (!isStorePlatform(platform)) return { status: 'current' };
  let timer: ReturnType<typeof setTimeout> | undefined;
  const gaveUp = new Promise<UpdateCheck>((resolve) => {
    timer = setTimeout(() => resolve({ status: 'unknown' }), ANSWER_TIMEOUT_MS);
  });
  try {
    return await Promise.race([ask(platform, current), gaveUp]);
  } finally {
    clearTimeout(timer);
  }
}
