// Domain types mirrored from the two-repo contract (firm-guide-app / balance-beams-ai).
// Money fields are ALWAYS integer minor units — format with formatMoneyMinor.

export type Severity = 'info' | 'good' | 'warn' | 'alert';

export interface KpiBlock {
  /** Integer MINOR units (fils/halalas). */
  cash: number;
  moneyIn: number;
  moneyOut: number;
  profit: number;
  vatDue: number;
  vatDueDate: string;
  currency: 'AED' | 'SAR';
}

export interface TrendPoint {
  month: string;
  value: number;
}

export interface InsightCard {
  id: string;
  title: string;
  body: string;
  severity: Severity;
}

export interface ActionItem {
  id: string;
  label: string;
  count: number;
  href: string;
}

export type ReportType = 'monthly' | 'quarterly' | 'vat' | 'cashflow' | 'yearly';
export type ReportCategory = 'pl' | 'balance_sheet' | 'tax' | 'audit';

export interface Report {
  id: string;
  title: string;
  category: ReportCategory;
  type: ReportType;
  publishedAt: string;
  sizeLabel: string;
  narrative: string;
  highlights: string[];
  series: TrendPoint[];
}

export interface ReportsKeyMetrics {
  revenueGrowthPct: number;
  savingsPotentialMinor: number;
  savingsCategoryCount: number;
  currency: 'AED' | 'SAR';
}

export type TaskUrgency = 'urgent' | 'pending';
export type TaskActionKind = 'approve' | 'upload-receipt' | 'coming-soon';

export interface ActionCenterTask {
  id: string;
  title: string;
  description: string;
  urgency: TaskUrgency;
  badgeLabel: string;
  metaLabel?: string;
  actionLabel: string;
  actionKind: TaskActionKind;
}

export interface CompletedSummary {
  count: number;
  label: string;
}

export interface BillingPlan {
  firmName: string;
  planName: string | null;
  priceMinor: number;
  currency: 'AED' | 'SAR' | 'USD';
  nextPaymentDue: string | null;
}

export interface Invoice {
  id: string;
  number: string;
  date: string;
  status: string;
  amountMinor: number;
  currency: 'AED' | 'SAR' | 'USD';
}

export interface CompanyInfo {
  id: string;
  name: string;
  status: 'active' | 'inactive';
  lastSyncedLabel: string;
}

export interface TeamMemberInfo {
  userId: string;
  email: string;
  joinedAt: string;
}

export type CalendarEventKind = 'deadline' | 'meeting' | 'task';

export interface CalendarEvent {
  id: string;
  kind: CalendarEventKind;
  title: string;
  description?: string | null;
  location?: string | null;
  eventDate: string;
  eventTime?: string | null;
  /** 'pending' while a meeting request waits for the firm; also 'confirmed', 'declined', 'cancelled'. */
  status?: string | null;
  /** 'client_request' for a meeting this client asked for; other values are the firm's or the client's own entries. */
  source?: string | null;
  createdBy?: string | null;
}

export interface NewCalendarEvent {
  kind: CalendarEventKind;
  title: string;
  description?: string;
  location?: string;
  eventDate: string;
  eventTime?: string;
}

export interface CalendarDay {
  date: string;
  dayLabel: string;
  dayNumber: number;
  eventKinds: CalendarEventKind[];
}

export type NotificationCategory = 'system' | 'accountant' | 'ai_advisor';
export type NotificationSeverity = 'alert' | 'good' | 'info';

export interface NotificationItem {
  id: string;
  category: NotificationCategory;
  severity: NotificationSeverity;
  title: string;
  body: string;
  timeLabel: string;
  read: boolean;
  actionLabel?: string;
  /** In-app path the server attached, e.g. `/approvals/<id>`. Server data: validate before following. */
  link?: string;
}
