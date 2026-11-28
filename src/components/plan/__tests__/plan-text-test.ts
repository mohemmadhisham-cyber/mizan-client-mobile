import type { TFunction } from 'i18next';
import { I18nManager } from 'react-native';

import {
  daysToDeadline,
  needsAttention,
  progressLabel,
  progressLine,
  progressShare,
  standingLine,
  targetNote,
  targetTitle,
  targetValue,
} from '@/components/plan/plan-text';
import type { PlanTarget } from '@/services/month-plan';

jest.mock('@/i18n', () => ({ currentLocale: jest.fn(() => 'en') }));

/** A stand-in for the translator: the key and its values, so a test reads what was asked for. */
const t = ((key: string, values?: Record<string, unknown>) =>
  values ? `${key} ${JSON.stringify(values)}` : key) as unknown as TFunction;

function target(overrides: Partial<PlanTarget>): PlanTarget {
  return {
    unit: 'aed',
    currency: 'AED',
    decimals: 2,
    status: 'on_track',
    progress: 0.5,
    deadline: '2026-12-31',
    ...overrides,
  } as PlanTarget;
}

function plain(text: string): string {
  return text.replace(/\s/g, ' ');
}

describe('targetValue', () => {
  test('shows money from minor units', () => {
    expect(plain(targetValue(target({ unit: 'aed' }), 9_630_000, t))).toBe('AED 96,300');
  });

  test('shows a plain number for money with no currency: no unit is invented', () => {
    expect(targetValue(target({ unit: 'aed', currency: null }), 9_630_000, t)).toBe('96,300');
  });

  test.each([
    [1250, '12.5'],
    [1200, '12'],
    [1205, '12.05'],
    [5, '0.05'],
    [0, '0'],
    [-1250, '-12.5'],
  ])('shows a percentage held in hundredths: %i is %s', (stored, shown) => {
    expect(targetValue(target({ unit: 'pct' }), stored, t)).toBe(`horizonPlan.percent {"value":"${shown}"}`);
  });

  test('shows days as a count', () => {
    expect(targetValue(target({ unit: 'days' }), 45, t)).toBe('horizonPlan.days {"count":45}');
  });
});

describe('the target in the app language', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  const both = target({ title: 'Cut fuel costs', titleAr: 'خفض تكاليف الوقود', note: 'Join deliveries', noteAr: 'ادمج التوصيلات' });
  const englishOnly = target({ title: 'Cut fuel costs', titleAr: null, note: 'Join deliveries', noteAr: null });

  test('uses the English title and note in English', () => {
    expect(targetTitle(both)).toBe('Cut fuel costs');
    expect(targetNote(both)).toBe('Join deliveries');
  });

  test('uses the Arabic title and note in Arabic', () => {
    jest.replaceProperty(I18nManager, 'isRTL', true);

    expect(targetTitle(both)).toBe('خفض تكاليف الوقود');
    expect(targetNote(both)).toBe('ادمج التوصيلات');
  });

  test('falls back to the title the server always sends when there is no Arabic one', () => {
    jest.replaceProperty(I18nManager, 'isRTL', true);

    expect(targetTitle(englishOnly)).toBe('Cut fuel costs');
    expect(targetNote(englishOnly)).toBe('Join deliveries');
  });
});

describe('progressLine', () => {
  test('gives where the target stands and where it must get to, each in its unit', () => {
    const line = progressLine(target({ unit: 'days', current: 52, goal: 45 }), t);

    expect(line).toBe(
      'horizonPlan.currentOfGoal {"current":"horizonPlan.days {\\"count\\":52}","goal":"horizonPlan.days {\\"count\\":45}"}',
    );
  });
});

describe('progressShare', () => {
  test('passes on the server progress', () => {
    expect(progressShare(target({ progress: 0.8 }))).toBe(0.8);
  });

  test('never fills more than the whole line', () => {
    expect(progressShare(target({ progress: 1.4 }))).toBe(1);
  });

  test('never goes below nothing', () => {
    expect(progressShare(target({ progress: -0.2 }))).toBe(0);
  });
});

describe('progressLabel', () => {
  test('rounds the progress for reading', () => {
    expect(progressLabel(target({ progress: 0.804 }))).toBe('80%');
  });
});

describe('needsAttention', () => {
  test('is true only for a target at risk', () => {
    expect(needsAttention('at_risk')).toBe(true);
    expect(needsAttention('behind')).toBe(false);
    expect(needsAttention('on_track')).toBe(false);
    expect(needsAttention('met')).toBe(false);
  });
});

describe('deadlines', () => {
  beforeEach(() => {
    // Three in the afternoon on 26 November 2026, on this machine's own calendar.
    jest.useFakeTimers().setSystemTime(new Date(2026, 10, 26, 15, 0, 0));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('counts whole days to the deadline', () => {
    expect(daysToDeadline('2026-11-27')).toBe(1);
    expect(daysToDeadline('2026-12-26')).toBe(30);
  });

  test('is zero for the whole of the deadline day', () => {
    expect(daysToDeadline('2026-11-26')).toBe(0);
  });

  test('is negative once the deadline has passed', () => {
    expect(daysToDeadline('2026-11-25')).toBe(-1);
  });

  test('says how long is left', () => {
    const line = standingLine(target({ status: 'behind', deadline: '2026-11-29' }), t);

    expect(line).toBe('horizonPlan.statusBehind · horizonPlan.daysLeft {"count":3}');
  });

  test('says the target is due today on the day itself', () => {
    const line = standingLine(target({ status: 'on_track', deadline: '2026-11-26' }), t);

    expect(line).toBe('horizonPlan.statusOnTrack · horizonPlan.dueToday');
  });

  test('says the deadline has passed, not a negative count', () => {
    const line = standingLine(target({ status: 'at_risk', deadline: '2026-11-20' }), t);

    expect(line).toBe('horizonPlan.statusAtRisk · horizonPlan.deadlinePassed');
  });

  test('gives no countdown for a target already reached', () => {
    const line = standingLine(target({ status: 'met', deadline: '2026-11-20' }), t);

    expect(line).toBe('horizonPlan.statusMet');
  });
});
