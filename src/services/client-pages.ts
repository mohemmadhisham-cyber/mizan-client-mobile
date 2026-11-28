import { FunctionsHttpError } from '@supabase/supabase-js';
import { z } from 'zod';

import { assertSupabaseConfigured, EXPO_PUBLIC_WEB_APP_URL } from '@/lib/env';
import { supabase } from '@/lib/supabase';

/**
 * Three pages that ask the server's `connect` function: what the accountant's
 * firm does for this business ("Your services"), what the business owes the
 * firm and can pay ("Invoices to pay"), and asking the firm for a meeting.
 *
 * The server decides whose these are, from the session: the app sends no
 * client id. Until the server offers an action it answers 404, read here as
 * "not offered", and the screen says so instead of failing. Any other failure
 * is thrown, so the screen can say it could not be read. Answers are checked
 * before they are shown: one that does not have the expected shape is a failure.
 *
 * Paying never happens in the app. A due invoice carries a token for the
 * hosted pay page on the web, which the app opens in the phone's browser.
 */

const FUNCTION = 'connect';
const NOT_OFFERED_STATUS = 404;
const PAY_TOKEN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type Offered<T> = { status: 'ok'; value: T } | { status: 'not_offered' };

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const minor = z.number().int().nonnegative();
const currency = z.string().regex(/^[A-Z]{3}$/);

const engagementSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  status: z.enum(['active', 'closed']),
  periodStart: day.nullable(),
  periodEnd: day.nullable(),
});

const serviceSchema = z.object({
  id: z.string().min(1),
  nameEn: z.string().min(1),
  nameAr: z.string().min(1),
  cadence: z.enum(['one_time', 'monthly', 'quarterly', 'yearly']),
  priceMinor: minor,
  currency,
  engagementId: z.string().min(1),
  since: z.string().nullable(),
});

const servicesAnswer = z.object({
  ok: z.literal(true),
  firm: z.string().nullable(),
  engagements: z.array(engagementSchema),
  services: z.array(serviceSchema),
});

const invoiceSchema = z.object({
  id: z.string().min(1),
  description: z.string(),
  amountMinor: minor,
  currency,
  state: z.enum(['due', 'processing', 'paid', 'refunded', 'failed']),
  createdAt: z.string().nullable(),
  paidAt: z.string().nullable(),
  payToken: z.string().regex(PAY_TOKEN).nullable(),
  payUntil: z.string().nullable(),
});

const invoicesAnswer = z.object({ ok: z.literal(true), firm: z.string().nullable(), invoices: z.array(invoiceSchema) });

const slotsAnswer = z.object({
  ok: z.literal(true),
  firm: z.string().nullable(),
  minutes: z.number().int().positive(),
  timeZone: z.string().min(1),
  accepting: z.boolean(),
  slots: z.array(z.object({ date: day, start: hhmm, end: hhmm })),
});

const bookedAnswer = z.object({
  ok: z.literal(true),
  meeting: z.object({ id: z.string().min(1), date: day, start: hhmm, status: z.literal('pending') }),
});

export type Engagement = z.infer<typeof engagementSchema>;
export type ClientService = z.infer<typeof serviceSchema>;
export type ServiceCadence = ClientService['cadence'];
export type ClientServices = Omit<z.infer<typeof servicesAnswer>, 'ok'>;
export type ClientInvoice = z.infer<typeof invoiceSchema>;
export type ClientInvoices = Omit<z.infer<typeof invoicesAnswer>, 'ok'>;
export type MeetingSlots = Omit<z.infer<typeof slotsAnswer>, 'ok'>;
export type MeetingSlot = MeetingSlots['slots'][number];

type Call = { status: number | null; data: unknown; errorBody: unknown };

/** Calls one action. A failed call keeps its status and, when it has one, its JSON body. */
async function call(action: string, body: Record<string, unknown> = {}): Promise<Call> {
  assertSupabaseConfigured();
  const { data, error } = await supabase.functions.invoke<unknown>(FUNCTION, { body: { action, ...body } });
  if (!error) return { status: 200, data, errorBody: null };
  if (!(error instanceof FunctionsHttpError)) return { status: null, data: null, errorBody: null };
  const response = error.context as Response;
  let errorBody: unknown = null;
  try {
    errorBody = await response.json();
  } catch {
    // A body that is not JSON says nothing more than its status.
  }
  return { status: response.status, data: null, errorBody };
}

async function read<T>(action: string, schema: z.ZodType<{ ok: true } & T>, body?: Record<string, unknown>): Promise<Offered<T>> {
  const answer = await call(action, body);
  if (answer.status === NOT_OFFERED_STATUS) return { status: 'not_offered' };
  if (answer.status !== 200) throw new Error(`${action}_failed`);
  const parsed = schema.safeParse(answer.data);
  if (!parsed.success) throw new Error(`${action}_unreadable`);
  const { ok: _ok, ...value } = parsed.data;
  return { status: 'ok', value: value as unknown as T };
}

export function getClientServices(): Promise<Offered<ClientServices>> {
  return read<ClientServices>('client_services', servicesAnswer);
}

export function getClientInvoices(): Promise<Offered<ClientInvoices>> {
  return read<ClientInvoices>('client_invoices', invoicesAnswer);
}

/** The firm's free slots from today, six weeks ahead (the server's limit). */
export function getMeetingSlots(): Promise<Offered<MeetingSlots>> {
  return read<MeetingSlots>('meeting_slots', slotsAnswer);
}

export interface MeetingRequest {
  date: string;
  start: string;
  note?: string;
}

export type BookingOutcome =
  /** The firm has the request; it confirms or declines it. */
  | { status: 'requested'; date: string; start: string }
  /** Someone took that time a moment ago. */
  | { status: 'slot_taken' }
  /** This person already has as many open requests as a firm takes. */
  | { status: 'too_many_open' }
  | { status: 'not_offered' };

/** Asks the firm for one of its free slots. Throws when it could not be sent or the answer cannot be trusted. */
export async function bookMeeting(request: MeetingRequest): Promise<BookingOutcome> {
  const note = request.note?.trim();
  const answer = await call('meeting_book', { date: request.date, start: request.start, ...(note ? { note } : {}) });
  if (answer.status === NOT_OFFERED_STATUS) return { status: 'not_offered' };
  if (answer.status === 409) {
    const error = (answer.errorBody as { error?: unknown } | null)?.error;
    if (error === 'too_many_open') return { status: 'too_many_open' };
    return { status: 'slot_taken' };
  }
  if (answer.status !== 200) throw new Error('meeting_book_failed');
  const parsed = bookedAnswer.safeParse(answer.data);
  if (!parsed.success) throw new Error('meeting_book_unreadable');
  return { status: 'requested', date: parsed.data.meeting.date, start: parsed.data.meeting.start };
}

/** The hosted page that takes the payment. Null for a token that is not of the shape the server makes. */
export function payPageUrl(token: string | null): string | null {
  if (!token || !PAY_TOKEN.test(token)) return null;
  return `${EXPO_PUBLIC_WEB_APP_URL.replace(/\/+$/, '')}/pay/${token}`;
}

/** The days that have at least one free slot, in order, each with its slots. */
export function slotsByDay(slots: MeetingSlot[]): { date: string; slots: MeetingSlot[] }[] {
  const days = new Map<string, MeetingSlot[]>();
  for (const slot of slots) days.set(slot.date, [...(days.get(slot.date) ?? []), slot]);
  return [...days.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, list]) => ({ date, slots: [...list].sort((x, y) => x.start.localeCompare(y.start)) }));
}

/** What is due, added up, when every due invoice is in one currency. Null when nothing is due or currencies differ. */
export function totalDue(invoices: ClientInvoice[]): { amountMinor: number; currency: string; count: number } | null {
  const due = invoices.filter((invoice) => invoice.state === 'due');
  if (!due.length) return null;
  const currencies = new Set(due.map((invoice) => invoice.currency));
  if (currencies.size !== 1) return null;
  return { amountMinor: due.reduce((sum, invoice) => sum + invoice.amountMinor, 0), currency: due[0].currency, count: due.length };
}
