import { FunctionsHttpError } from '@supabase/supabase-js';
import { z } from 'zod';

import { assertSupabaseConfigured } from '@/lib/env';
import { supabase } from '@/lib/supabase';

/**
 * "Requests from your accountant": changes an accountant prepared and sent for
 * the client's owner to approve (new prices, loan payment drafts, customer
 * statements, a budget for a year). Backed by the `client-targets` edge
 * function.
 *
 * The server owns every rule: it works out the client from the session, checks
 * the one-time code, lets only one answer win, and applies the change. This
 * module therefore sends no client id, firm id or amount, and never changes a
 * figure: screens show exactly what the server returned, because that is what
 * the owner approves.
 */

const FUNCTION = 'client-targets';

/** The one scope a one-time code is requested for when approving a request. */
const STEP_UP_SCOPE = 'targets.approve';

/** Longest decline reason the server accepts. */
export const DECLINE_REASON_MAX = 500;

/** Query key of the pending list, shared by the Action Center and the request screen. */
export const REQUESTS_QUERY_KEY = ['accountant-requests'] as const;

/** The server links a notification to its request as `/approvals/<request id>`. */
const APPROVAL_LINK = /^\/approvals\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

/**
 * The request id inside a notification link, or null when the link is not an
 * approval link. Only this exact shape is followed: a link is server data and
 * must never send the app to an arbitrary route.
 */
export function requestIdFromLink(link: string | null | undefined): string | null {
  return link ? (APPROVAL_LINK.exec(link)?.[1] ?? null) : null;
}

// Limits on what one request may carry. A request over a limit is counted as
// unreadable instead of being cut short: the owner approves what the screen
// shows, so it must never show part of a request.
const MAX_CHANGES = 500;
const MAX_QUARTERS = 4;

/**
 * Text from the server, shown as-is apart from one thing: direction-override
 * characters are removed, so a title or name cannot reorder the text around it
 * (for example to make "declined" read as "approved"). Arabic and mixed text
 * are unaffected; they do not need these characters.
 */
const DIRECTION_OVERRIDES = /[‪-‮⁦-⁩]/g;
const text = (max: number) =>
  z
    .string()
    .max(max)
    .transform((value) => value.replace(DIRECTION_OVERRIDES, ''));

const minorSchema = z.number().int().nullish();
const currencySchema = z.string().regex(/^[A-Z]{3}$/);
const decimalsSchema = z.number().int().min(0).max(4);

const lineIdSchema = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);

const changeSchema = z.object({
  /** On a price change: the product id the owner sends back to approve only some lines. */
  id: lineIdSchema.nullish(),
  /**
   * Not sent today. When the server sends it, lines with the same value are
   * variants of one product: they share one price, so they are chosen together.
   */
  product: lineIdSchema.nullish(),
  label: text(200),
  amountMinor: minorSchema,
  from: minorSchema,
  to: minorSchema,
  date: z.string().max(40).nullish(),
});

const summarySchema = z.object({
  revenueMinor: z.number().int(),
  cogsMinor: z.number().int(),
  opexMinor: z.number().int(),
  netProfitMinor: z.number().int(),
  quarters: z
    .array(z.object({ revenueMinor: z.number().int(), netProfitMinor: z.number().int() }))
    .max(MAX_QUARTERS)
    .default([]),
  outsidePnlMinor: z.number().int().default(0),
});

const budgetSchema = z.object({
  fiscalYear: z.number().int(),
  currency: currencySchema,
  decimals: decimalsSchema,
  summary: summarySchema,
  previous: summarySchema.nullish(),
  message: text(2000).nullish(),
});

const isAmount = (value: unknown): value is number => typeof value === 'number';

const requestSchema = z
  .object({
    id: z.uuid(),
    kind: z.string().min(1).max(60),
    title: text(200),
    titleAr: text(200).nullish(),
    sentAt: z.string().max(40),
    from: text(120).nullish(),
    // Not sent today (the older kinds are AED with two decimals). Read if the
    // server starts sending them, so figures are never shown in the wrong unit.
    currency: currencySchema.nullish(),
    decimals: decimalsSchema.nullish(),
    changes: z.array(changeSchema).max(MAX_CHANGES).default([]),
    budget: budgetSchema.nullish(),
  })
  // A kind this app knows must carry the figures its screen shows. A row with a
  // label and no figure would ask the owner to approve something they cannot see.
  .superRefine((request, ctx) => {
    const fail = (message: string) => ctx.addIssue({ code: 'custom', message });
    if (request.kind === 'activate_budget' && !request.budget) fail('budget request without its budget');
    if (request.kind === 'set_prices' && !request.changes.every((c) => isAmount(c.from) && isAmount(c.to))) {
      fail('price row without both prices');
    }
    if ((request.kind === 'loan_drafts' || request.kind === 'send_statements') && !request.changes.every((c) => isAmount(c.amountMinor))) {
      fail('row without an amount');
    }
  });

const listSchema = z.object({ ok: z.literal(true), requests: z.array(z.unknown()) });

export type RequestChange = z.infer<typeof changeSchema>;
export type BudgetSummary = z.infer<typeof summarySchema>;
export type BudgetDetail = z.infer<typeof budgetSchema>;
export type AccountantRequest = z.infer<typeof requestSchema>;

/** Kinds this app draws with their own layout. Any other kind is drawn from its title and changes. */
export type KnownRequestKind = 'set_prices' | 'loan_drafts' | 'send_statements' | 'activate_budget';

export interface PendingRequests {
  requests: AccountantRequest[];
  /** Requests the server sent that this version of the app could not read. Shown as a notice, never dropped silently. */
  unreadable: number;
}

export class AccountantRequestsError extends Error {
  constructor(public code: string) {
    super(code);
    this.name = 'AccountantRequestsError';
  }
}

async function errorCodeFrom(error: unknown): Promise<string> {
  if (error instanceof FunctionsHttpError) {
    try {
      const body: unknown = await error.context.json();
      const code = (body as { error?: unknown } | null)?.error;
      if (typeof code === 'string' && code.length > 0) return code;
    } catch {
      // The body was not JSON: fall through to the generic code.
    }
    return 'server_error';
  }
  return 'network_error';
}

/** Requests still waiting for this client's answer, newest first as the server orders them. */
export async function listPendingRequests(): Promise<PendingRequests> {
  assertSupabaseConfigured();
  const { data, error } = await supabase.functions.invoke<unknown>(FUNCTION, { body: { action: 'owner_pending' } });
  if (error) throw new AccountantRequestsError(await errorCodeFrom(error));

  const envelope = listSchema.safeParse(data);
  if (!envelope.success) {
    const code = (data as { error?: unknown } | null)?.error;
    throw new AccountantRequestsError(typeof code === 'string' ? code : 'request_unreadable');
  }

  const requests: AccountantRequest[] = [];
  let unreadable = 0;
  for (const raw of envelope.data.requests) {
    const parsed = requestSchema.safeParse(raw);
    if (parsed.success) requests.push(parsed.data);
    else unreadable += 1;
  }
  return { requests, unreadable };
}

/**
 * Some lines of a price change: the ids approved, and a reason for any kept.
 * Left out when every line is approved, which is the same as approving the whole request.
 */
export interface LineChoice {
  items: number[];
  keptReasons: Record<string, string>;
}

export type DecideOutcome =
  /** `approved` and `of` only after a partial approval; `notWritten` are approved lines whose product no longer exists. */
  | { status: 'applied'; approved?: number; of?: number; notWritten?: number[] }
  | { status: 'declined' }
  /** Approving needs a fresh one-time code for `scope`; run the step-up flow, then decide again. */
  | { status: 'step_up_required'; scope: string }
  | { status: 'error'; code: string };

const decideSchema = z.object({
  ok: z.boolean(),
  state: z.string().nullish(),
  error: z.string().nullish(),
  scope: z.string().nullish(),
  approved: z.number().int().nonnegative().nullish(),
  of: z.number().int().nonnegative().nullish(),
  notWritten: z.array(lineIdSchema).nullish(),
});

/**
 * Approve or decline one request. Only the request id, the decision, an
 * optional decline reason and, for a price change approved in part, the lines
 * chosen and the reasons for those kept leave the device.
 */
export async function decideRequest(
  actionId: string,
  decision: 'approve' | 'decline',
  reason?: string,
  lines?: LineChoice | null,
): Promise<DecideOutcome> {
  assertSupabaseConfigured();
  const trimmed = reason?.trim();
  if (trimmed && trimmed.length > DECLINE_REASON_MAX) return { status: 'error', code: 'invalid_reason' };
  const choice = decision === 'approve' && lines ? lines : null;
  if (choice) {
    if (choice.items.length === 0) return { status: 'error', code: 'invalid_items' };
    if (Object.values(choice.keptReasons).some((kept) => kept.length > DECLINE_REASON_MAX)) {
      return { status: 'error', code: 'invalid_reason' };
    }
  }

  const body = {
    action: 'owner_decide',
    actionId,
    decision,
    ...(decision === 'decline' && trimmed ? { reason: trimmed } : {}),
    ...(choice
      ? { items: choice.items, ...(Object.keys(choice.keptReasons).length ? { keptReasons: choice.keptReasons } : {}) }
      : {}),
  };
  const { data, error } = await supabase.functions.invoke<unknown>(FUNCTION, { body });
  if (error) return { status: 'error', code: await errorCodeFrom(error) };

  const parsed = decideSchema.safeParse(data);
  if (!parsed.success) return { status: 'error', code: 'request_unreadable' };

  const res = parsed.data;
  if (res.ok) {
    if (res.state === 'applied') {
      // Counted only from the server's answer: the screen never says "3 of 6" before this.
      if (choice && typeof res.approved === 'number' && typeof res.of === 'number') {
        return { status: 'applied', approved: res.approved, of: res.of, notWritten: res.notWritten ?? [] };
      }
      return { status: 'applied' };
    }
    if (res.state === 'declined') return { status: 'declined' };
    return { status: 'error', code: 'request_unreadable' };
  }
  if (res.error === 'step_up_required') {
    // A code is only ever asked for an approval, and only for the one scope
    // this app knows. Anything else is treated as a failure: the app must not
    // collect a code for a decline, nor mint a grant for a scope it was handed.
    const scopeIsExpected = !res.scope || res.scope === STEP_UP_SCOPE;
    if (decision !== 'approve' || !scopeIsExpected) return { status: 'error', code: 'unknown' };
    return { status: 'step_up_required', scope: STEP_UP_SCOPE };
  }
  return { status: 'error', code: res.error || 'unknown' };
}

/** Codes after which the request is gone from the list: reload it. */
export function isRequestGone(code: string): boolean {
  return code === 'not_waiting' || code === 'not_found';
}

/** Translation key of the plain-words message for a server error code. */
export function requestErrorKey(code: string): string {
  switch (code) {
    case 'not_waiting':
      return 'requests.errNotWaiting';
    case 'not_found':
      return 'requests.errNotFound';
    case 'forbidden':
      return 'requests.errForbidden';
    case 'budget_changed':
      return 'requests.errBudgetChanged';
    case 'budget_archived':
    case 'budget_not_found':
    case 'too_many_budget_lines':
    case 'request_unreadable':
      return 'requests.errContactAccountant';
    case 'invalid_reason':
      return 'requests.errReasonTooLong';
    case 'same_product':
      return 'requests.errSameProduct';
    case 'invalid_items':
      return 'requests.errInvalidItems';
    case 'items_not_supported':
      return 'requests.errContactAccountant';
    case 'network_error':
      return 'requests.errNetwork';
    default:
      // Includes a failure while applying the change (for example in the books):
      // the server marks the request failed, so the accountant has to resend it.
      return 'requests.errNotApplied';
  }
}

// ------------------------------------------------------------------ choosing price lines

/** A price change whose lines can be approved one by one: every line carries its product id. */
export function canChooseLines(request: AccountantRequest): boolean {
  return (
    request.kind === 'set_prices' &&
    request.changes.length > 1 &&
    // A line is chosen by what it shows: both prices, never a made-up one.
    request.changes.every(
      (change) => typeof change.id === 'number' && typeof change.from === 'number' && typeof change.to === 'number',
    ) &&
    new Set(request.changes.map((change) => change.id)).size === request.changes.length
  );
}

/**
 * The lines chosen after tapping one: it flips, and so does every variant of
 * the same product, since they share one price. A new set; the old one is left as it was.
 */
export function toggleLine(request: AccountantRequest, chosen: ReadonlySet<number>, id: number): Set<number> {
  const line = request.changes.find((change) => change.id === id);
  if (!line) return new Set(chosen);
  const together = request.changes
    .filter((change) => change.id === id || (typeof line.product === 'number' && change.product === line.product))
    .map((change) => change.id as number);
  const next = new Set(chosen);
  const on = !chosen.has(id);
  for (const lineId of together) {
    if (on) next.add(lineId);
    else next.delete(lineId);
  }
  return next;
}

/**
 * What approving sends: null when every line is chosen (the whole request, as
 * before), otherwise the ids chosen in the request's order and a reason for
 * each kept line that has one. A reason is trimmed; an empty one is not sent.
 */
export function lineChoice(request: AccountantRequest, chosen: ReadonlySet<number>, reasons: Record<string, string>): LineChoice | null {
  const ids = request.changes.map((change) => change.id as number);
  if (ids.every((id) => chosen.has(id))) return null;
  const keptReasons: Record<string, string> = {};
  for (const id of ids) {
    const said = reasons[String(id)]?.trim();
    if (!chosen.has(id) && said) keptReasons[String(id)] = said;
  }
  return { items: ids.filter((id) => chosen.has(id)), keptReasons };
}
