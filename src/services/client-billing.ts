import i18n from '@/i18n';
import { assertSupabaseConfigured } from '@/lib/env';
import { supabase } from '@/lib/supabase';

/**
 * Client-side entry point into the `client-billing` edge function (backend
 * lives in balance-beams-ai). Used by the suspended-access screen to mint a
 * real renewal payment link for the firm's overdue invoice — this app never
 * handles payment itself, it opens the resulting link in the device browser.
 */

export interface CreateRenewalLinkResult {
  ok: boolean;
  token?: string;
  error?: string;
}

export async function createRenewalLink(): Promise<CreateRenewalLinkResult> {
  assertSupabaseConfigured();
  const { data, error } = await supabase.functions.invoke<{ ok: boolean; token?: string; error?: string }>(
    'client-billing',
    { body: { action: 'create_renewal_link' } },
  );
  if (error) return { ok: false, error: error.message };
  if (!data?.ok) return { ok: false, error: data?.error ?? i18n.t('errors.renewalLinkFailed') };
  return { ok: true, token: data.token };
}
