import { FunctionsHttpError } from '@supabase/supabase-js';
import { z } from 'zod';

import { assertSupabaseConfigured } from '@/lib/env';
import { supabase } from '@/lib/supabase';

/**
 * The plan: targets a client agreed with their accountant (grow sales, cut a
 * cost, collect faster), with how far each has come.
 *
 * The server already holds these (`client_targets` and its snapshots and plan
 * steps), but on 2026-11-25 only the accountant's firm could read them. This
 * module calls a read the app has ASKED the backend for and that does not
 * exist yet: `{ action: "owner_targets" }` on the `client-targets` edge
 * function. Until the server answers it, `listTargets` returns
 * `{ available: false }` and the screens show nothing. The contract is in the
 * shared notes: `stream-D-connect-build-needs-from-backend.md`, section 7.
 *
 * The server owns every figure and every judgement: how far a target has come
 * (`progress`), and whether it is on track (`status`). The app formats and
 * shows; it does not compute them.
 */

const FUNCTION = 'client-targets';

/** How long "the server does not offer the plan" is believed before asking again. */
const NOT_OFFERED_STALE_MS = 10 * 60_000;
const OFFERED_STALE_MS = 60_000;

/**
 * The query for the plan. The client is part of the key: one person's targets
 * must never be shown to the next person who signs in on the same phone.
 */
export function targetsQuery(clientId: string | null) {
  return {
    queryKey: ['month-plan-targets', clientId ?? 'none'] as const,
    queryFn: listTargets,
    staleTime: (query: { state: { data?: PlanResult } }) =>
      query.state.data?.available === false ? NOT_OFFERED_STALE_MS : OFFERED_STALE_MS,
  };
}

const MAX_TARGETS = 24;
const MAX_MONTHS = 36;
const MAX_STEPS = 40;
const TITLE_MAX = 200;
const NOTE_MAX = 2000;

/** Characters that can reorder the text around them: removed from anything the server sends for display. */
const DIRECTION_OVERRIDES = /[‪-‮⁦-⁩]/g;
const clean = (text: string) => text.replace(DIRECTION_OVERRIDES, '').trim();

const text = (max: number) => z.string().max(max).transform(clean);
const optionalText = (max: number) =>
  z
    .string()
    .max(max)
    .nullish()
    .transform((value) => (value ? clean(value) : null));
/** A whole number in the target's own unit: minor units of money, hundredths of a percent, or days. */
const amount = z.number().int().safe();
/** A real calendar date as YYYY-MM-DD: "2026-99-99" is refused, so no screen ever formats an invalid date. */
const day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  });
/** Ids go into a route, so they are letters, digits, dashes and underscores only. */
const id = z.string().regex(/^[A-Za-z0-9_-]{1,80}$/);
/** Far beyond any real progress in either direction; keeps a label from reading as "1e+302%". */
const PROGRESS_BOUND = 100;

const monthSchema = z.object({ month: day, actual: amount, plan: amount });
const stepSchema = z.object({
  id,
  title: text(TITLE_MAX),
  titleAr: optionalText(TITLE_MAX),
  done: z.boolean(),
});

const targetSchema = z.object({
  id,
  kind: z.string().min(1).max(40),
  title: text(TITLE_MAX),
  titleAr: optionalText(TITLE_MAX),
  unit: z.enum(['aed', 'pct', 'days']),
  /** For money targets. The server's name for the unit is `aed`, but the currency is whatever it sends here. */
  currency: z
    .string()
    .regex(/^[A-Z]{3}$/)
    .nullish()
    .transform((value) => value ?? null),
  decimals: z.number().int().min(0).max(4).nullish().transform((value) => value ?? 2),
  start: amount,
  goal: amount,
  current: amount,
  setOn: day,
  deadline: day,
  status: z.enum(['on_track', 'behind', 'at_risk', 'met']),
  /** Share of the way from start to goal, worked out by the server. Can pass 1. */
  progress: z.number().finite().min(-PROGRESS_BOUND).max(PROGRESS_BOUND),
  months: z.array(monthSchema).max(MAX_MONTHS).nullish().transform((value) => value ?? []),
  steps: z.array(stepSchema).max(MAX_STEPS).nullish().transform((value) => value ?? []),
  note: optionalText(NOTE_MAX),
  noteAr: optionalText(NOTE_MAX),
});

export type PlanTarget = z.infer<typeof targetSchema>;
export type PlanStatus = PlanTarget['status'];

const envelopeSchema = z.object({ ok: z.literal(true), targets: z.array(z.unknown()).max(MAX_TARGETS) });

export type PlanResult =
  /** The server does not offer the plan to this app yet, or this person has no client account. Show nothing. */
  | { available: false }
  /** `unreadable` counts targets the app could not show in full, so they are left out rather than shown wrong. */
  | { available: true; targets: PlanTarget[]; unreadable: number };

/** The server's way of saying "this read is not for you" or "I do not know this read". */
const NOT_OFFERED_STATUS = new Set([403, 404]);

/**
 * The signed-in client's targets. "Not offered" is an answer, not a failure: a
 * server that does not know this read says forbidden, and the plan is simply
 * not there. Anything else (no connection, a server fault) throws, so the
 * query retries and the screen can say it could not load.
 */
export async function listTargets(): Promise<PlanResult> {
  assertSupabaseConfigured();
  const { data, error } = await supabase.functions.invoke<unknown>(FUNCTION, { body: { action: 'owner_targets' } });
  if (error) {
    if (error instanceof FunctionsHttpError && NOT_OFFERED_STATUS.has((error.context as Response).status)) {
      return { available: false };
    }
    throw new Error('plan_unreachable');
  }

  const envelope = envelopeSchema.safeParse(data);
  if (!envelope.success) return { available: false };

  const targets: PlanTarget[] = [];
  let unreadable = 0;
  for (const raw of envelope.data.targets) {
    const parsed = targetSchema.safeParse(raw);
    if (parsed.success) targets.push(parsed.data);
    else unreadable += 1;
  }
  return { available: true, targets, unreadable };
}
