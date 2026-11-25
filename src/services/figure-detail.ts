import { z } from 'zod';

import { fetchDashboardAnswer } from '@/services/client-data';

/**
 * What a Home figure is made of: the last months, the biggest customers, the
 * newest customer invoices, and how much is owed each way.
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
/** Days beyond which the figure is a fault in the books, not a figure to show. */
const MAX_DAYS = 3650;
/** The short month names the server labels its months with, in calendar order. */
const SERVER_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

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
  // `+ 0` turns a negative zero (a tiny negative that rounds to nothing) into plain zero.
  .transform((value) => Math.round(value * 100) + 0)
  .refine((minor) => Number.isSafeInteger(minor));

/** A real calendar date as YYYY-MM-DD. */
const day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  });

const monthSchema = z.object({ month: z.string().max(12), revenue: major, expenses: major, profit: major });
const customerSchema = z.object({ name: text(NAME_MAX), amount: major });
const invoiceSchema = z.object({
  id: z.string().min(1).max(40),
  number: text(60),
  customer: text(NAME_MAX),
  date: day,
  due: day,
  amount: major,
  /** What is still to be paid, when the server says. Older servers do not send it. */
  residual: major.nullish(),
  status: z.enum(['paid', 'partial', 'open', 'overdue']),
});

const answerSchema = z.object({
  ok: z.literal(true),
  currency: z.string().regex(/^[A-Z]{3}$/),
  trend: z.array(z.unknown()).max(MAX_MONTHS).default([]),
  topCustomers: z.array(z.unknown()).max(MAX_CUSTOMERS).default([]),
  recentInvoices: z.array(z.unknown()).max(MAX_INVOICES).default([]),
  // Read loosely: a figure out of range is left out, it does not spoil the rest of the answer.
  arDays: z.unknown().optional(),
  apDays: z.unknown().optional(),
});

export interface FigureMonth {
  /** First day of the month, YYYY-MM-01. */
  month: string;
  moneyIn: number;
  moneyOut: number;
  profit: number;
  /** The month is not over: the figures are so far. */
  soFar: boolean;
}

export interface CustomerInvoice {
  id: string;
  number: string;
  customer: string;
  date: string;
  due: string;
  amountMinor: number;
  /** What is still to be paid, when known. */
  residualMinor: number | null;
  status: 'paid' | 'partial' | 'open' | 'overdue';
}

export interface FigureDetail {
  currency: string;
  /** Oldest first, ending with the current month. Empty when the server's months cannot be trusted. */
  months: FigureMonth[];
  topCustomers: { name: string; amountMinor: number }[];
  /** Newest first. The server sends only the latest few. */
  invoices: CustomerInvoice[];
  /** What customers owe, as days of sales. Null when it cannot be worked out. */
  receivableDays: number | null;
  /** What is owed to suppliers, as days of costs. Null when it cannot be worked out. */
  payableDays: number | null;
  /** Lines the server sent that this version of the app could not show. Said on screen, never dropped silently. */
  unreadable: number;
}

export class FigureDetailError extends Error {
  constructor() {
    super('figure_detail_unreadable');
    this.name = 'FigureDetailError';
  }
}

/** The first day of the month `back` months before `now`, in UTC as the server counts months. */
function monthStart(now: Date, back: number): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - back, 1));
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

/**
 * A whole number of days the app is willing to show. The server sends 0 when
 * it has nothing to work the figure out from, and can send a negative or a
 * huge number from unusual books: none of those is a figure, so none is shown.
 */
function days(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 && value <= MAX_DAYS ? value : null;
}

/** Pure: the server's answer in, what the detail screens show out. Throws when the answer cannot be read at all. */
export function parseFigureDetail(answer: unknown, now: Date): FigureDetail {
  const parsed = answerSchema.safeParse(answer);
  if (!parsed.success) throw new FigureDetailError();
  const data = parsed.data;

  const monthRows = readRows(data.trend, monthSchema);
  const customers = readRows(data.topCustomers, customerSchema);
  const invoices = readRows(data.recentInvoices, invoiceSchema);

  // The months are shown in the app's language, so each is named by its place: the last is the
  // current month, each one before is a month earlier. The server's own label is the check. If
  // one row cannot be read, or one label is not the month its place says, the places cannot be
  // trusted and no month is shown. (A server fault at the end of long months did exactly this.)
  const count = monthRows.read.length;
  const expected = monthRows.read.map((_, index) => monthStart(now, count - 1 - index));
  const monthsTrusted =
    monthRows.unreadable === 0 && monthRows.read.every((row, index) => row.month === SERVER_MONTHS[expected[index].getUTCMonth()]);

  return {
    currency: data.currency,
    months: monthsTrusted
      ? monthRows.read.map((row, index) => ({
          month: expected[index].toISOString().slice(0, 10),
          moneyIn: row.revenue,
          moneyOut: row.expenses,
          profit: row.profit,
          soFar: index === count - 1,
        }))
      : [],
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
        residualMinor: invoice.residual ?? null,
        status: invoice.status,
      }))
      .sort((a, b) => b.date.localeCompare(a.date)),
    receivableDays: days(data.arDays),
    payableDays: days(data.apDays),
    unreadable: (monthsTrusted ? 0 : count + monthRows.unreadable) + customers.unreadable + invoices.unreadable,
  };
}

/** What the Home figures are made of, for the signed-in client. */
export async function getFigureDetail(): Promise<FigureDetail> {
  return parseFigureDetail(await fetchDashboardAnswer(), new Date());
}
