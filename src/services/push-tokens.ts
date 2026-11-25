import { FunctionsHttpError } from '@supabase/supabase-js';
import { z } from 'zod';

import { assertSupabaseConfigured } from '@/lib/env';
import { supabase } from '@/lib/supabase';

/**
 * Tells the server which phone may be sent this person's notifications (edge
 * function `push-tokens`). The server takes the person from the session: the
 * app sends no user id, only this phone's push address ("token").
 *
 * The function may not exist yet on the server the app is talking to. That is
 * an answer ("not offered"), not a failure.
 */

const FUNCTION = 'push-tokens';
/** No such function, or its table is not there yet. */
const NOT_OFFERED_STATUS = 404;

export type PushWrite =
  /** The server recorded it. */
  | 'saved'
  /** The server does not keep phones yet. */
  | 'not_offered'
  /** The server should have recorded it and did not, or could not be reached. */
  | 'failed';

export type PushPlatform = 'ios' | 'android';

const answerSchema = z.object({ ok: z.literal(true), registered: z.boolean() });

/**
 * True when the signed-in session is this person's. The server takes the
 * person from the session, so a call that started for one person must not
 * run after another has signed in on the same phone.
 */
async function sessionIs(userId: string): Promise<boolean> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id === userId;
}

async function write(body: Record<string, string>, expectRegistered: boolean, forUserId: string): Promise<PushWrite> {
  try {
    assertSupabaseConfigured();
    if (!(await sessionIs(forUserId))) return 'failed';
    const { data, error } = await supabase.functions.invoke<unknown>(FUNCTION, { body });
    if (error) {
      const notOffered = error instanceof FunctionsHttpError && (error.context as Response).status === NOT_OFFERED_STATUS;
      return notOffered ? 'not_offered' : 'failed';
    }
    const answer = answerSchema.safeParse(data);
    return answer.success && answer.data.registered === expectRegistered ? 'saved' : 'failed';
  } catch {
    return 'failed';
  }
}

/** This phone may be sent this person's notifications. Never throws. */
export function registerPushToken(token: string, platform: PushPlatform, forUserId: string): Promise<PushWrite> {
  return write({ action: 'register', token, platform }, true, forUserId);
}

/** This phone may no longer be sent them. Never throws. */
export function unregisterPushToken(token: string, forUserId: string): Promise<PushWrite> {
  return write({ action: 'unregister', token }, false, forUserId);
}
