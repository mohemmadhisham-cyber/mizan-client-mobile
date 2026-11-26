import { DashboardUnavailableError } from '@/services/client-data';
import { FigureDetailError } from '@/services/figure-detail';
import {
  getCashView,
  getInvoicePage,
  getPeriodView,
  mergeInvoicePages,
  parseCashView,
  parseInvoicePage,
  parsePeriodView,
} from '@/services/figure-views';

const mockInvoke = jest.fn();

jest.mock('@/i18n', () => ({ __esModule: true, default: { t: (key: string) => key }, currentLocale: () => 'en' }));

jest.mock('@/lib/supabase', () => ({
  supabase: { functions: { invoke: (...args: unknown[]) => mockInvoke(...args) } },
}));

/** What a server that does not know the views sends back whatever it is asked: the plain dashboard. */
const PLAIN_DASHBOARD = { ok: true, currency: 'AED', kpis: [], trend: [], topCustomers: [], recentInvoices: [], mobile: {} };

function period(overrides: Record<string, unknown> = {}) {
  return {
    ok: true,
    view: 'period',
    currency: 'AED',
    period: { key: 'last_month', from: '2026-10-01', to: '2026-10-31' },
    moneyIn: 9_500_000,
    moneyOut: 6_500_000,
    profit: 3_000_000,
    moneyOutGroups: [
      { name: 'Salaries', amount: 4_000_000 },
      { name: 'Rent', amount: 1_500_000 },
    ],
    moneyOutOther: 1_000_000,
    ...overrides,
  };
}

function cash(overrides: Record<string, unknown> = {}) {
  return {
    ok: true,
    view: 'cash',
    currency: 'AED',
    asOf: '2026-11-26',
    total: 12_535_085,
    accounts: [
      { name: 'Emirates NBD current', balance: 12_500_010 },
      { name: 'Petty cash', balance: 35_075 },
    ],
    ...overrides,
  };
}

const invoice = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  number: `INV/2026/${id}`,
  customer: 'Al Noor Trading',
  date: '2026-11-02',
  due: '2026-12-02',
  amountMinor: 525_000,
  residualMinor: 525_000,
  status: 'open',
  ...overrides,
});

function invoices(overrides: Record<string, unknown> = {}) {
  return { ok: true, view: 'invoices', currency: 'AED', offset: 0, nextOffset: 20, invoices: [invoice('11'), invoice('12')], ...overrides };
}

beforeEach(() => {
  mockInvoke.mockReset();
});

describe('a period', () => {
  test('is read as the server sent it: whole minor units, nothing multiplied', () => {
    expect(parsePeriodView(period(), 'last_month')).toEqual({
      currency: 'AED',
      period: 'last_month',
      from: '2026-10-01',
      to: '2026-10-31',
      moneyIn: 9_500_000,
      moneyOut: 6_500_000,
      profit: 3_000_000,
      groups: [
        { name: 'Salaries', amountMinor: 4_000_000 },
        { name: 'Rent', amountMinor: 1_500_000 },
      ],
      otherMinor: 1_000_000,
    });
  });

  test('is "not offered" from a server that does not know the view and sends the plain dashboard', () => {
    expect(parsePeriodView(PLAIN_DASHBOARD, 'this_month')).toBeNull();
    expect(parsePeriodView(null, 'this_month')).toBeNull();
    expect(parsePeriodView('nonsense', 'this_month')).toBeNull();
  });

  test('an answer for another period is never shown under this one’s name', () => {
    expect(() => parsePeriodView(period(), 'this_month')).toThrow(FigureDetailError);
  });

  test('has no breakdown when the server could not make one', () => {
    const view = parsePeriodView(period({ moneyOutGroups: null, moneyOutOther: 0 }), 'last_month');

    expect(view?.groups).toBeNull();
    expect(view?.moneyOut).toBe(6_500_000);
  });

  test.each([
    ['the parts do not come to the whole', { moneyOutOther: 999_999 }],
    ['one part cannot be read', { moneyOutGroups: [{ name: 'Salaries', amount: 4_000_000 }, { name: 'Rent', amount: '1500000' }], moneyOutOther: 2_500_000 }],
    ['one part is a fraction', { moneyOutGroups: [{ name: 'Salaries', amount: 4_000_000.5 }, { name: 'Rent', amount: 1_500_000 }] }],
    ['one part has no name', { moneyOutGroups: [{ name: '  ', amount: 4_000_000 }, { name: 'Rent', amount: 1_500_000 }] }],
  ])('shows the totals and no breakdown when %s', (_name, overrides) => {
    const view = parsePeriodView(period(overrides), 'last_month');

    expect(view?.groups).toBeNull();
    expect(view?.otherMinor).toBe(0);
    expect(view?.moneyOut).toBe(6_500_000);
  });

  test('takes characters that reorder text out of an account’s name', () => {
    const view = parsePeriodView(period({ moneyOutGroups: [{ name: 'Rent‮gnp.exe', amount: 5_500_000 }] }), 'last_month');

    expect(view?.groups).toEqual([{ name: 'Rentgnp.exe', amountMinor: 5_500_000 }]);
  });

  test.each([
    ['a total that is a fraction', { moneyOut: 6_500_000.5 }],
    ['a total that is text', { moneyIn: '9500000' }],
    ['a currency that is not one', { currency: 'dirhams' }],
    ['a date that does not exist', { period: { key: 'last_month', from: '2026-02-30', to: '2026-10-31' } }],
    ['a period it does not know', { period: { key: 'all_time', from: '2026-10-01', to: '2026-10-31' } }],
  ])('cannot be read with %s, and says so instead of showing a blank', (_name, overrides) => {
    expect(() => parsePeriodView(period(overrides), 'last_month')).toThrow(FigureDetailError);
  });
});

describe('cash by account', () => {
  test('is read as the server sent it', () => {
    expect(parseCashView(cash())).toEqual({
      currency: 'AED',
      asOf: '2026-11-26',
      totalMinor: 12_535_085,
      accounts: [
        { name: 'Emirates NBD current', balanceMinor: 12_500_010 },
        { name: 'Petty cash', balanceMinor: 35_075 },
      ],
      unreadable: 0,
    });
  });

  test('keeps an overdrawn account as it is', () => {
    expect(parseCashView(cash({ total: -25_000, accounts: [{ name: 'Overdraft', balance: -25_000 }] }))?.accounts).toEqual([
      { name: 'Overdraft', balanceMinor: -25_000 },
    ]);
  });

  test('counts an account it cannot read, and then lists none: the rest would not come to the total', () => {
    const view = parseCashView(cash({ total: 100, accounts: [{ name: 'Current', balance: 100 }, { name: 'Broken', balance: 1.5 }, 'nonsense'] }));

    expect(view?.accounts).toEqual([]);
    expect(view?.unreadable).toBe(2);
    expect(view?.totalMinor).toBe(100);
  });

  test('is "not offered" from a server that sends the plain dashboard', () => {
    expect(parseCashView(PLAIN_DASHBOARD)).toBeNull();
  });

  test.each([
    ['a company with too many accounts to list, which the server sends as a total and no list', { accounts: [] }],
    ['a list that leaves an account out', { accounts: [{ name: 'Petty cash', balance: 35_075 }] }],
  ])('shows the total and no list for %s: a list is shown only if it comes to the total', (_name, overrides) => {
    const view = parseCashView(cash(overrides));

    expect(view?.accounts).toEqual([]);
    expect(view?.totalMinor).toBe(12_535_085);
  });

  test('an empty list with nothing in the bank is simply empty', () => {
    expect(parseCashView(cash({ total: 0, accounts: [] }))).toMatchObject({ totalMinor: 0, accounts: [], unreadable: 0 });
  });

  test('cannot be read with a total that is not a whole number', () => {
    expect(() => parseCashView(cash({ total: 1.25 }))).toThrow(FigureDetailError);
  });
});

describe('a page of invoices', () => {
  test('is read as the server sent it', () => {
    const page = parseInvoicePage(invoices());

    expect(page?.invoices).toHaveLength(2);
    expect(page?.invoices[0]).toEqual({
      id: '11',
      number: 'INV/2026/11',
      customer: 'Al Noor Trading',
      date: '2026-11-02',
      due: '2026-12-02',
      amountMinor: 525_000,
      residualMinor: 525_000,
      status: 'open',
    });
    expect(page?.nextOffset).toBe(20);
    expect(page?.unreadable).toBe(0);
  });

  test('knows the last page', () => {
    expect(parseInvoicePage(invoices({ nextOffset: null }))?.nextOffset).toBeNull();
  });

  test('counts an invoice it cannot read and still shows the rest', () => {
    const page = parseInvoicePage(invoices({ invoices: [invoice('11'), invoice('12', { status: 'cancelled' }), invoice('13', { amountMinor: 10.5 })] }));

    expect(page?.invoices.map((row) => row.id)).toEqual(['11']);
    expect(page?.unreadable).toBe(2);
  });

  test('is "not offered" from a server that sends the plain dashboard', () => {
    expect(parseInvoicePage(PLAIN_DASHBOARD)).toBeNull();
  });

  test.each([
    ['a next page that is not a whole number', { nextOffset: 20.5 }],
    ['a next page at the start again', { nextOffset: 0 }],
    ['more rows than a page holds', { invoices: Array.from({ length: 51 }, (_unused, index) => invoice(String(index))) }],
  ])('cannot be read with %s', (_name, overrides) => {
    expect(() => parseInvoicePage(invoices(overrides))).toThrow(FigureDetailError);
  });
});

describe('an answer to another question', () => {
  test('is an error, not an old server: a cash answer is never read as "periods are not offered"', () => {
    expect(() => parsePeriodView(cash(), 'this_month')).toThrow(FigureDetailError);
    expect(() => parseCashView(invoices())).toThrow(FigureDetailError);
    expect(() => parseInvoicePage(period())).toThrow(FigureDetailError);
  });

  test('a view name that is not text is no view at all', () => {
    expect(parseCashView({ ...PLAIN_DASHBOARD, view: 7 })).toBeNull();
  });
});

describe('several pages as one list', () => {
  const pageOf = (...ids: string[]) => parseInvoicePage(invoices({ invoices: ids.map((id) => invoice(id)) }));

  test('keeps the order the pages came in', () => {
    expect(mergeInvoicePages([pageOf('3', '2'), pageOf('1')]).map((row) => row.id)).toEqual(['3', '2', '1']);
  });

  test('shows an invoice once when a new one arriving moved it onto the next page too', () => {
    expect(mergeInvoicePages([pageOf('3', '2'), pageOf('2', '1')]).map((row) => row.id)).toEqual(['3', '2', '1']);
  });

  test('passes over a page that is not there', () => {
    expect(mergeInvoicePages([pageOf('3'), null, pageOf('1')]).map((row) => row.id)).toEqual(['3', '1']);
  });

  test('is empty with no pages, or a server that sends none', () => {
    expect(mergeInvoicePages([])).toEqual([]);
    expect(mergeInvoicePages([null])).toEqual([]);
  });
});

describe('asking the server', () => {
  test('asks for the period by name, and sends nothing about who is asking', async () => {
    mockInvoke.mockResolvedValue({ data: period(), error: null });

    await getPeriodView('last_month');

    expect(mockInvoke).toHaveBeenCalledWith('client-dashboard', { body: { view: 'period', period: 'last_month' } });
  });

  test('asks for cash, and for a page of invoices from where the last one ended', async () => {
    mockInvoke.mockResolvedValue({ data: cash(), error: null });
    await getCashView();
    expect(mockInvoke).toHaveBeenLastCalledWith('client-dashboard', { body: { view: 'cash' } });

    mockInvoke.mockResolvedValue({ data: invoices(), error: null });
    await getInvoicePage(40);
    expect(mockInvoke).toHaveBeenLastCalledWith('client-dashboard', { body: { view: 'invoices', offset: 40 } });
  });

  test('a server that does not know the views leaves each screen as it was', async () => {
    mockInvoke.mockResolvedValue({ data: PLAIN_DASHBOARD, error: null });

    expect(await getPeriodView('this_month')).toBeNull();
    expect(await getCashView()).toBeNull();
    expect(await getInvoicePage(0)).toBeNull();
  });

  test.each([
    ['the phone is offline', { data: null, error: new Error('Network request failed') }, 'network_error'],
    ['the server sends nothing', { data: null, error: null }, 'network_error'],
    ['the company is suspended', { data: { ok: false, error: 'tenant_suspended' }, error: null }, 'tenant_suspended'],
    ['the server refuses without a reason', { data: { ok: false }, error: null }, 'unavailable'],
  ])('says the dashboard is unavailable when %s', async (_name, result, code) => {
    mockInvoke.mockResolvedValue(result);

    await expect(getCashView()).rejects.toMatchObject({ name: 'DashboardUnavailableError', code });
    await expect(getCashView()).rejects.toBeInstanceOf(DashboardUnavailableError);
  });
});
