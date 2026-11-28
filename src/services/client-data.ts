import i18n from '@/i18n';
import { supabase } from '@/lib/supabase';

import type { ActionItem, InsightCard, KpiBlock, Severity, TrendPoint } from './types';

/**
 * Client dashboard data — real, backed by the client's own Odoo books and
 * Supabase tables. KPIs + revenue/expense series come from the `client-
 * dashboard` edge function's `mobile` block (integer MINOR units, computed
 * live from the client's dedicated Odoo db). Insights come from the real
 * `insights` table (RLS: client_id + audience client/both). Action counts are
 * real pending-item counts (approvals awaiting the client's decision +
 * document requests to fulfil). Nothing here is fabricated; when the client's
 * Odoo workspace isn't provisioned yet the service throws a typed error the
 * screen turns into an empty state.
 */

type MobileSummary = {
  cash: number;
  moneyIn: number;
  moneyOut: number;
  profit: number;
  vatDue: number;
  vatDueDate: string;
  currency: string;
  revenueSeries: { month: string; value: number }[];
  expenseSeries: { month: string; value: number }[];
};

export class DashboardUnavailableError extends Error {
  constructor(public code: string) {
    super(code);
    this.name = 'DashboardUnavailableError';
  }
}

let cached: { at: number; data: MobileSummary } | null = null;

/** Forget the cached summary so the next read goes to the server (pull to refresh). */
export function clearDashboardCache(): void {
  cached = null;
}

let inflight: Promise<MobileSummary> | null = null;

// Coalesce the five dashboard queries onto a single edge-function round trip
// (each getX below would otherwise re-invoke it). 30s window matches the
// app's query staleTime. Callers that arrive while a request is in the air
// share it, so a cold start or a pull to refresh is still one call, not five.
function fetchMobile(): Promise<MobileSummary> {
  if (cached && Date.now() - cached.at < 30_000) return Promise.resolve(cached.data);
  inflight ??= loadMobile().finally(() => {
    inflight = null;
  });
  return inflight;
}

async function loadMobile(): Promise<MobileSummary> {
  const { data, error } = await supabase.functions.invoke('client-dashboard');
  if (error || !data) throw new DashboardUnavailableError('network_error');
  if (!data.ok) throw new DashboardUnavailableError(data.error ?? 'unavailable');
  const mobile = data.mobile as MobileSummary | undefined;
  if (!mobile) throw new DashboardUnavailableError('unavailable');
  cached = { at: Date.now(), data: mobile };
  return mobile;
}

function currencyCode(c: string): 'AED' | 'SAR' {
  return c === 'SAR' ? 'SAR' : 'AED';
}

function severityOf(s: string): Severity {
  if (s === 'good' || s === 'warn' || s === 'alert' || s === 'info') return s;
  return 'info';
}

export const clientDataService = {
  async getKpis(): Promise<KpiBlock> {
    const m = await fetchMobile();
    return {
      cash: m.cash,
      moneyIn: m.moneyIn,
      moneyOut: m.moneyOut,
      profit: m.profit,
      vatDue: m.vatDue,
      vatDueDate: m.vatDueDate,
      currency: currencyCode(m.currency),
    };
  },

  async getRevenueSeries(): Promise<TrendPoint[]> {
    return (await fetchMobile()).revenueSeries;
  },

  async getExpenseSeries(): Promise<TrendPoint[]> {
    return (await fetchMobile()).expenseSeries;
  },

  async getInsights(): Promise<InsightCard[]> {
    const { data, error } = await supabase
      .from('insights')
      .select('id, title, summary, severity, generated_at')
      .order('generated_at', { ascending: false })
      .limit(5);
    if (error) return [];
    return ((data ?? []) as { id: string; title: string; summary: string | null; severity: string }[]).map((r) => ({
      id: r.id,
      title: r.title,
      body: r.summary ?? '',
      severity: severityOf(r.severity),
    }));
  },

  async getActions(): Promise<ActionItem[]> {
    const [approvals, docs] = await Promise.all([
      supabase.from('approval_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('document_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    ]);
    const items: ActionItem[] = [];
    const approvalCount = approvals.count ?? 0;
    const docCount = docs.count ?? 0;
    if (approvalCount > 0) items.push({ id: 'a-approvals', label: i18n.t('tasks.actionApprovals'), count: approvalCount, href: '/tasks' });
    if (docCount > 0) items.push({ id: 'a-docs', label: i18n.t('tasks.actionDocuments'), count: docCount, href: '/documents' });
    return items;
  },
};
