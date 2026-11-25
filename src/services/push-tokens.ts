import { FunctionsHttpError } from '@supabase/supabase-js';
import { z } from 'zod';

import { assertSupabaseConfigured } from '@/lib/env';
import { supabase } from '@/lib/supabase';

/**
 * Tells the server which phone may be sent a person's notifications (edge
 * function `connect`, actions `push_register` and `push_forget`). The app
 * sends this phone's push address ("token") and never a user id.
 *
 * The server may not offer this yet. That is an answer ("not offered"), not a
 * failure.
 */

const FUNCTION = 'connect';
/** No such function, no such action, or its table is not there yet. */
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

async function send(body: Record<string, string>, expectRegistered: boolean): Promise<PushWrite> {
  const { data, error } = await supabase.functions.invoke<unknown>(FUNCTION, { body });
  if (error) {
    const notOffered = error instanceof FunctionsHttpError && (error.context as Response).status === NOT_OFFERED_STATUS;
    return notOffered ? 'not_offered' : 'failed';
  }
  const answer = answerSchema.safeParse(data);
  return answer.success && answer.data.registered === expectRegistered ? 'saved' : 'failed';
}

/**
 * This phone may be sent this person's notifications. The server takes the
 * person from the session, so the call is made only while the session is
 * still theirs: one that started for one person must not run after another
 * has signed in on the same phone. Never throws.
 */
export async function registerPushToken(token: string, platform: PushPlatform, forUserId: string): Promise<PushWrite> {
  try {
    assertSupabaseConfigured();
    const { data } = await supabase.auth.getSession();
    if (data.session?.user.id !== forUserId) return 'failed';
    return await send({ action: 'push_register', token, platform }, true);
  } catch {
    return 'failed';
  }
}

/**
 * This phone is sent nothing more. It needs no session: a phone must be able
 * to take itself off the list after its session has gone (expired, ended from
 * another device, or signed out while offline). The token is the proof.
 * Never throws.
 */
export async function forgetPushToken(token: string): Promise<PushWrite> {
  try {
    assertSupabaseConfigured();
    return await send({ action: 'push_forget', token }, false);
  } catch {
    return 'failed';
  }
}
