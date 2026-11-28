import { currentLocale } from '@/i18n';

export type Currency = 'AED' | 'SAR' | 'USD';

/**
 * BCP 47 tag for dates and numbers in the app language. Arabic keeps Western
 * digits and the Gregorian calendar, as GCC banking apps do.
 */
export function localeTag(): string {
  return currentLocale() === 'ar' ? 'ar-AE-u-nu-latn-ca-gregory' : 'en-GB';
}

function moneyLocale(currency: Currency): string {
  if (currentLocale() === 'ar') return currency === 'SAR' ? 'ar-SA-u-nu-latn' : 'ar-AE-u-nu-latn';
  return currency === 'SAR' ? 'en-SA' : 'en-AE';
}

/**
 * Canonical money formatter. Money is stored as INTEGER MINOR UNITS
 * (fils / halalas / cents) per the platform manual §14 — never a float. Pass the
 * minor amount; this divides by 100 for display. Falls back to a grouped number
 * with the currency code if the JS engine lacks ICU currency data (older Hermes).
 */
export function formatMoneyMinor(
  minor: number,
  currency: Currency = 'AED',
  opts?: { locale?: string; fractionDigits?: number },
): string {
  const locale = opts?.locale ?? moneyLocale(currency);
  const digits = opts?.fractionDigits ?? 0;
  const value = minor / 100;
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(value);
  } catch {
    const n = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(value);
    return `${currency} ${n}`;
  }
}

/** Compact number for chart axes etc. (e.g. 90000 -> "90K"). */
export function formatCompact(n: number): string {
  try {
    return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(n);
  } catch {
    return String(Math.round(n));
  }
}

/** Percentage change between two values, rounded; null when previous is 0/undefined. */
export function pctChange(current: number, previous: number): number | null {
  if (!previous) return null;
  return Math.round(((current - previous) / previous) * 100);
}

export function daysUntil(date: Date | string): number {
  const d = typeof date === 'string' ? new Date(date) : date;
  const diffMs = d.getTime() - Date.now();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

export function formatDate(date: Date | string, opts?: Intl.DateTimeFormatOptions): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return '';
  try {
    return new Intl.DateTimeFormat(localeTag(), opts ?? { day: 'numeric', month: 'short', year: 'numeric' }).format(d);
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

/**
 * Formats an integer amount in minor units for any currency and precision
 * (the server says how many decimals: 2 for AED and SAR, 3 for KWD or BHD).
 * Decimals are shown only when the amount has them, so a budget reads
 * "AED 5,600,000" and a price reads "AED 12.50"; pass `showDecimals` to decide
 * it for a whole column instead. A null currency gives a plain grouped number,
 * for an amount whose unit is not known. Falls back to a plain number with the
 * code if the engine does not know the currency.
 */
export function formatMinorUnits(minor: number, currency: string | null, decimals = 2, showDecimals?: boolean): string {
  const unit = 10 ** decimals;
  const digits = (showDecimals ?? minor % unit !== 0) ? decimals : 0;
  const value = minor / unit;
  const locale = currentLocale() === 'ar' ? 'ar-AE-u-nu-latn' : 'en-AE';
  if (currency === null) {
    return new Intl.NumberFormat(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
  }
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(value);
  } catch {
    const n = new Intl.NumberFormat('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
    return `${currency} ${n}`;
  }
}
