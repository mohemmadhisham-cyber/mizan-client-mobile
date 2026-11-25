import type { TFunction } from 'i18next';
import { I18nManager } from 'react-native';

import { formatMinorUnits } from '@/lib/format';
import type { PlanStatus, PlanTarget } from '@/services/month-plan';

/** The target's name in the app's language, falling back to the one the server always sends. */
export function targetTitle(target: PlanTarget): string {
  return (I18nManager.isRTL ? target.titleAr : null) ?? target.title;
}

/** The accountant's note in the app's language, when there is one. */
export function targetNote(target: PlanTarget): string | null {
  return (I18nManager.isRTL ? target.noteAr : null) ?? target.note;
}

/**
 * A value in the target's own unit, as words. Money is formatted from minor
 * units; a percentage is stored in hundredths (1250 is 12.5%); days are days.
 * A money target with no currency shows a plain number: no unit is invented.
 */
export function targetValue(target: PlanTarget, value: number, t: TFunction): string {
  if (target.unit === 'aed') return formatMinorUnits(value, target.currency, target.decimals);
  if (target.unit === 'pct') return t('horizonPlan.percent', { value: formatHundredths(value) });
  return t('horizonPlan.days', { count: value });
}

/** 1250 -> "12.5", 1200 -> "12". Done on integers, so no rounding error can creep in. */
function formatHundredths(value: number): string {
  const sign = value < 0 ? '-' : '';
  const whole = Math.trunc(Math.abs(value) / 100);
  const part = Math.abs(value) % 100;
  if (part === 0) return `${sign}${whole}`;
  const digits = String(part).padStart(2, '0').replace(/0$/, '');
  return `${sign}${whole}.${digits}`;
}

const STATUS_KEY: Record<PlanStatus, string> = {
  on_track: 'horizonPlan.statusOnTrack',
  behind: 'horizonPlan.statusBehind',
  at_risk: 'horizonPlan.statusAtRisk',
  met: 'horizonPlan.statusMet',
};

export function statusLabel(status: PlanStatus, t: TFunction): string {
  return t(STATUS_KEY[status]);
}

/** True when the target needs the person's attention: it is shown in the warning colour. */
export function needsAttention(status: PlanStatus): boolean {
  return status === 'at_risk';
}

/** The server's progress as a share of the line to fill, kept between nothing and all of it. */
export function progressShare(target: PlanTarget): number {
  return Math.min(1, Math.max(0, target.progress));
}

/** A YYYY-MM-DD date as midnight on this phone's calendar: the deadline lasts that whole local day. */
function localDay(value: string): number {
  const [year, month, dayOfMonth] = value.split('-').map(Number);
  return new Date(year, month - 1, dayOfMonth).getTime();
}

const DAY_MS = 86_400_000;

/** Whole days from today to the deadline: 0 on the day itself, negative after it. */
export function daysToDeadline(deadline: string): number {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.round((localDay(deadline) - today) / DAY_MS);
}

/** Where the target stands and how long is left, in words. A target already reached has no countdown. */
export function standingLine(target: PlanTarget, t: TFunction): string {
  const status = statusLabel(target.status, t);
  if (target.status === 'met') return status;
  const days = daysToDeadline(target.deadline);
  const time =
    days > 0
      ? t('horizonPlan.daysLeft', { count: days })
      : days === 0
        ? t('horizonPlan.dueToday')
        : t('horizonPlan.deadlinePassed');
  return `${status} · ${time}`;
}

/** A date-only value is formatted in UTC, so it never shows the day or month before in another time zone. */
export const DATE_ONLY = { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' } as const;
export const MONTH_ONLY = { month: 'long', year: 'numeric', timeZone: 'UTC' } as const;

/** "80%": the server's progress, rounded for reading. */
export function progressLabel(target: PlanTarget): string {
  return `${Math.round(target.progress * 100)}%`;
}

/** "AED 96,300 of AED 120,000". */
export function progressLine(target: PlanTarget, t: TFunction): string {
  return t('horizonPlan.currentOfGoal', {
    current: targetValue(target, target.current, t),
    goal: targetValue(target, target.goal, t),
  });
}
