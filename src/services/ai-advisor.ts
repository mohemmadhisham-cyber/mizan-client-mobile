import { FunctionsHttpError } from '@supabase/supabase-js';

import i18n from '@/i18n';
import { assertSupabaseConfigured } from '@/lib/env';
import { supabase } from '@/lib/supabase';

/**
 * Ask-AI, wired to the live `ai` edge function (balance-beams-ai's AI workforce
 * gateway). Token metering, rate limiting (20/60s), and wallet caps are all
 * enforced server-side — this service just surfaces whatever the function
 * returns. AI output is advisory only (CLAUDE.md §9); never presented as a
 * posted financial fact.
 */

export interface AskAiResult {
  ok: boolean;
  content?: string;
  tokensUsed?: number;
  balance?: number;
  error?: string;
  accountLocked?: boolean;
  insufficientTokens?: boolean;
  /** The server has no agreement on record for this person: ask before trying again. */
  consentRequired?: boolean;
}

/** The server's answer when a client has not agreed to their data going to an AI provider. */
const CONSENT_REQUIRED = 'ai_consent_required';

// Known server error codes mapped to user-safe messages. Anything not listed
// here (or unparseable) falls back to a single generic message — raw codes
// like "forbidden" must never reach the chat UI verbatim.
const FRIENDLY_ERROR_KEY: Record<string, string> = {
  forbidden: 'errors.aiForbidden',
  rate_limited: 'errors.aiRateLimited',
  invalid_request: 'errors.aiInvalid',
};

const GENERIC_ERROR_KEY = 'errors.aiGeneric';

function friendlyMessage(code: string | undefined): string {
  return i18n.t((code && FRIENDLY_ERROR_KEY[code]) || GENERIC_ERROR_KEY);
}

export async function askAi(prompt: string, clientId: string | null): Promise<AskAiResult> {
  assertSupabaseConfigured();
  const { data, error } = await supabase.functions.invoke<{
    ok: boolean;
    content?: string;
    tokens_used?: number;
    balance?: number;
    error?: string;
    account_locked?: boolean;
    insufficient_tokens?: boolean;
  }>('ai', { body: { prompt, ...(clientId ? { clientId } : {}) } });

  if (error) {
    if (error instanceof FunctionsHttpError) {
      try {
        const body = await error.context.json();
        return { ok: false, error: friendlyMessage(body?.error), consentRequired: body?.error === CONSENT_REQUIRED };
      } catch {
        return { ok: false, error: i18n.t(GENERIC_ERROR_KEY) };
      }
    }
    return { ok: false, error: i18n.t(GENERIC_ERROR_KEY) };
  }
  if (!data?.ok) {
    return {
      ok: false,
      error: friendlyMessage(data?.error),
      consentRequired: data?.error === CONSENT_REQUIRED,
      accountLocked: data?.account_locked,
      insufficientTokens: data?.insufficient_tokens,
    };
  }

  return {
    ok: true,
    content: data.content,
    tokensUsed: data.tokens_used,
    balance: data.balance,
  };
}
