import type { TFunction } from 'i18next';

import { currentLocale } from '@/i18n';
import { formatMinorUnits, localeTag } from '@/lib/format';
import type { AccountantRequest } from '@/services/accountant-requests';

// The three older kinds carry no currency on the request: they are AED with
// two decimals today. A budget states its own currency and decimals. A kind
// this version does not know gets no currency label at all: a number without a
// unit is honest, a wrong unit on an approval screen is not.
const AED_KINDS: ReadonlySet<string> = new Set(['set_prices', 'loan_drafts', 'send_statements']);
const DEFAULT_DECIMALS = 2;

interface RequestUnit {
  currency: string | null;
  decimals: number;
}

/** The request's own unit first, then its budget's, then the AED default for the older kinds. */
function unitOf(request: AccountantRequest): RequestUnit {
  return {
    currency: request.currency ?? request.budget?.currency ?? (AED_KINDS.has(request.kind) ? 'AED' : null),
    decimals: request.decimals ?? request.budget?.decimals ?? DEFAULT_DECIMALS,
  };
}

const fractionsCache = new WeakMap<AccountantRequest, boolean>();

/**
 * True when any amount on the request has cents. Then every amount of that
 * request shows them, so a column of figures lines up and reads as one unit.
 */
function hasFractions(request: AccountantRequest, decimals: number): boolean {
  const cached = fractionsCache.get(request);
  if (cached !== undefined) return cached;

  const unit = 10 ** decimals;
  const amounts: (number | null | undefined)[] = [];
  for (const change of request.changes) amounts.push(change.amountMinor, change.from, change.to);
  for (const summary of [request.budget?.summary, request.budget?.previous]) {
    if (!summary) continue;
    amounts.push(summary.revenueMinor, summary.cogsMinor, summary.opexMinor, summary.netProfitMinor, summary.outsidePnlMinor);
    for (const quarter of summary.quarters) amounts.push(quarter.revenueMinor);
  }
  const result = amounts.some((amount) => typeof amount === 'number' && amount % unit !== 0);
  fractionsCache.set(request, result);
  return result;
}

/** An amount of this request, in the request's own currency and precision. */
export function requestMoney(request: AccountantRequest, minor: number): string {
  const { currency, decimals } = unitOf(request);
  return formatMinorUnits(minor, currency, decimals, hasFractions(request, decimals));
}

/** The Arabic title when the app is in Arabic and the server sent one. */
export function requestTitle(request: AccountantRequest): string {
  return currentLocale() === 'ar' && request.titleAr ? request.titleAr : request.title;
}

/** "Firm · sent 25 Nov", or just the date when the firm name is missing. */
export function requestSentLine(request: AccountantRequest, t: TFunction): string {
  const sent = new Date(request.sentAt);
  const date = Number.isNaN(sent.getTime()) ? '' : sent.toLocaleDateString(localeTag(), { day: 'numeric', month: 'short' });
  if (request.from && date) return t('requests.sentBy', { from: request.from, date });
  if (request.from) return request.from;
  return date ? t('requests.sentOn', { date }) : '';
}

/**
 * One line that says what the request is about, for the list card. It only
 * repeats figures the server sent or counts its rows: nothing is recomputed.
 */
export function requestOneLine(request: AccountantRequest, t: TFunction): string {
  const count = request.changes.length;
  if (request.budget) {
    return t('requests.lineBudget', {
      revenue: requestMoney(request, request.budget.summary.revenueMinor),
      profit: requestMoney(request, request.budget.summary.netProfitMinor),
    });
  }
  switch (request.kind) {
    case 'set_prices':
      return t('requests.linePrices', { count });
    case 'loan_drafts':
      return t('requests.linePayments', { count });
    case 'send_statements':
      return t('requests.lineCustomers', { count });
    default:
      return t('requests.lineOther', { count });
  }
}

/** What approving does, in one or two sentences, or undefined for a kind this version does not know. */
export function requestConsequence(request: AccountantRequest, t: TFunction): string | undefined {
  if (request.budget) return t('requests.noteBudget', { year: request.budget.fiscalYear });
  switch (request.kind) {
    case 'set_prices':
      return t('requests.notePrices');
    case 'loan_drafts':
      return t('requests.notePayments');
    case 'send_statements':
      return t('requests.noteStatements');
    default:
      return undefined;
  }
}
