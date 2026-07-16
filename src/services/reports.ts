import { supabase } from '@/lib/supabase';

import type { Report, ReportCategory, ReportsKeyMetrics, ReportType, TrendPoint } from './types';

/**
 * Reports & Insights — real, DB-backed. Reads the client's own PUBLISHED
 * report_deliveries (RLS "report_deliveries client read": client_id =
 * user_client(auth.uid())). Each row's `payload.figures` holds the real,
 * minor-unit numbers report-generate computed from the client's Odoo books
 * (P&L: revenue/cogs/gross_profit/opex/net_income; BS: assets/liabilities/
 * equity totals). Key metrics + the monthly-P&L series are derived from those
 * real figures — never fabricated. When the client has no published reports
 * yet, everything returns empty and the screens show their empty states.
 */

type DeliveryRow = {
  id: string;
  title: string;
  status: string;
  published_at: string | null;
  created_at: string;
  file_path: string | null;
  payload: {
    kind?: string;
    period?: { key?: string; label?: string; start?: string; end?: string };
    currency?: string;
    figures?: Record<string, number>;
  } | null;
};

function categoryFor(kind: string): ReportCategory {
  if (/bs|balance/.test(kind)) return 'balance_sheet';
  if (/vat|tax/.test(kind)) return 'tax';
  if (/audit/.test(kind)) return 'audit';
  return 'pl';
}

function typeFor(kind: string, periodKey: string): ReportType {
  const s = `${kind} ${periodKey}`.toLowerCase();
  if (/vat/.test(s)) return 'vat';
  if (/cash/.test(s)) return 'cashflow';
  if (/year|annual/.test(s)) return 'yearly';
  if (/q[1-4]|quarter/.test(s)) return 'quarterly';
  return 'monthly';
}

function currencyOf(payload: DeliveryRow['payload']): 'AED' | 'SAR' {
  return payload?.currency === 'SAR' ? 'SAR' : 'AED';
}

function buildNarrative(payload: DeliveryRow['payload']): { narrative: string; highlights: string[] } {
  const f = payload?.figures ?? {};
  const label = payload?.period?.label ?? 'the period';
  if (typeof f.net_income === 'number' || typeof f.revenue === 'number') {
    const rev = f.revenue ?? 0;
    const net = f.net_income ?? 0;
    const gp = f.gross_profit ?? 0;
    const margin = rev > 0 ? Math.round((gp / rev) * 100) : 0;
    return {
      narrative: `Report for ${label}. Revenue and net income are computed from your posted books.`,
      highlights: [
        `Net income: ${(net / 100).toLocaleString()} `,
        rev > 0 ? `Gross margin: ${margin}%` : 'Revenue not yet posted',
      ],
    };
  }
  if (typeof f.assets_total === 'number') {
    return {
      narrative: `Balance sheet as of ${label}, reconciled from your posted books.`,
      highlights: [`Total assets: ${((f.assets_total ?? 0) / 100).toLocaleString()}`],
    };
  }
  return { narrative: `Report for ${label}.`, highlights: [] };
}

function toReport(row: DeliveryRow): Report {
  const kind = row.payload?.kind ?? '';
  const periodKey = row.payload?.period?.key ?? '';
  const { narrative, highlights } = buildNarrative(row.payload);
  return {
    id: row.id,
    title: row.title,
    category: categoryFor(kind),
    type: typeFor(kind, periodKey),
    publishedAt: (row.published_at ?? row.created_at).slice(0, 10),
    sizeLabel: row.file_path ? 'PDF' : '—',
    narrative,
    highlights,
    series: [],
  };
}

async function fetchPublished(limit = 100): Promise<DeliveryRow[]> {
  const { data, error } = await supabase
    .from('report_deliveries')
    .select('id, title, status, published_at, created_at, file_path, payload')
    .eq('status', 'published')
    .order('published_at', { ascending: false, nullsFirst: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as DeliveryRow[];
}

export const reportsService = {
  async getKeyMetrics(): Promise<ReportsKeyMetrics> {
    const rows = await fetchPublished(24);
    const pls = rows.filter((r) => categoryFor(r.payload?.kind ?? '') === 'pl' && typeof r.payload?.figures?.revenue === 'number');
    // Revenue growth = latest published P&L revenue vs the one before it — real
    // figures, or 0% when there aren't two P&Ls yet.
    let revenueGrowthPct = 0;
    if (pls.length >= 2) {
      const latest = pls[0].payload!.figures!.revenue;
      const prev = pls[1].payload!.figures!.revenue;
      revenueGrowthPct = prev > 0 ? Math.round(((latest - prev) / prev) * 1000) / 10 : 0;
    }
    return {
      revenueGrowthPct,
      savingsPotentialMinor: 0,
      savingsCategoryCount: 0,
      currency: rows.length ? currencyOf(rows[0].payload) : 'AED',
    };
  },

  async getMonthlyPL(): Promise<TrendPoint[]> {
    const rows = await fetchPublished(12);
    return rows
      .filter((r) => typeof r.payload?.figures?.revenue === 'number')
      .slice(0, 6)
      .reverse()
      .map((r) => ({
        month: (r.payload?.period?.label ?? '').slice(0, 3) || new Date(r.created_at).toLocaleString(undefined, { month: 'short' }),
        value: r.payload!.figures!.revenue,
      }));
  },

  async getRecentInsights(limit = 2): Promise<Report[]> {
    const rows = await fetchPublished(limit);
    return rows.map(toReport);
  },

  async searchArchive(query: string, category: Report['category'] | 'all'): Promise<Report[]> {
    const rows = await fetchPublished(100);
    const q = query.trim().toLowerCase();
    return rows.map(toReport).filter((r) => {
      const matchesQuery = q.length === 0 || r.title.toLowerCase().includes(q);
      const matchesCategory = category === 'all' || r.category === category;
      return matchesQuery && matchesCategory;
    });
  },

  async getReport(id: string): Promise<Report | null> {
    const { data, error } = await supabase
      .from('report_deliveries')
      .select('id, title, status, published_at, created_at, file_path, payload')
      .eq('id', id)
      .maybeSingle();
    if (error || !data) return null;
    return toReport(data as DeliveryRow);
  },

  /** Signed URL to the report's PDF in the documents bucket, if one exists. */
  async getReportPdfUrl(id: string): Promise<string | null> {
    const { data } = await supabase.from('report_deliveries').select('file_path').eq('id', id).maybeSingle();
    const path = (data as { file_path: string | null } | null)?.file_path;
    if (!path) return null;
    const { data: signed } = await supabase.storage.from('documents').createSignedUrl(path, 300);
    return signed?.signedUrl ?? null;
  },
};
