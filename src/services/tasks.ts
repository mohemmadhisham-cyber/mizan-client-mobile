// Labels are translated here, at fetch time. That is safe because changing
// language reloads the app, which also clears the query cache.
import i18n from '@/i18n';
import { localeTag } from '@/lib/format';
import { supabase } from '@/lib/supabase';

import type { ActionCenterTask, CompletedSummary } from './types';

/**
 * Action Center — real, DB-backed.
 *  - Urgent = the client's own PENDING approval_requests (RLS "approvals
 *    client read"/"client update": client_id = user_client(auth.uid())).
 *    Deciding one is a real RLS-scoped update, gated by the step-up OTP the
 *    screen already runs.
 *  - Pending Review = the client's own PENDING document_requests ("document_
 *    requests client read") — things the accountant asked them to provide.
 *  - Completed = approvals this client decided in the last 7 days.
 * Nothing here posts to the ledger; a client only ever DECIDES a request the
 * accountant raised — the human-in-the-loop invariant is unchanged.
 */

type ApprovalRow = {
  id: string;
  title: string;
  description: string | null;
  requires_otp: boolean;
  status: string;
  decided_at: string | null;
  created_at: string;
};

type DocRequestRow = {
  id: string;
  title: string;
  notes: string | null;
  due_date: string | null;
  status: string;
};

function dueLabel(due: string | null): string {
  if (!due) return i18n.t('tasks.requested');
  const today = new Date().toISOString().slice(0, 10);
  if (due < today) return i18n.t('tasks.overdue');
  if (due === today) return i18n.t('tasks.dueToday');
  return i18n.t('tasks.dueOn', { date: new Date(due).toLocaleDateString(localeTag(), { month: 'short', day: 'numeric' }) });
}

export const tasksService = {
  async getUrgent(): Promise<ActionCenterTask[]> {
    const { data, error } = await supabase
      .from('approval_requests')
      .select('id, title, description, requires_otp, status, decided_at, created_at')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) throw error;
    return ((data ?? []) as ApprovalRow[]).map((r) => ({
      id: r.id,
      title: r.title,
      description: r.description ?? i18n.t('tasks.approvalFallback'),
      urgency: 'urgent' as const,
      badgeLabel: i18n.t('tasks.needsApproval'),
      actionLabel: i18n.t('tasks.reviewAndApprove'),
      actionKind: 'approve' as const,
    }));
  },

  async getPending(): Promise<ActionCenterTask[]> {
    const { data, error } = await supabase
      .from('document_requests')
      .select('id, title, notes, due_date, status')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) throw error;
    return ((data ?? []) as DocRequestRow[]).map((r) => ({
      id: r.id,
      title: r.title,
      description: r.notes ?? i18n.t('tasks.documentFallback'),
      urgency: 'pending' as const,
      badgeLabel: dueLabel(r.due_date),
      actionLabel: i18n.t('tasks.uploadDocument'),
      actionKind: 'upload-receipt' as const,
    }));
  },

  async getCompletedSummary(): Promise<CompletedSummary> {
    const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
    const { count, error } = await supabase
      .from('approval_requests')
      .select('id', { count: 'exact', head: true })
      .in('status', ['approved', 'declined'])
      .gte('decided_at', weekAgo);
    if (error) throw error;
    const n = count ?? 0;
    return { count: n, label: n === 0 ? i18n.t('tasks.completedNone') : i18n.t('tasks.completed', { count: n }) };
  },

  /** Client decides their own approval (RLS "approvals client update"). Called
   * after the step-up OTP the Action Center screen runs. */
  async decideApproval(id: string, decision: 'approved' | 'declined'): Promise<void> {
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase
      .from('approval_requests')
      .update({ status: decision, decided_by: userData.user?.id ?? null, decided_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  },
};
