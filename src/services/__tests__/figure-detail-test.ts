import { FigureDetailError, parseFigureDetail } from '@/services/figure-detail';

jest.mock('@/services/client-data', () => ({ fetchDashboardAnswer: jest.fn() }));

/** 26 November 2026, at noon UTC. */
const NOW = new Date(Date.UTC(2026, 10, 26, 12));

function answer(overrides: Record<string, unknown> = {}) {
  return {
    ok: true,
    currency: 'AED',
    trend: [
      { month: 'Sep', revenue: 100000, expenses: 60000, profit: 40000 },
      { month: 'Oct', revenue: 110000.5, expenses: 70000.25, profit: 40000.25 },
      { month: 'Nov', revenue: 95000, expenses: 65000, profit: 30000 },
    ],
    topCustomers: [
      { name: 'Al Noor Trading', amount: 250000.75 },
      { name: 'Gulf Supplies', amount: 120000 },
    ],
    recentInvoices: [
      { id: '11', number: 'INV/2026/0011', customer: 'Gulf Supplies', date: '2026-11-02', due: '2026-12-02', amount: 5250, status: 'open' },
      { id: '12', number: 'INV/2026/0012', customer: 'Al Noor Trading', date: '2026-11-20', due: '2026-11-25', amount: 1999.99, status: 'overdue' },
    ],
    kpis: [{ labelKey: 'client.dash.kpi.revenueMtd', value: 95000, delta: -13.64, format: 'currency' }],
    arDays: 41,
    apDays: 28,
    ...overrides,
  };
}

describe('money', () => {
  test('turns whole currency units into integer minor units, once', () => {
    const detail = parseFigureDetail(answer(), NOW);

    expect(detail.months[1]).toMatchObject({ moneyIn: 11000050, moneyOut: 7000025, profit: 4000025 });
    expect(detail.topCustomers[0]).toEqual({ name: 'Al Noor Trading', amountMinor: 25000075 });
    expect(detail.invoices.map((i) => i.amountMinor)).toEqual([199999, 525000]);
  });

  test('removes the noise of a sum of fractions', () => {
    const detail = parseFigureDetail(answer({ topCustomers: [{ name: 'A', amount: 0.1 + 0.2 }] }), NOW);

    expect(detail.topCustomers[0].amountMinor).toBe(30);
  });

  test('keeps a loss negative, and never gives a negative zero', () => {
    const detail = parseFigureDetail(
      answer({ trend: [{ month: 'Nov', revenue: 100, expenses: 250.5, profit: -150.5 }], topCustomers: [{ name: 'A', amount: -0.001 }] }),
      NOW,
    );

    expect(detail.months[0].profit).toBe(-15050);
    expect(Object.is(detail.topCustomers[0].amountMinor, 0)).toBe(true);
  });

  test('counts an amount too large to hold exactly as unreadable', () => {
    const detail = parseFigureDetail(answer({ topCustomers: [{ name: 'A', amount: 1e17 }] }), NOW);

    expect(detail.topCustomers).toEqual([]);
    expect(detail.unreadable).toBe(1);
  });
});

describe('months', () => {
  test('names each month by its place: the last is the current month', () => {
    const detail = parseFigureDetail(answer(), NOW);

    expect(detail.months.map((m) => m.month)).toEqual(['2026-09-01', '2026-10-01', '2026-11-01']);
  });

  test('marks only the current month as not over', () => {
    const detail = parseFigureDetail(answer(), NOW);

    expect(detail.months.map((m) => m.soFar)).toEqual([false, false, true]);
  });

  test('names the months right across a new year', () => {
    const january = new Date(Date.UTC(2027, 0, 5, 12));
    const trend = [
      { month: 'Nov', revenue: 1, expenses: 1, profit: 0 },
      { month: 'Dec', revenue: 1, expenses: 1, profit: 0 },
      { month: 'Jan', revenue: 1, expenses: 1, profit: 0 },
    ];

    const detail = parseFigureDetail(answer({ trend }), january);

    expect(detail.months.map((m) => m.month)).toEqual(['2026-11-01', '2026-12-01', '2027-01-01']);
  });

  test('shows no month when one cannot be read: the places could not be trusted', () => {
    const detail = parseFigureDetail(
      answer({ trend: [{ month: 'Oct', revenue: 1, expenses: 1, profit: 0 }, { month: 'Nov', revenue: 'lots' }] }),
      NOW,
    );

    expect(detail.months).toEqual([]);
    expect(detail.unreadable).toBeGreaterThan(0);
  });

  test('shows no month when the server names one that its place does not: the day-31 fault', () => {
    // What the server sends on 31 March: it skips February and repeats March.
    const endOfMarch = new Date(Date.UTC(2026, 2, 31, 12));
    const trend = ['Oct', 'Dec', 'Dec', 'Jan', 'Mar', 'Mar'].map((month) => ({ month, revenue: 1, expenses: 1, profit: 0 }));

    const detail = parseFigureDetail(answer({ trend }), endOfMarch);

    expect(detail.months).toEqual([]);
    expect(detail.unreadable).toBe(6);
  });
});

describe('customers and invoices', () => {
  test('puts the newest invoice first', () => {
    const detail = parseFigureDetail(answer(), NOW);

    expect(detail.invoices.map((i) => i.number)).toEqual(['INV/2026/0012', 'INV/2026/0011']);
  });

  test('counts a line it cannot read and still shows the rest', () => {
    const detail = parseFigureDetail(
      answer({
        recentInvoices: [
          { id: '11', number: 'INV/1', customer: 'A', date: '2026-11-02', due: '2026-12-02', amount: 10, status: 'open' },
          { id: '12', number: 'INV/2', customer: 'B', date: '2026-13-45', due: '2026-12-02', amount: 10, status: 'open' },
          { id: '13', number: 'INV/3', customer: 'C', date: '2026-11-03', due: '2026-12-02', amount: 10, status: 'cancelled' },
        ],
        topCustomers: [{ name: 'A', amount: 1 }, { name: 'B', amount: Number.NaN }],
      }),
      NOW,
    );

    expect(detail.invoices).toHaveLength(1);
    expect(detail.topCustomers).toHaveLength(1);
    expect(detail.unreadable).toBe(3);
  });

  test('reads a partly paid invoice with what is left to pay, when the server says', () => {
    const detail = parseFigureDetail(
      answer({
        recentInvoices: [
          { id: '11', number: 'INV/1', customer: 'A', date: '2026-11-02', due: '2026-12-02', amount: 10000, residual: 4000.5, status: 'partial' },
        ],
      }),
      NOW,
    );

    expect(detail.invoices[0]).toMatchObject({ status: 'partial', amountMinor: 1000000, residualMinor: 400050 });
  });

  test('knows nothing of what is left to pay when the server does not say', () => {
    expect(parseFigureDetail(answer(), NOW).invoices[0].residualMinor).toBeNull();
  });

  test('removes direction-override characters from names', () => {
    const detail = parseFigureDetail(answer({ topCustomers: [{ name: 'Al ‮Noor‬', amount: 1 }] }), NOW);

    expect(detail.topCustomers[0].name).toBe('Al Noor');
  });

  test('leaves out a customer with no name', () => {
    const detail = parseFigureDetail(answer({ topCustomers: [{ name: '  ', amount: 5 }] }), NOW);

    expect(detail.topCustomers).toEqual([]);
  });
});

describe('days owed', () => {
  test('gives what is owed each way as days', () => {
    const detail = parseFigureDetail(answer(), NOW);

    expect(detail.receivableDays).toBe(41);
    expect(detail.payableDays).toBe(28);
  });

  test.each([
    ['0, which the server sends for "not known"', 0],
    ['a negative number', -12],
    ['a number beyond any real figure', 99999],
    ['a fraction', 12.5],
    ['a word', 'many'],
    ['nothing', undefined],
  ])('shows no figure for %s, and still shows the rest of the answer', (_name, value) => {
    const detail = parseFigureDetail(answer({ arDays: value, apDays: value }), NOW);

    expect(detail.receivableDays).toBeNull();
    expect(detail.payableDays).toBeNull();
    expect(detail.invoices).toHaveLength(2);
  });
});

describe('the answer as a whole', () => {
  test('reads an answer that has only the summary, with nothing to show', () => {
    const detail = parseFigureDetail({ ok: true, currency: 'AED' }, NOW);

    expect(detail).toMatchObject({ months: [], topCustomers: [], invoices: [], receivableDays: null, unreadable: 0 });
  });

  test.each([
    ['nothing', null],
    ['a refusal', { ok: false, error: 'tenant_not_provisioned' }],
    ['a currency that is not a code', answer({ currency: 'dirham' })],
    ['more invoices than the app accepts', answer({ recentInvoices: Array.from({ length: 51 }, () => ({})) })],
  ])('refuses %s', (_name, bad) => {
    expect(() => parseFigureDetail(bad, NOW)).toThrow(FigureDetailError);
  });
});
