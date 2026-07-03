import type { ActionCenterTask, CompletedSummary } from './types';

/**
 * Action Center task list. Fixture-backed (real interface) — swap bodies to a
 * live `approval_requests` query once a client-facing list endpoint exists.
 * The step-up OTP flow triggered from "Review & Approve" (services/step-up.ts)
 * is real and hits the live backend regardless of this fixture.
 */

const URGENT: ActionCenterTask[] = [
  {
    id: 't1',
    title: 'Approve Q3 Payroll Run',
    description: 'Review the finalized payroll register for September. Total distribution: $42,500.',
    urgency: 'urgent',
    badgeLabel: 'Due Today',
    metaLabel: 'Sarah J. (Accountant)',
    actionLabel: 'Review & Approve',
    actionKind: 'approve',
  },
  {
    id: 't2',
    title: 'Verify Transaction #442',
    description: 'Uncategorized expense of $1,250.00 from "Tech Solutions Inc." Needs receipt upload.',
    urgency: 'urgent',
    badgeLabel: 'Action Needed',
    metaLabel: 'Missing Receipt',
    actionLabel: 'Upload Receipt',
    actionKind: 'upload-receipt',
  },
];

const PENDING: ActionCenterTask[] = [
  {
    id: 't3',
    title: 'Sign Q3 Summary',
    description: 'Quarterly financial summary needs your digital signature before tax filing.',
    urgency: 'pending',
    badgeLabel: 'Pending',
    actionLabel: 'Review Document',
    actionKind: 'coming-soon',
  },
  {
    id: 't4',
    title: 'Vendor W-9s',
    description: 'Request missing W-9 forms from 3 new contractors added this month.',
    urgency: 'pending',
    badgeLabel: 'Pending',
    actionLabel: 'View Contractors',
    actionKind: 'coming-soon',
  },
];

export const tasksService = {
  async getUrgent(): Promise<ActionCenterTask[]> {
    return URGENT;
  },
  async getPending(): Promise<ActionCenterTask[]> {
    return PENDING;
  },
  async getCompletedSummary(): Promise<CompletedSummary> {
    return { count: 4, label: '4 tasks finished this week' };
  },
};
