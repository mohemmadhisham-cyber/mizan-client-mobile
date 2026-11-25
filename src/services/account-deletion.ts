import { FunctionsHttpError } from '@supabase/supabase-js';
import { z } from 'zod';

import { assertSupabaseConfigured } from '@/lib/env';
import { supabase } from '@/lib/supabase';

/**
 * Asking for one's own account to be deleted, from inside the app. Both stores
 * require that this can be started in the app.
 *
 * The server decides everything: who is asking (from the session), what is
 * removed, and what must be kept because the law requires accounting records
 * to be kept. The app sends no user id and no client id.
 *
 * On 2026-11-26 the server has no such function. The app calls the one it has
 * asked the backend for (`account-deletion`, `{ action: "request" }`). Until it
 * exists the answer is "not offered" and the screen tells the person to write
 * to support instead. The contract is in the shared notes.
 */

const FUNCTION = 'account-deletion';

export type DeletionOutcome =
  /** The server has recorded the request. */
  | { status: 'requested' }
  /** The server does not take this request from the app yet. */
  | { status: 'not_offered' };

const answerSchema = z.object({ ok: z.literal(true) });
const NOT_OFFERED_STATUS = new Set([403, 404]);

/** Throws when the request could not be sent or the answer cannot be trusted: the screen then says it failed. */
export async function requestAccountDeletion(): Promise<DeletionOutcome> {
  assertSupabaseConfigured();
  const { data, error } = await supabase.functions.invoke<unknown>(FUNCTION, { body: { action: 'request' } });
  if (error) {
    if (error instanceof FunctionsHttpError && NOT_OFFERED_STATUS.has((error.context as Response).status)) {
      return { status: 'not_offered' };
    }
    throw new Error('deletion_request_failed');
  }
  if (!answerSchema.safeParse(data).success) throw new Error('deletion_request_unreadable');
  return { status: 'requested' };
}
