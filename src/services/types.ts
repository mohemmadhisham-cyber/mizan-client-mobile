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
