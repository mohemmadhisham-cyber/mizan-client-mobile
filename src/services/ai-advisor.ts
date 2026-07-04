import { FunctionsHttpError } from '@supabase/supabase-js';

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
}

// Known server error codes mapped to user-safe messages. Anything not listed
// here (or unparseable) falls back to a single generic message — raw codes
// like "forbidden" must never reach the chat UI verbatim.
const FRIENDLY_ERROR: Record<string, string> = {
  forbidden: "You don't have access to ask AI questions for this company. Contact your accountant.",
  rate_limited: "You're sending messages too quickly. Wait a moment and try again.",
  invalid_request: 'That message could not be sent. Try rephrasing it.',
};

const GENERIC_ERROR = 'Mizan could not respond right now. Please try again.';

function friendlyMessage(code: string | undefined): string {
  if (!code) return GENERIC_ERROR;
  return FRIENDLY_ERROR[code] ?? GENERIC_ERROR;
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
        return { ok: false, error: friendlyMessage(body?.error) };
      } catch {
        return { ok: false, error: GENERIC_ERROR };
      }
    }
    return { ok: false, error: GENERIC_ERROR };
  }
  if (!data?.ok) {
    return {
      ok: false,
      error: friendlyMessage(data?.error),
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
