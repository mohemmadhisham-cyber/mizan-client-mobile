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

type Loaded = { mobile: MobileSummary; answer: unknown };

/** How long one answer from the server is reused. Matches the app's query stale time. */
const CACHE_MS = 30_000;

let cached: { at: number; loaded: Loaded } | null = null;
let inflight: Promise<Loaded> | null = null;
/**
 * Moves on every clear. An answer that set out before a clear belongs to
 * what was cleared (an earlier pull, or the person who was signed in before)
 * and is not kept.
 */
let generation = 0;

/**
 * Forget the dashboard: the next read goes to the server. Called on a pull to
 * refresh, and whenever the signed-in person changes, so one person's figures
 * can never be shown to the next. A request still in the air is let go: its
 * answer is not kept and no later caller is given it.
 */
export function clearDashboardCache(): void {
  generation += 1;
  cached = null;
  inflight = null;
}

// Coalesce the dashboard queries onto a single edge-function round trip (each
// getX below, and the detail screens, would otherwise re-invoke it). Callers
// that arrive while a request is in the air share it, so a cold start or a
// pull to refresh is still one call, not five.
function fetchLoaded(): Promise<Loaded> {
  if (cached && Date.now() - cached.at < CACHE_MS) return Promise.resolve(cached.loaded);
  if (inflight) return inflight;
  const startedIn = generation;
  const request: Promise<Loaded> = loadDashboard()
    .then((loaded) => {
      if (startedIn === generation) cached = { at: Date.now(), loaded };
      return loaded;
    })
    .finally(() => {
      if (inflight === request) inflight = null;
    });
  inflight = request;
  return request;
}

function fetchMobile(): Promise<MobileSummary> {
  return fetchLoaded().then((loaded) => loaded.mobile);
}

async function loadDashboard(): Promise<Loaded> {
  const { data, error } = await supabase.functions.invoke('client-dashboard');
  if (error || !data) throw new DashboardUnavailableError('network_error');
  if (!data.ok) throw new DashboardUnavailableError(data.error ?? 'unavailable');
  const mobile = data.mobile as MobileSummary | undefined;
  if (!mobile) throw new DashboardUnavailableError('unavailable');
  return { mobile, answer: data };
}

/**
 * The server's whole answer, as sent, for the screens that show what a figure
 * is made of. It is the same call and the same cache as the summary: opening
 * a detail screen from Home asks the server nothing more.
 */
export function fetchDashboardAnswer(): Promise<unknown> {
  return fetchLoaded().then((loaded) => loaded.answer);
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
    // A failed count must not read as "nothing is waiting".
    if (approvals.error || docs.error) throw new DashboardUnavailableError('actions_unavailable');
    const items: ActionItem[] = [];
    const approvalCount = approvals.count ?? 0;
    const docCount = docs.count ?? 0;
    if (approvalCount > 0) items.push({ id: 'a-approvals', label: i18n.t('tasks.actionApprovals'), count: approvalCount, href: '/tasks' });
    if (docCount > 0) items.push({ id: 'a-docs', label: i18n.t('tasks.actionDocuments'), count: docCount, href: '/documents' });
    return items;
  },
};
