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

  if (error) return { ok: false, error: error.message };
  if (!data?.ok) {
    return {
      ok: false,
      error: data?.error ?? 'Mizan could not respond right now. Please try again.',
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
