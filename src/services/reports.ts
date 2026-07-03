import type { Report, ReportsKeyMetrics, TrendPoint } from './types';

/**
 * Reports & Insights data. Fixture-backed (real interface) behind the same
 * signatures a live implementation would use — swap bodies to real queries once
 * the report-delivery pipeline (balance-beams report-generate/report-publish)
 * exposes a client-readable list. Search/filter below run for real against
 * this fixture set, so the archive UI is genuinely functional today.
 */

const KEY_METRICS: ReportsKeyMetrics = {
  revenueGrowthPct: 14.2,
  savingsPotentialMinor: 1_250_000,
  savingsCategoryCount: 3,
  currency: 'AED',
};

const MONTHLY_PL: TrendPoint[] = [
  { month: 'Jul', value: 45_000 },
  { month: 'Aug', value: 60_000 },
  { month: 'Sep', value: 75_000 },
];

const REPORTS: Report[] = [
  {
    id: 'r1',
    title: 'Q4 2023 P&L Overview',
    category: 'pl',
    type: 'quarterly',
    publishedAt: '2023-10-01',
    sizeLabel: '2.4 MB',
    narrative:
      'Revenue grew 14.2% quarter over quarter, driven by two new retainer clients onboarded in September. Operating expenses held steady, expanding gross margin.',
    highlights: ['Revenue up 14.2% vs Q3', 'Gross margin improved to 61%', 'Two new retainer clients onboarded'],
    series: MONTHLY_PL,
  },
  {
    id: 'r2',
    title: '2023 Annual Balance Sheet',
    category: 'balance_sheet',
    type: 'yearly',
    publishedAt: '2023-10-01',
    sizeLabel: '1.8 MB',
    narrative: 'Total assets increased year over year, with cash reserves covering roughly 4 months of operating expenses.',
    highlights: ['Assets up 9% YoY', 'Cash runway ~4 months', 'No new long-term debt'],
    series: MONTHLY_PL,
  },
  {
    id: 'r3',
    title: 'Q3 2023 Profit and Loss Statement',
    category: 'pl',
    type: 'quarterly',
    publishedAt: '2023-10-01',
    sizeLabel: '2.4 MB',
    narrative: 'Q3 closed with revenue of $180k against $105k in expenses, continuing the growth trend from Q2.',
    highlights: ['Net profit $75k', 'Opex ratio improved'],
    series: MONTHLY_PL,
  },
  {
    id: 'r4',
    title: 'September Tax Withholdings Audit',
    category: 'tax',
    type: 'vat',
    publishedAt: '2023-09-28',
    sizeLabel: '1.1 MB',
    narrative: 'A routine audit of September withholdings found no discrepancies. VAT liability is on track for the quarterly filing.',
    highlights: ['No discrepancies found', 'VAT liability on track'],
    series: [],
  },
  {
    id: 'r5',
    title: 'Q2 2023 Balance Sheet Detail',
    category: 'balance_sheet',
    type: 'quarterly',
    publishedAt: '2023-07-05',
    sizeLabel: '1.6 MB',
    narrative: 'Balance sheet detail for Q2, reconciled against bank statements with no outstanding items.',
    highlights: ['Fully reconciled', 'No outstanding items'],
    series: [],
  },
  {
    id: 'r6',
    title: 'Q2 2023 Profit and Loss Statement',
    category: 'pl',
    type: 'quarterly',
    publishedAt: '2023-07-01',
    sizeLabel: '2.2 MB',
    narrative: 'Q2 revenue grew modestly over Q1, with marketing spend the largest expense category.',
    highlights: ['Revenue up 6% vs Q1', 'Marketing was the largest expense'],
    series: [],
  },
];

const TOTAL_REPORT_COUNT = 124; // matches the Figma "Showing 1-4 of 124" footer

export const reportsService = {
  async getKeyMetrics(): Promise<ReportsKeyMetrics> {
    return KEY_METRICS;
  },
  async getMonthlyPL(): Promise<TrendPoint[]> {
    return MONTHLY_PL;
  },
  async getRecentInsights(limit = 2): Promise<Report[]> {
    return REPORTS.slice(0, limit);
  },
  async searchArchive(query: string, category: Report['category'] | 'all'): Promise<Report[]> {
    const q = query.trim().toLowerCase();
    return REPORTS.filter((r) => {
      const matchesQuery = q.length === 0 || r.title.toLowerCase().includes(q);
      const matchesCategory = category === 'all' || r.category === category;
      return matchesQuery && matchesCategory;
    });
  },
  async getReport(id: string): Promise<Report | null> {
    return REPORTS.find((r) => r.id === id) ?? null;
  },
  totalReportCount: TOTAL_REPORT_COUNT,
};
