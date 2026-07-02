import type { ActionItem, InsightCard, KpiBlock, TrendPoint } from './types';

/**
 * Client dashboard data. Currently fixture-backed (integer MINOR units) behind
 * the real service interface — swap the bodies to live Supabase queries once the
 * client-data endpoints/seed land (a balance-beams backend dependency). The
 * exported signatures must not change (two-repo contract).
 */

const KPIS: KpiBlock = {
  cash: 41_235_000,
  moneyIn: 18_640_000,
  moneyOut: 12_910_000,
  profit: 5_730_000,
  vatDue: 2_145_000,
  vatDueDate: new Date(Date.now() + 26 * 24 * 60 * 60 * 1000).toISOString(),
  currency: 'AED',
};

const REVENUE: TrendPoint[] = [
  { month: 'Jan', value: 142_000 },
  { month: 'Feb', value: 156_000 },
  { month: 'Mar', value: 149_000 },
  { month: 'Apr', value: 171_000 },
  { month: 'May', value: 168_000 },
  { month: 'Jun', value: 186_400 },
];

const EXPENSE: TrendPoint[] = [
  { month: 'Jan', value: 98_000 },
  { month: 'Feb', value: 104_000 },
  { month: 'Mar', value: 112_000 },
  { month: 'Apr', value: 121_000 },
  { month: 'May', value: 118_000 },
  { month: 'Jun', value: 129_100 },
];

const INSIGHTS: InsightCard[] = [
  {
    id: 'i1',
    title: 'Revenue is up 11% this month',
    body: 'June sales outpaced May, driven by two new retainer clients.',
    severity: 'good',
  },
  {
    id: 'i2',
    title: 'VAT return due soon',
    body: 'Your Q2 VAT filing is due in under a month. Documents are being prepared.',
    severity: 'warn',
  },
  {
    id: 'i3',
    title: '3 receipts need your input',
    body: 'Your accountant has questions on a few transactions.',
    severity: 'info',
  },
];

const ACTIONS: ActionItem[] = [
  { id: 'a1', label: 'Answer transaction questions', count: 3, href: '/tasks' },
  { id: 'a2', label: 'Upload requested documents', count: 2, href: '/documents' },
];

export const clientDataService = {
  async getKpis(): Promise<KpiBlock> {
    return KPIS;
  },
  async getRevenueSeries(): Promise<TrendPoint[]> {
    return REVENUE;
  },
  async getExpenseSeries(): Promise<TrendPoint[]> {
    return EXPENSE;
  },
  async getInsights(): Promise<InsightCard[]> {
    return INSIGHTS;
  },
  async getActions(): Promise<ActionItem[]> {
    return ACTIONS;
  },
};
