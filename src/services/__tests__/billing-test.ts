import { formatMoneyMinor } from '@/lib/format';
import { billingService, minorUnits } from '@/services/billing';

const mockRpc = jest.fn();

jest.mock('@/i18n', () => ({ __esModule: true, default: { t: (key: string) => key }, currentLocale: () => 'en' }));

jest.mock('@/lib/supabase', () => ({
  supabase: { rpc: (...args: unknown[]) => mockRpc(...args) },
}));

beforeEach(() => {
  mockRpc.mockReset();
});

describe('money from the server', () => {
  test('is already in minor units, and is not multiplied', () => {
    expect(minorUnits(49_900)).toBe(49_900);
    expect(minorUnits(0)).toBe(0);
  });

  test('is read when it arrives as text, as large whole numbers can', () => {
    expect(minorUnits('49900')).toBe(49_900);
  });

  test.each([
    ['nothing', null],
    ['an absent value', undefined],
    ['empty text', ''],
    ['text that is no number', 'AED 499'],
    ['not a number at all', Number.NaN],
    ['no end', Number.POSITIVE_INFINITY],
    ['an object', {}],
  ])('is nothing when it is %s', (_name, value) => {
    expect(minorUnits(value)).toBe(0);
  });
});

describe('the plan', () => {
  test('shows the price the server holds: AED 499 a month is 49,900 fils, not a hundred times that', async () => {
    mockRpc.mockResolvedValue({
      data: [{ firm_name: 'Noor Accounting', plan_name: 'Growth', plan_price_monthly: 49_900, plan_currency: 'AED', next_invoice_due: '2026-12-01' }],
      error: null,
    });

    const plan = await billingService.getPlan();

    expect(mockRpc).toHaveBeenCalledWith('get_my_firm_billing_summary');
    expect(plan).toEqual({
      firmName: 'Noor Accounting',
      planName: 'Growth',
      priceMinor: 49_900,
      currency: 'AED',
      nextPaymentDue: '2026-12-01',
    });
    // What the screen draws from it.
    expect(formatMoneyMinor(plan!.priceMinor, 'AED', { locale: 'en-AE' })).toContain('499');
    expect(formatMoneyMinor(plan!.priceMinor, 'AED', { locale: 'en-AE' })).not.toContain('49,900');
  });

  test('a firm with no plan has no price', async () => {
    mockRpc.mockResolvedValue({
      data: [{ firm_name: 'Noor Accounting', plan_name: null, plan_price_monthly: null, plan_currency: null, next_invoice_due: null }],
      error: null,
    });

    expect(await billingService.getPlan()).toEqual({
      firmName: 'Noor Accounting',
      planName: null,
      priceMinor: 0,
      currency: 'AED',
      nextPaymentDue: null,
    });
  });

  test('is nothing when the server has nothing', async () => {
    mockRpc.mockResolvedValue({ data: [], error: null });

    expect(await billingService.getPlan()).toBeNull();
  });

  test('says so when it could not be read, so the screen does not show "none"', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'permission denied' } });

    await expect(billingService.getPlan()).rejects.toThrow('permission denied');
  });
});

describe('the invoices', () => {
  test('carry the amount the server holds, unchanged', async () => {
    mockRpc.mockResolvedValue({
      data: [
        { id: 'inv-1', number: 'INV-0001', amount: 52_395, currency: 'AED', status: 'unpaid', due_date: '2026-12-01', created_at: '2026-11-01T08:00:00Z' },
        { id: 'inv-2', number: 'INV-0002', amount: 0, currency: 'USD', status: 'paid', due_date: null, created_at: '2026-10-01T08:00:00Z' },
      ],
      error: null,
    });

    const invoices = await billingService.getInvoices();

    expect(mockRpc).toHaveBeenCalledWith('get_my_firm_invoices');
    expect(invoices).toEqual([
      { id: 'inv-1', number: 'INV-0001', date: '2026-11-01', status: 'unpaid', amountMinor: 52_395, currency: 'AED' },
      { id: 'inv-2', number: 'INV-0002', date: '2026-10-01', status: 'paid', amountMinor: 0, currency: 'USD' },
    ]);
  });

  test('are none when the server has none', async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });

    expect(await billingService.getInvoices()).toEqual([]);
  });

  test('say so when they could not be read', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'timeout' } });

    await expect(billingService.getInvoices()).rejects.toThrow('timeout');
  });
});
