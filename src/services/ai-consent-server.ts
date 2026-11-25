import { FunctionsHttpError } from '@supabase/supabase-js';
import { z } from 'zod';

import { assertSupabaseConfigured } from '@/lib/env';
import { supabase } from '@/lib/supabase';

/**
 * The server's record of this person's agreement to AI (edge function
 * `connect`, the `consent_*` actions). The server takes the person from the
 * session: the app sends no user id.
 *
 * The record may not exist yet on the server the app is talking to. That is
 * an answer ("not offered"), not a failure: the app then keeps the agreement
 * on the phone only, as it did before.
 */

const FUNCTION = 'connect';
/** No such function, or its table is not there yet. */
const NOT_OFFERED_STATUS = 404;

export type ServerConsent =
  /** The server keeps no such record (yet), or could not be reached. Nothing is known. */
  | { known: false }
  | {
      known: true;
      /** Agreed, and not withdrawn since. */
      granted: boolean;
      /** The wording agreed to, when `granted`. */
      version: string | null;
      /** The person withdrew an earlier agreement. Different from never having been asked. */
      withdrawn: boolean;
    };

export type ConsentWrite =
  /** The server recorded the choice. */
  | 'saved'
  /** The server keeps no such record yet. */
  | 'not_offered'
  /** The server should have recorded it and did not. */
  | 'failed';

const statusSchema = z.object({
  ok: z.literal(true),
  granted: z.boolean(),
  version: z.string().max(10).nullish(),
  withdrawnAt: z.string().max(40).nullish(),
});
const writeSchema = z.object({ ok: z.literal(true), granted: z.boolean() });

/**
 * True when the signed-in session is this person's. The server takes the
 * person from the session, so a call that started for one person must not
 * run after another has signed in on the same phone.
 */
async function sessionIs(userId: string): Promise<boolean> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id === userId;
}

function notOffered(error: unknown): boolean {
  return error instanceof FunctionsHttpError && (error.context as Response).status === NOT_OFFERED_STATUS;
}

/** What the server has on record for this person. Never throws: an unreachable server is "not known". */
export async function readServerConsent(forUserId: string): Promise<ServerConsent> {
  try {
    assertSupabaseConfigured();
    if (!(await sessionIs(forUserId))) return { known: false };
    const { data, error } = await supabase.functions.invoke<unknown>(FUNCTION, { body: { action: 'consent_status' } });
    if (error) return { known: false };
    const parsed = statusSchema.safeParse(data);
    if (!parsed.success) return { known: false };
    return {
      known: true,
      granted: parsed.data.granted,
      version: parsed.data.granted ? (parsed.data.version ?? null) : null,
      withdrawn: !parsed.data.granted && !!parsed.data.withdrawnAt,
    };
  } catch {
    return { known: false };
  }
}

/** Records this person's choice on the server. Never throws. */
export async function writeServerConsent(granted: boolean, version: string, forUserId: string): Promise<ConsentWrite> {
  try {
    assertSupabaseConfigured();
    if (!(await sessionIs(forUserId))) return 'failed';
    const body = granted ? { action: 'consent_grant', version } : { action: 'consent_withdraw' };
    const { data, error } = await supabase.functions.invoke<unknown>(FUNCTION, { body });
    if (error) return notOffered(error) ? 'not_offered' : 'failed';
    const parsed = writeSchema.safeParse(data);
    // The server must confirm the very choice that was sent.
    return parsed.success && parsed.data.granted === granted ? 'saved' : 'failed';
  } catch {
    return 'failed';
  }
}
