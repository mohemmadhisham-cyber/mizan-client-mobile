import type { NotificationItem } from './types';

/** Notification Center. Fixture-backed (real interface) -- swap to a live
 * query against the `notifications` table (RLS-scoped to auth.uid()) once its
 * policies are confirmed for this client. */

const NOTIFICATIONS: NotificationItem[] = [
  {
    id: 'n1',
    category: 'system',
    severity: 'alert',
    title: 'Security Alert',
    body: 'Unusual login detected from new device.',
    timeLabel: 'Just now',
    read: false,
  },
  {
    id: 'n2',
    category: 'accountant',
    severity: 'info',
    title: 'New Report Available',
    body: 'Q3 Financial Summary is ready for review.',
    timeLabel: '10 mins ago',
    read: false,
    actionLabel: 'View Report',
  },
  {
    id: 'n3',
    category: 'system',
    severity: 'good',
    title: 'Task Due Soon',
    body: 'Approve pending invoices before EOD.',
    timeLabel: '2 hours ago',
    read: true,
  },
  {
    id: 'n4',
    category: 'ai_advisor',
    severity: 'info',
    title: 'Cash Flow Prediction',
    body: 'Expected dip in cash flow next week.',
    timeLabel: 'Yesterday',
    read: true,
  },
];

export const notificationsService = {
  async getAll(): Promise<NotificationItem[]> {
    return NOTIFICATIONS;
  },
};
