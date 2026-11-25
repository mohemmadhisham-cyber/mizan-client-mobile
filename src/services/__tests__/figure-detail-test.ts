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

describe('parseFigureDetail', () => {
  test('turns whole currency units into integer minor units, once', () => {
    const detail = parseFigureDetail(answer(), NOW);

    expect(detail.months[1]).toMatchObject({ moneyIn: 11000050, moneyOut: 7000025, profit: 4000025 });
    expect(detail.topCustomers[0]).toEqual({ name: 'Al Noor Trading', amountMinor: 25000075 });
    expect(detail.invoices.map((i) => i.amountMinor)).toEqual([199999, 525000]);
    for (const month of detail.months) {
      expect(Number.isInteger(month.moneyIn)).toBe(true);
      expect(Number.isInteger(month.moneyOut)).toBe(true);
    }
  });

  test('names each month by its place: the last is the current month', () => {
    const detail = parseFigureDetail(answer(), NOW);

    expect(detail.months.map((m) => m.month)).toEqual(['2026-09-01', '2026-10-01', '2026-11-01']);
  });

  test('names the months right across a new year', () => {
    const january = new Date(Date.UTC(2027, 0, 5, 12));

    const detail = parseFigureDetail(answer(), january);

    expect(detail.months.map((m) => m.month)).toEqual(['2026-11-01', '2026-12-01', '2027-01-01']);
  });

  test('shows no months at all when one of them cannot be read: the places could not be trusted', () => {
    const detail = parseFigureDetail(
      answer({ trend: [{ month: 'Sep', revenue: 1, expenses: 1, profit: 0 }, { month: 'Oct', revenue: 'lots' }] }),
      NOW,
    );

    expect(detail.months).toEqual([]);
    expect(detail.unreadable).toBe(1);
  });

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

  test('removes direction-override characters from names', () => {
    const detail = parseFigureDetail(answer({ topCustomers: [{ name: 'Al ‮Noor‬', amount: 1 }] }), NOW);

    expect(detail.topCustomers[0].name).toBe('Al Noor');
  });

  test('leaves out a customer with no name', () => {
    const detail = parseFigureDetail(answer({ topCustomers: [{ name: '  ', amount: 5 }] }), NOW);

    expect(detail.topCustomers).toEqual([]);
  });

  test('gives the days money takes to come in and to go out', () => {
    const detail = parseFigureDetail(answer(), NOW);

    expect(detail.collectionDays).toBe(41);
    expect(detail.paymentDays).toBe(28);
  });

  test('treats 0 days as "not known", which is what the server means by it', () => {
    const detail = parseFigureDetail(answer({ arDays: 0, apDays: 0 }), NOW);

    expect(detail.collectionDays).toBeNull();
    expect(detail.paymentDays).toBeNull();
  });

  test('gives the change in sales on last month as whole percent, with its sign', () => {
    expect(parseFigureDetail(answer(), NOW).moneyInChangePct).toBe(-14);
  });

  test('gives no change when there is nothing to compare with', () => {
    const none = answer({ kpis: [{ labelKey: 'client.dash.kpi.revenueMtd', value: 5, delta: 0, format: 'currency' }] });

    expect(parseFigureDetail(none, NOW).moneyInChangePct).toBeNull();
    expect(parseFigureDetail(answer({ kpis: [] }), NOW).moneyInChangePct).toBeNull();
  });

  test('reads an answer that has only the summary, with nothing to show', () => {
    const detail = parseFigureDetail({ ok: true, currency: 'AED' }, NOW);

    expect(detail).toMatchObject({ months: [], topCustomers: [], invoices: [], collectionDays: null, unreadable: 0 });
  });

  test.each([
    ['nothing', null],
    ['a refusal', { ok: false, error: 'tenant_not_provisioned' }],
    ['a currency that is not a code', answer({ currency: 'dirham' })],
    ['more invoices than the app accepts', answer({ recentInvoices: Array.from({ length: 51 }, () => ({})) })],
    ['days that are not a whole number', answer({ arDays: 12.5 })],
  ])('refuses %s', (_name, bad) => {
    expect(() => parseFigureDetail(bad, NOW)).toThrow(FigureDetailError);
  });
});
