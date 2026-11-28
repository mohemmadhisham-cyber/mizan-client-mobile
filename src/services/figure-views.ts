import { z } from 'zod';

import { supabase } from '@/lib/supabase';
import { DashboardUnavailableError, fetchDashboardAnswer } from '@/services/client-data';
import { calendarDay, type CustomerInvoice, displayText, FigureDetailError } from '@/services/figure-detail';

/**
 * More of what a Home figure is made of, asked for one view at a time from
 * the `client-dashboard` function:
 *
 *   period    money in, money out and profit for a chosen period, and the
 *             largest costs behind money out
 *   cash      each cash and bank account and its balance today
 *   invoices  the customer invoices, a page at a time
 *
 * The server sends these in whole minor units already. Nothing is multiplied
 * or rounded here.
 *
 * An older server does not know the views. A server that does says so in the
 * plain dashboard (`views`), which the app already has, so a view is asked
 * for only where it is offered: asking a server without it would have it
 * build a whole dashboard for nothing. "Not offered" is null, and the screens
 * stay as they were. A view that is offered and cannot be read is an error,
 * never a silent blank.
 */

const FUNCTION = 'client-dashboard';
const NAME_MAX = 200;
const MAX_GROUPS = 30;
const MAX_ACCOUNTS = 60;
const MAX_PAGE = 50;

export const PERIOD_KEYS = ['this_month', 'last_month', 'this_quarter', 'this_year'] as const;
export type PeriodKey = (typeof PERIOD_KEYS)[number];

/** A whole number of minor units. A fraction is not an amount the server should have sent. */
const minor = z.number().int().refine((value) => Number.isSafeInteger(value));
const currency = z.string().regex(/^[A-Z]{3}$/);

const groupSchema = z.object({ name: displayText(NAME_MAX), amount: minor });
const accountSchema = z.object({ name: displayText(NAME_MAX), balance: minor });
const invoiceSchema = z.object({
  id: z.string().min(1).max(40),
  number: displayText(60),
  customer: displayText(NAME_MAX),
  date: calendarDay,
  due: calendarDay,
  amountMinor: minor,
  residualMinor: minor,
  status: z.enum(['paid', 'partial', 'open', 'overdue']),
});

const periodSchema = z.object({
  ok: z.literal(true),
  view: z.literal('period'),
  currency,
  period: z.object({ key: z.enum(PERIOD_KEYS), from: calendarDay, to: calendarDay }),
  moneyIn: minor,
  moneyOut: minor,
  profit: minor,
  moneyOutGroups: z.array(z.unknown()).max(MAX_GROUPS).nullable(),
  moneyOutOther: minor,
});
const cashSchema = z.object({
  ok: z.literal(true),
  view: z.literal('cash'),
  currency,
  asOf: calendarDay,
  total: minor,
  accounts: z.array(z.unknown()).max(MAX_ACCOUNTS),
});
const invoicesSchema = z.object({
  ok: z.literal(true),
  view: z.literal('invoices'),
  currency,
  nextOffset: z.number().int().positive().nullable(),
  invoices: z.array(z.unknown()).max(MAX_PAGE),
});

export interface PeriodView {
  currency: string;
  period: PeriodKey;
  from: string;
  to: string;
  moneyIn: number;
  moneyOut: number;
  profit: number;
  /**
   * The largest costs, largest first. Null when the period has too much in it
   * for the server to break down, or the parts did not come to the whole.
   */
  groups: { name: string; amountMinor: number }[] | null;
  /** Everything not in `groups`, together. */
  otherMinor: number;
}

export interface CashView {
  currency: string;
  asOf: string;
  totalMinor: number;
  /** Empty when the accounts sent do not come to the total: a list that left some out is not shown. */
  accounts: { name: string; balanceMinor: number }[];
  /** Accounts the server sent that could not be shown. */
  unreadable: number;
}

export interface InvoicePage {
  currency: string;
  invoices: CustomerInvoice[];
  /** Where the next page starts. Null when this is the last. */
  nextOffset: number | null;
  unreadable: number;
}

/**
 * Whether the answer is the view that was asked for. An answer that names no
 * view is the plain dashboard of a server that does not know them: false. An
 * answer that names another view is a wrong answer, not an old server: it throws.
 */
function isView(answer: unknown, asked: string): boolean {
  const named = typeof answer === 'object' && answer !== null ? (answer as { view?: unknown }).view : undefined;
  if (typeof named !== 'string') return false;
  if (named !== asked) throw new FigureDetailError();
  return true;
}

function readRows<T>(rows: unknown[], schema: z.ZodType<T>): { read: T[]; unreadable: number } {
  const read: T[] = [];
  let unreadable = 0;
  for (const row of rows) {
    const parsed = schema.safeParse(row);
    if (parsed.success) read.push(parsed.data);
    else unreadable += 1;
  }
  return { read, unreadable };
}

/** Pure. Null: the server does not offer the view. Throws when it does and the answer cannot be read. */
export function parsePeriodView(answer: unknown, asked: PeriodKey): PeriodView | null {
  if (!isView(answer, 'period')) return null;
  const parsed = periodSchema.safeParse(answer);
  // An answer for another period than the one asked for must never be shown under this one's name.
  if (!parsed.success || parsed.data.period.key !== asked) throw new FigureDetailError();
  const data = parsed.data;

  let groups: PeriodView['groups'] = null;
  if (data.moneyOutGroups) {
    const rows = readRows(data.moneyOutGroups, groupSchema);
    const named = rows.read.reduce((sum, group) => sum + group.amount, 0);
    // The parts are shown only if every one could be read and together they come to the whole.
    if (rows.unreadable === 0 && named + data.moneyOutOther === data.moneyOut) {
      groups = rows.read.filter((group) => group.name.length > 0).map((group) => ({ name: group.name, amountMinor: group.amount }));
      if (groups.length !== rows.read.length) groups = null;
    }
  }
  return {
    currency: data.currency,
    period: data.period.key,
    from: data.period.from,
    to: data.period.to,
    moneyIn: data.moneyIn,
    moneyOut: data.moneyOut,
    profit: data.profit,
    groups,
    otherMinor: groups ? data.moneyOutOther : 0,
  };
}

/** Pure. Null: the server does not offer the view. Throws when it does and the answer cannot be read. */
export function parseCashView(answer: unknown): CashView | null {
  if (!isView(answer, 'cash')) return null;
  const parsed = cashSchema.safeParse(answer);
  if (!parsed.success) throw new FigureDetailError();
  const rows = readRows(parsed.data.accounts, accountSchema);
  // As with the parts of money out: the accounts are listed only if together they come to the total.
  const listed = rows.read.reduce((sum, account) => sum + account.balance, 0);
  const whole = rows.unreadable === 0 && listed === parsed.data.total;
  return {
    currency: parsed.data.currency,
    asOf: parsed.data.asOf,
    totalMinor: parsed.data.total,
    accounts: whole ? rows.read.map((account) => ({ name: account.name, balanceMinor: account.balance })) : [],
    unreadable: rows.unreadable,
  };
}

/** Pure. Null: the server does not offer the view. Throws when it does and the answer cannot be read. */
export function parseInvoicePage(answer: unknown): InvoicePage | null {
  if (!isView(answer, 'invoices')) return null;
  const parsed = invoicesSchema.safeParse(answer);
  if (!parsed.success) throw new FigureDetailError();
  const rows = readRows(parsed.data.invoices, invoiceSchema);
  return {
    currency: parsed.data.currency,
    invoices: rows.read,
    nextOffset: parsed.data.nextOffset,
    unreadable: rows.unreadable,
  };
}

/** Invoices from several pages as one list, each invoice once: a new invoice arriving between two pages moves the rest down by one. */
export function mergeInvoicePages(pages: readonly (InvoicePage | null)[]): CustomerInvoice[] {
  const seen = new Set<string>();
  const merged: CustomerInvoice[] = [];
  for (const page of pages) {
    for (const invoice of page?.invoices ?? []) {
      if (seen.has(invoice.id)) continue;
      seen.add(invoice.id);
      merged.push(invoice);
    }
  }
  return merged;
}

/**
 * Whether the server says it answers this view. Read from the plain dashboard,
 * which Home has already fetched: the same call and the same short cache.
 */
export function offersView(dashboard: unknown, view: string): boolean {
  const views = typeof dashboard === 'object' && dashboard !== null ? (dashboard as { views?: unknown }).views : undefined;
  return Array.isArray(views) && views.includes(view);
}

async function ask(body: Record<string, unknown> & { view: string }): Promise<unknown> {
  // Not offered: nothing is asked, and the answer is the same as an old server's would be.
  if (!offersView(await fetchDashboardAnswer(), body.view)) return null;
  const { data, error } = await supabase.functions.invoke<unknown>(FUNCTION, { body });
  if (error || typeof data !== 'object' || data === null) throw new DashboardUnavailableError('network_error');
  const answer = data as { ok?: unknown; error?: unknown };
  if (answer.ok !== true) throw new DashboardUnavailableError(typeof answer.error === 'string' ? answer.error : 'unavailable');
  return data;
}

export async function getPeriodView(period: PeriodKey): Promise<PeriodView | null> {
  return parsePeriodView(await ask({ view: 'period', period }), period);
}

export async function getCashView(): Promise<CashView | null> {
  return parseCashView(await ask({ view: 'cash' }));
}

export async function getInvoicePage(offset: number): Promise<InvoicePage | null> {
  return parseInvoicePage(await ask({ view: 'invoices', offset }));
}
