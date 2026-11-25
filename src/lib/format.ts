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
  try {
    return new Intl.DateTimeFormat(localeTag(), opts ?? { day: 'numeric', month: 'short', year: 'numeric' }).format(d);
  } catch {
    return d.toISOString().slice(0, 10);
  }
}
