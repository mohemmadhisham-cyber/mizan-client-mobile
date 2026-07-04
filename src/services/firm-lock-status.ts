import { supabase } from '@/lib/supabase';

export interface FirmLockStatus {
  state: 'reminder' | 'grace' | 'locked';
  amountDueMinor: number;
  currency: string;
  dueSince: string;
  graceUntil: string | null;
}

interface LockStatusRow {
  state: string;
  amount_due_minor: number;
  currency: string;
  due_since: string;
  grace_until: string | null;
}

/** Reads the caller's own firm's dunning state via get_my_firm_lock_status()
 * (resolves the firm server-side, cannot be pointed at another company).
 * Returns null when the account is in good standing (no row = not locked). */
export async function getFirmLockStatus(): Promise<FirmLockStatus | null> {
  const { data, error } = await supabase.rpc('get_my_firm_lock_status');
  if (error || !data || (data as LockStatusRow[]).length === 0) return null;
  const row = (data as LockStatusRow[])[0];
  return {
    state: row.state as FirmLockStatus['state'],
    amountDueMinor: row.amount_due_minor,
    currency: row.currency,
    dueSince: row.due_since,
    graceUntil: row.grace_until,
  };
}
