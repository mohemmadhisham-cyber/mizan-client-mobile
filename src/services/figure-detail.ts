import { z } from 'zod';

import { fetchDashboardAnswer } from '@/services/client-data';

/**
 * What a Home figure is made of: the last months, the biggest customers, the
 * newest customer invoices, and how long money takes to come in and go out.
 *
 * Nothing new is asked of the server. The `client-dashboard` function already
 * sends all of it with the summary; this module reads the parts the Home
 * screen did not use, from the same call and the same 30 second cache.
 *
 * The server sends these parts in whole currency units (the summary is in
 * minor units). They are turned into integer minor units here, once, at the
 * edge, so no screen ever adds or formats a fraction.
 */

const MAX_MONTHS = 24;
const MAX_CUSTOMERS = 20;
const MAX_INVOICES = 50;
const NAME_MAX = 200;
/** Days beyond which a collection or payment figure is a fault in the books, not a figure to show. */
const MAX_DAYS = 3650;
const REVENUE_KPI = 'client.dash.kpi.revenueMtd';

/** Characters that can reorder the text around them: removed from anything the server sends for display. */
const DIRECTION_OVERRIDES = /[‪-‮⁦-⁩]/g;
const text = (max: number) =>
  z
    .string()
    .max(max)
    .transform((value) => value.replace(DIRECTION_OVERRIDES, '').trim());

/** An amount in whole currency units, as the server sends it, turned into integer minor units. */
const major = z
  .number()
  .finite()
  .transform((value) => Math.round(value * 100))
  .refine((minor) => Number.isSafeInteger(minor));

/** A real calendar date as YYYY-MM-DD. */
const day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  });

const monthSchema = z.object({ revenue: major, expenses: major, profit: major });
const customerSchema = z.object({ name: text(NAME_MAX), amount: major });
const invoiceSchema = z.object({
  id: z.string().min(1).max(40),
  number: text(60),
  customer: text(NAME_MAX),
  date: day,
  due: day,
  amount: major,
  status: z.enum(['paid', 'open', 'overdue']),
});
const kpiSchema = z.object({ labelKey: z.string().max(80), delta: z.number().finite() });

const answerSchema = z.object({
  ok: z.literal(true),
  currency: z.string().regex(/^[A-Z]{3}$/),
  trend: z.array(z.unknown()).max(MAX_MONTHS).default([]),
  topCustomers: z.array(z.unknown()).max(MAX_CUSTOMERS).default([]),
  recentInvoices: z.array(z.unknown()).max(MAX_INVOICES).default([]),
  kpis: z.array(z.unknown()).max(20).default([]),
  arDays: z.number().int().min(0).max(MAX_DAYS).nullish(),
  apDays: z.number().int().min(0).max(MAX_DAYS).nullish(),
});

export interface FigureMonth {
  /** First day of the month, YYYY-MM-01. */
  month: string;
  moneyIn: number;
  moneyOut: number;
  profit: number;
}

export interface CustomerInvoice {
  id: string;
  number: string;
  customer: string;
  date: string;
  due: string;
  amountMinor: number;
  status: 'paid' | 'open' | 'overdue';
}

export interface FigureDetail {
  currency: string;
  /** Oldest first, ending with the current month. */
  months: FigureMonth[];
  topCustomers: { name: string; amountMinor: number }[];
  /** Newest first. The server sends only the latest few. */
  invoices: CustomerInvoice[];
  /** Days customers take to pay, or null when it cannot be worked out. */
  collectionDays: number | null;
  /** Days this business takes to pay suppliers, or null when it cannot be worked out. */
  paymentDays: number | null;
  /** Sales this month against last month, in whole percent, or null when there is nothing to compare. */
  moneyInChangePct: number | null;
  /** Lines the server sent that this version of the app could not read. Shown as a notice, never dropped silently. */
  unreadable: number;
}

export class FigureDetailError extends Error {
  constructor() {
    super('figure_detail_unreadable');
    this.name = 'FigureDetailError';
  }
}

/** The first day of the month `back` months before `now`, in UTC as the server counts months. */
function monthStart(now: Date, back: number): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - back, 1));
  return d.toISOString().slice(0, 10);
}

/** Reads each row on its own: one bad row is counted, and the rest are still shown. */
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

/** Pure: the server's answer in, what the detail screens show out. Throws when the answer cannot be read at all. */
export function parseFigureDetail(answer: unknown, now: Date): FigureDetail {
  const parsed = answerSchema.safeParse(answer);
  if (!parsed.success) throw new FigureDetailError();
  const data = parsed.data;

  const months = readRows(data.trend, monthSchema);
  const customers = readRows(data.topCustomers, customerSchema);
  const invoices = readRows(data.recentInvoices, invoiceSchema);
  const kpis = readRows(data.kpis, kpiSchema);

  // The server names each month by a short English word. Its place in the list is what
  // says which month it is: the last is the current month, each one before is a month earlier.
  const count = months.read.length;
  const change = kpis.read.find((kpi) => kpi.labelKey === REVENUE_KPI)?.delta;

  return {
    currency: data.currency,
    // If any month cannot be read, the places of the others cannot be trusted, so none is shown.
    months:
      months.unreadable > 0
        ? []
        : months.read.map((row, index) => ({
            month: monthStart(now, count - 1 - index),
            moneyIn: row.revenue,
            moneyOut: row.expenses,
            profit: row.profit,
          })),
    topCustomers: customers.read
      .filter((customer) => customer.name.length > 0)
      .map((customer) => ({ name: customer.name, amountMinor: customer.amount })),
    invoices: invoices.read
      .map((invoice) => ({
        id: invoice.id,
        number: invoice.number,
        customer: invoice.customer,
        date: invoice.date,
        due: invoice.due,
        amountMinor: invoice.amount,
        status: invoice.status,
      }))
      .sort((a, b) => b.date.localeCompare(a.date)),
    // The server sends 0 when there is nothing to work it out from: that is "not known", not "no days".
    collectionDays: data.arDays ? data.arDays : null,
    paymentDays: data.apDays ? data.apDays : null,
    // The same for the change: 0 is what it sends when last month had no sales to compare with.
    moneyInChangePct: change ? Math.round(change) : null,
    unreadable: months.unreadable + customers.unreadable + invoices.unreadable,
  };
}

/** What the Home figures are made of, for the signed-in client. */
export async function getFigureDetail(): Promise<FigureDetail> {
  return parseFigureDetail(await fetchDashboardAnswer(), new Date());
}
