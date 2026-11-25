import { currentLocale } from '@/i18n';
import {
  type Currency,
  daysUntil,
  formatCompact,
  formatDate,
  formatMinorUnits,
  formatMoneyMinor,
  pctChange,
} from '@/lib/format';

jest.mock('@/i18n', () => ({ currentLocale: jest.fn(() => 'en') }));

const mockLocale = currentLocale as jest.MockedFunction<typeof currentLocale>;

/** Intl separates the currency from the number with a no-break space, and Arabic adds direction marks. */
function plain(text: string): string {
  return text.replace(/[‎‏؜]/g, '').replace(/\s/g, ' ');
}

const ARABIC_INDIC_DIGITS = /[٠-٩۰-۹]/;

beforeEach(() => {
  mockLocale.mockReturnValue('en');
});

afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

describe('formatMoneyMinor', () => {
  test('shows an amount held in minor units as whole currency by default', () => {
    // Arrange
    const minor = 123_400;

    // Act
    const shown = formatMoneyMinor(minor, 'AED');

    // Assert
    expect(plain(shown)).toBe('AED 1,234');
  });

  test('shows the minor units when two decimals are asked for', () => {
    expect(plain(formatMoneyMinor(123_456, 'AED', { fractionDigits: 2 }))).toBe('AED 1,234.56');
  });

  test('keeps single minor units exact, with no float drift', () => {
    expect(plain(formatMoneyMinor(1, 'AED', { fractionDigits: 2 }))).toBe('AED 0.01');
    expect(plain(formatMoneyMinor(10, 'AED', { fractionDigits: 2 }))).toBe('AED 0.10');
    expect(plain(formatMoneyMinor(30, 'AED', { fractionDigits: 2 }))).toBe('AED 0.30');
  });

  test('shows zero as zero', () => {
    expect(plain(formatMoneyMinor(0, 'AED'))).toBe('AED 0');
  });

  test('keeps the sign of a negative amount', () => {
    const shown = plain(formatMoneyMinor(-50_000, 'AED'));

    expect(shown).toContain('500');
    expect(shown).toMatch(/[-−]/);
  });

  test('uses Western digits in Arabic', () => {
    mockLocale.mockReturnValue('ar');

    const shown = formatMoneyMinor(123_456, 'AED', { fractionDigits: 2 });

    expect(shown).toContain('1,234.56');
    expect(shown).not.toMatch(ARABIC_INDIC_DIGITS);
  });
});

describe('formatMoneyMinor in other currencies', () => {
  test.each(['en', 'ar'] as const)('shows riyals with the right amount and Western digits in %s', (locale) => {
    mockLocale.mockReturnValue(locale);

    const shown = formatMoneyMinor(123_456, 'SAR', { fractionDigits: 2 });

    expect(shown).toContain('1,234.56');
    expect(shown).not.toMatch(ARABIC_INDIC_DIGITS);
    // The riyal is written as a code, an abbreviation or its sign, depending on the engine.
    expect(shown).toMatch(/SAR|SR|ر\.س|\u20C1/);
  });

  test('shows dollars with the right amount', () => {
    expect(formatMoneyMinor(123_456, 'USD', { fractionDigits: 2 })).toContain('1,234.56');
  });

  test('falls back to the code and a number for a currency the engine rejects', () => {
    const shown = formatMoneyMinor(1250, 'NOT-A-CODE' as Currency, { fractionDigits: 2 });

    expect(shown).toBe('NOT-A-CODE 12.50');
  });
});

describe('formatMinorUnits', () => {
  test('hides decimals when the amount has none', () => {
    expect(plain(formatMinorUnits(560_000_000, 'AED'))).toBe('AED 5,600,000');
  });

  test('shows decimals when the amount has them', () => {
    expect(plain(formatMinorUnits(1250, 'AED'))).toBe('AED 12.50');
  });

  test('shows decimals for a whole amount when the column asks for them', () => {
    expect(plain(formatMinorUnits(500_000, 'AED', 2, true))).toBe('AED 5,000.00');
  });

  test('divides by a thousand for a currency with three decimals', () => {
    const shown = plain(formatMinorUnits(12_500, 'KWD', 3, true));

    expect(shown).toContain('12.500');
    expect(shown).toContain('KWD');
  });

  test('shows a plain number when the currency is not known', () => {
    expect(formatMinorUnits(123_456, null)).toBe('1,234.56');
  });

  test('falls back to the code and a number for a currency the engine rejects', () => {
    expect(formatMinorUnits(1250, 'NOT-A-CODE')).toBe('NOT-A-CODE 12.50');
  });
});

describe('pctChange', () => {
  test('gives the rise as a whole percentage', () => {
    expect(pctChange(120, 100)).toBe(20);
  });

  test('gives a fall as a negative percentage', () => {
    expect(pctChange(80, 100)).toBe(-20);
  });

  test('gives nothing when there is no earlier figure to compare with', () => {
    expect(pctChange(120, 0)).toBeNull();
  });
});

describe('formatDate', () => {
  test('gives an empty string for a date that cannot be read', () => {
    expect(formatDate('not a date')).toBe('');
  });

  test('formats a date in the app language', () => {
    expect(plain(formatDate(new Date(2026, 10, 26)))).toBe('26 Nov 2026');
  });

  test('uses Western digits in Arabic', () => {
    mockLocale.mockReturnValue('ar');

    const shown = formatDate(new Date(2026, 10, 26));

    expect(shown).toContain('2026');
    expect(shown).not.toMatch(ARABIC_INDIC_DIGITS);
  });
});

describe('formatCompact', () => {
  test('shortens thousands for a chart axis', () => {
    expect(formatCompact(90_000)).toBe('90K');
  });

  test('falls back to a rounded number when the engine cannot shorten', () => {
    jest.spyOn(Intl, 'NumberFormat').mockImplementation(() => {
      throw new RangeError('no compact notation');
    });

    expect(formatCompact(90_000.4)).toBe('90000');
  });
});

describe('formatDate fallback', () => {
  test('falls back to the ISO date when the engine cannot format', () => {
    jest.spyOn(Intl, 'DateTimeFormat').mockImplementation(() => {
      throw new RangeError('no such locale');
    });

    expect(formatDate(new Date(Date.UTC(2026, 10, 26, 12)))).toBe('2026-11-26');
  });
});

describe('daysUntil', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-11-26T12:00:00Z'));
  });

  test('counts whole days ahead', () => {
    expect(daysUntil('2026-11-28T12:00:00Z')).toBe(2);
  });

  test('counts a part of a day as a day: it measures elapsed time, not calendar days', () => {
    expect(daysUntil('2026-11-26T13:00:00Z')).toBe(1);
  });

  test('is zero at the moment itself', () => {
    expect(daysUntil(new Date('2026-11-26T12:00:00Z'))).toBe(0);
  });

  test('is negative once two full days have passed', () => {
    expect(daysUntil('2026-11-24T12:00:00Z')).toBe(-2);
  });
});
