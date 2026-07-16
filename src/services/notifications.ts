import { supabase } from '@/lib/supabase';

import type { NotificationCategory, NotificationItem, NotificationSeverity } from './types';

/** Notification Center — real, DB-backed. Reads the `notifications` table
 * (RLS "notif self": user_id = auth.uid(), so no user filter needed here) and
 * updates the read flag. Written into by reports, billing/dunning, payments,
 * and the n8n notifications-dispatch sink on the balance-beams backend. */

type Row = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  created_at: string;
};

/** The table stores a free-form `type`; map it to the app's category/severity
 * buckets so the UI can colour/group without a schema change. */
function categoryFor(type: string): NotificationCategory {
  const t = type.toLowerCase();
  if (/(ai|insight|advisor|forecast|cash.?flow)/.test(t)) return 'ai_advisor';
  if (/(report|invoice|billing|payment|message|approval|receipt|document|close)/.test(t)) return 'accountant';
  return 'system';
}

function severityFor(type: string): NotificationSeverity {
  const t = type.toLowerCase();
  if (/(alert|security|overdue|locked|failed|suspend|urgent)/.test(t)) return 'alert';
  if (/(paid|approved|ready|completed|done|success|published)/.test(t)) return 'good';
  return 'info';
}

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min${mins === 1 ? '' : 's'} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  return `${days} days ago`;
}

function toItem(r: Row): NotificationItem {
  return {
    id: r.id,
    category: categoryFor(r.type),
    severity: severityFor(r.type),
    title: r.title,
    body: r.body ?? '',
    timeLabel: relativeTime(r.created_at),
    read: r.read,
    actionLabel: r.link ? 'View' : undefined,
  };
}

export const notificationsService = {
  async getAll(): Promise<NotificationItem[]> {
    const { data, error } = await supabase
      .from('notifications')
      .select('id, type, title, body, link, read, created_at')
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) throw error;
    return ((data ?? []) as Row[]).map(toItem);
  },

  async markRead(id: string): Promise<void> {
    const { error } = await supabase.from('notifications').update({ read: true }).eq('id', id);
    if (error) throw error;
  },

  async markAllRead(): Promise<void> {
    const { error } = await supabase.from('notifications').update({ read: true }).eq('read', false);
    if (error) throw error;
  },
};
