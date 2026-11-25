import i18n from '@/i18n';
import { assertSupabaseConfigured } from '@/lib/env';
import { supabase } from '@/lib/supabase';

/**
 * Step-up re-verification for sensitive actions (approvals, etc). This is a
 * DIFFERENT system from the passwordless login OTP in services/auth.ts:
 * login OTP uses Supabase's native signInWithOtp/verifyOtp to establish a
 * session; step-up OTP calls the platform's own `otp` edge function
 * (purpose: 'step_up') to re-verify an ALREADY-authenticated user before a
 * sensitive action, mirroring balance-beams-ai's step-up pattern exactly.
 * supabase.functions.invoke automatically attaches the current session's
 * bearer token, which the edge function uses to resolve the caller and grant
 * the scope server-side (step_up_grants table).
 */

export interface StepUpResult {
  ok: boolean;
  error?: string;
}

export interface StepUpVerifyResult extends StepUpResult {
  granted?: boolean;
}

export async function issueStepUpOtp(email: string): Promise<StepUpResult> {
  assertSupabaseConfigured();
  const { data, error } = await supabase.functions.invoke<{
    ok: boolean;
    delivered?: boolean;
    error?: string;
    cooldownMs?: number;
  }>('otp', { body: { action: 'issue', email, purpose: 'step_up' } });
  if (error) return { ok: false, error: error.message };
  if (!data?.ok) return { ok: false, error: data?.error ?? i18n.t('errors.stepUpSendFailed') };
  return { ok: true };
}

export async function verifyStepUpOtp(email: string, code: string, scope: string): Promise<StepUpVerifyResult> {
  assertSupabaseConfigured();
  const { data, error } = await supabase.functions.invoke<{
    ok: boolean;
    error?: string;
    stepUpGranted?: boolean;
  }>('otp', { body: { action: 'verify', email, purpose: 'step_up', code, scope } });
  if (error) return { ok: false, error: error.message };
  if (!data?.ok) return { ok: false, error: data?.error ?? i18n.t('errors.stepUpCodeFailed') };
  return { ok: true, granted: Boolean(data.stepUpGranted) };
}
