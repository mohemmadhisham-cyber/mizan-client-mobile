import { z } from 'zod';

import i18n from '@/i18n';
import { assertSupabaseConfigured } from '@/lib/env';
import { supabase } from '@/lib/supabase';

/**
 * Passwordless email-OTP auth, mirroring the proven client flow in
 * balance-beams-ai (accept-invite.tsx): Supabase native OTP sends and verifies a
 * 6-digit code and returns a real session; the `client-accept` edge function
 * then grants the client_user role for an invited SME. No backend changes.
 */

export const emailSchema = z.email();

export interface AuthResult {
  ok: boolean;
  error?: string;
}

const OTP_CODE = /^\d{6}$/;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Send a 6-digit sign-in code. `createUser` true for invited/new SMEs. */
export async function sendEmailOtp(email: string, createUser: boolean): Promise<AuthResult> {
  assertSupabaseConfigured();
  const parsed = emailSchema.safeParse(normalizeEmail(email));
  if (!parsed.success) return { ok: false, error: i18n.t('auth.invalidEmail') };

  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data,
    options: { shouldCreateUser: createUser },
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Verify the code → establishes a real Supabase session on success. */
export async function verifyEmailOtp(email: string, code: string): Promise<AuthResult> {
  assertSupabaseConfigured();
  const parsed = emailSchema.safeParse(normalizeEmail(email));
  if (!parsed.success) return { ok: false, error: i18n.t('auth.invalidEmail') };
  if (!OTP_CODE.test(code)) return { ok: false, error: i18n.t('errors.codeFormat') };

  const { error } = await supabase.auth.verifyOtp({
    email: parsed.data,
    token: code,
    type: 'email',
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export interface PeekResult {
  valid: boolean;
  email?: string | null;
}

/** Anon-safe: reveals only whether an invite token is valid + its email. */
export async function peekInvite(token: string): Promise<PeekResult> {
  assertSupabaseConfigured();
  const { data, error } = await supabase.functions.invoke<{ ok: boolean; valid?: boolean; email?: string | null }>(
    'client-accept',
    { body: { action: 'peek', token } },
  );
  if (error || !data?.ok) return { valid: false };
  return { valid: Boolean(data.valid), email: data.email ?? null };
}

export interface AcceptResult {
  ok: boolean;
  error?: string;
  firmId?: string;
  clientId?: string;
}

/** Authenticated: grants the client_user role for the invite's firm. */
export async function acceptInvite(token: string): Promise<AcceptResult> {
  assertSupabaseConfigured();
  const { data, error } = await supabase.functions.invoke<{
    ok: boolean;
    error?: string;
    firm_id?: string;
    client_id?: string;
  }>('client-accept', { body: { token } });
  if (error || !data?.ok) {
    return { ok: false, error: data?.error ?? error?.message ?? i18n.t('errors.inviteFailed') };
  }
  return { ok: true, firmId: data.firm_id, clientId: data.client_id };
}
