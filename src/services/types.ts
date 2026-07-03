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
  name: string;
  status: 'active' | 'past_due' | 'canceled';
  priceMinor: number;
  currency: 'AED' | 'SAR' | 'USD';
  nextPaymentDate: string;
}

export interface PaymentMethodInfo {
  brand: string;
  last4: string;
  expiry: string;
}

export interface Invoice {
  id: string;
  date: string;
  amountMinor: number;
  currency: 'AED' | 'SAR' | 'USD';
}

export interface CompanyInfo {
  id: string;
  name: string;
  status: 'active' | 'inactive';
  lastSyncedLabel: string;
}

export type TeamRole = 'owner' | 'admin' | 'viewer';

export interface TeamMemberInfo {
  id: string;
  name: string;
  role: TeamRole;
  email: string;
}

export type CalendarEventKind = 'deadline' | 'meeting' | 'task';

export interface CalendarEvent {
  id: string;
  kind: CalendarEventKind;
  title: string;
  subtitle: string;
  timeLabel: string;
  description?: string;
  actionLabel?: string;
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
}
