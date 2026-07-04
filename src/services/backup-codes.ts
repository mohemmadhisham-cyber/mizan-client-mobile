import { assertSupabaseConfigured } from '@/lib/env';
import { supabase } from '@/lib/supabase';

/**
 * Account-recovery codes (not a second factor -- login is already
 * email-OTP, same channel). Backend lives in balance-beams-ai's
 * `backup-codes` edge function; plaintext codes are only ever seen once,
 * right after generation.
 */

export interface BackupCodesStatus {
  enabled: boolean;
  remaining: number;
}

async function call<T>(action: string): Promise<{ ok: boolean; error?: string } & T> {
  assertSupabaseConfigured();
  const { data, error } = await supabase.functions.invoke<{ ok: boolean; error?: string } & T>('backup-codes', {
    body: { action },
  });
  if (error) return { ok: false, error: error.message } as { ok: boolean; error?: string } & T;
  return data ?? ({ ok: false, error: 'No response from server.' } as { ok: boolean; error?: string } & T);
}

export async function getBackupCodesStatus(): Promise<BackupCodesStatus> {
  const res = await call<{ enabled?: boolean; remaining?: number }>('status');
  return { enabled: res.enabled ?? false, remaining: res.remaining ?? 0 };
}

export async function generateBackupCodes(): Promise<{ ok: boolean; codes?: string[]; error?: string }> {
  const res = await call<{ codes?: string[] }>('generate');
  return { ok: res.ok, codes: res.codes, error: res.error };
}

export async function disableBackupCodes(): Promise<{ ok: boolean; error?: string }> {
  const res = await call<Record<string, never>>('disable');
  return { ok: res.ok, error: res.error };
}
