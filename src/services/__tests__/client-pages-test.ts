import { FunctionsHttpError } from '@supabase/supabase-js';

import {
  bookMeeting,
  type ClientInvoice,
  getClientInvoices,
  getClientServices,
  getMeetingSlots,
  payPageUrl,
  slotsByDay,
  totalDue,
} from '@/services/client-pages';

const mockInvoke = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: { functions: { invoke: (...args: unknown[]) => mockInvoke(...args) } },
}));
jest.mock('@/lib/env', () => ({ assertSupabaseConfigured: jest.fn(), EXPO_PUBLIC_WEB_APP_URL: 'https://mizan.team' }));

const TOKEN = '3f2a1b4c-5d6e-4f70-8a9b-0c1d2e3f4a5b';

/** A failed call as supabase-js gives it: the response, with a JSON body when there is one. */
function httpError(status: number, body?: unknown) {
  const response = { status, json: () => (body === undefined ? Promise.reject(new Error('no body')) : Promise.resolve(body)) };
  return { data: null, error: new FunctionsHttpError(response as unknown as Response) };
}

const invoice = (over: Partial<ClientInvoice> = {}): ClientInvoice => ({
  id: 'p1',
  description: 'Invoice 12',
  amountMinor: 105000,
  currency: 'AED',
  state: 'due',
  createdAt: '2026-11-20T09:00:00Z',
  paidAt: null,
  payToken: TOKEN,
  payUntil: null,
  ...over,
});

beforeEach(() => {
  mockInvoke.mockReset();
});

describe('your services', () => {
  test('asks the server with no client id, and reads its answer', async () => {
    mockInvoke.mockResolvedValue({
      data: {
        ok: true,
        firm: 'Acme Accounting',
        engagements: [{ id: 'e1', name: 'Monthly books', status: 'active', periodStart: '2026-01-01', periodEnd: null }],
        services: [
          { id: 's1', nameEn: 'Bookkeeping', nameAr: 'مسك الدفاتر', cadence: 'monthly', priceMinor: 150000, currency: 'AED', engagementId: 'e1', since: null },
        ],
      },
      error: null,
    });

    const result = await getClientServices();

    expect(mockInvoke).toHaveBeenCalledWith('connect', { body: { action: 'client_services' } });
    expect(result.status).toBe('ok');
    expect(result.status === 'ok' && result.value.services[0].priceMinor).toBe(150000);
  });

  test('a server that does not offer it yet reads as "not offered"', async () => {
    mockInvoke.mockResolvedValue(httpError(404, { ok: false, error: 'unknown_action' }));

    expect(await getClientServices()).toEqual({ status: 'not_offered' });
  });

  test('an answer of the wrong shape is a failure, not an empty page', async () => {
    mockInvoke.mockResolvedValue({ data: { ok: true, engagements: 'nope' }, error: null });

    await expect(getClientServices()).rejects.toThrow('client_services_unreadable');
  });

  test('a price that is not whole minor units is refused', async () => {
    mockInvoke.mockResolvedValue({
      data: {
        ok: true, firm: null, engagements: [],
        services: [{ id: 's1', nameEn: 'X', nameAr: 'X', cadence: 'monthly', priceMinor: 12.5, currency: 'AED', engagementId: 'e1', since: null }],
      },
      error: null,
    });

    await expect(getClientServices()).rejects.toThrow('client_services_unreadable');
  });

  test('any other failure is thrown', async () => {
    mockInvoke.mockResolvedValue(httpError(500));

    await expect(getClientServices()).rejects.toThrow('client_services_failed');
  });
});

describe('invoices to pay', () => {
  test('reads the invoices', async () => {
    mockInvoke.mockResolvedValue({ data: { ok: true, firm: 'Acme', invoices: [invoice()] }, error: null });

    const result = await getClientInvoices();

    expect(mockInvoke).toHaveBeenCalledWith('connect', { body: { action: 'client_invoices' } });
    expect(result).toEqual({ status: 'ok', value: { firm: 'Acme', invoices: [invoice()] } });
  });

  test('a pay token of the wrong shape is refused, so nothing odd is opened', async () => {
    mockInvoke.mockResolvedValue({ data: { ok: true, firm: null, invoices: [invoice({ payToken: '../evil' })] }, error: null });

    await expect(getClientInvoices()).rejects.toThrow('client_invoices_unreadable');
  });

  test('the pay page is the web app’s own, and only for a real token', () => {
    expect(payPageUrl(TOKEN)).toBe(`https://mizan.team/pay/${TOKEN}`);
    expect(payPageUrl(null)).toBeNull();
    expect(payPageUrl('https://evil.example')).toBeNull();
  });

  test('adds up what is due when it is all in one currency', () => {
    expect(totalDue([invoice(), invoice({ id: 'p2', amountMinor: 5000 }), invoice({ id: 'p3', state: 'paid' })])).toEqual({
      amountMinor: 110000, currency: 'AED', count: 2,
    });
    expect(totalDue([invoice(), invoice({ id: 'p2', currency: 'SAR' })])).toBeNull();
    expect(totalDue([invoice({ state: 'paid' })])).toBeNull();
  });
});

describe('book a meeting', () => {
  test('reads the free slots', async () => {
    mockInvoke.mockResolvedValue({
      data: { ok: true, firm: 'Acme', minutes: 30, timeZone: 'Asia/Dubai', accepting: true, slots: [{ date: '2026-12-02', start: '10:00', end: '10:30' }] },
      error: null,
    });

    const result = await getMeetingSlots();

    expect(mockInvoke).toHaveBeenCalledWith('connect', { body: { action: 'meeting_slots' } });
    expect(result.status === 'ok' && result.value.slots).toHaveLength(1);
  });

  test('groups slots by day, in order', () => {
    expect(slotsByDay([
      { date: '2026-12-03', start: '09:00', end: '09:30' },
      { date: '2026-12-02', start: '11:00', end: '11:30' },
      { date: '2026-12-02', start: '10:00', end: '10:30' },
    ])).toEqual([
      { date: '2026-12-02', slots: [{ date: '2026-12-02', start: '10:00', end: '10:30' }, { date: '2026-12-02', start: '11:00', end: '11:30' }] },
      { date: '2026-12-03', slots: [{ date: '2026-12-03', start: '09:00', end: '09:30' }] },
    ]);
  });

  test('sends the day, the time and the note, and nothing about who is asking', async () => {
    mockInvoke.mockResolvedValue({ data: { ok: true, meeting: { id: 'ev1', date: '2026-12-02', start: '10:00', status: 'pending' } }, error: null });

    expect(await bookMeeting({ date: '2026-12-02', start: '10:00', note: '  VAT  ' })).toEqual({
      status: 'requested', date: '2026-12-02', start: '10:00',
    });
    expect(mockInvoke).toHaveBeenCalledWith('connect', { body: { action: 'meeting_book', date: '2026-12-02', start: '10:00', note: 'VAT' } });
  });

  test('leaves out an empty note', async () => {
    mockInvoke.mockResolvedValue({ data: { ok: true, meeting: { id: 'ev1', date: '2026-12-02', start: '10:00', status: 'pending' } }, error: null });

    await bookMeeting({ date: '2026-12-02', start: '10:00', note: '   ' });

    expect(mockInvoke).toHaveBeenCalledWith('connect', { body: { action: 'meeting_book', date: '2026-12-02', start: '10:00' } });
  });

  test('a time someone just took, and too many open requests, are told apart', async () => {
    mockInvoke.mockResolvedValueOnce(httpError(409, { ok: false, error: 'slot_taken' }));
    expect(await bookMeeting({ date: '2026-12-02', start: '10:00' })).toEqual({ status: 'slot_taken' });

    mockInvoke.mockResolvedValueOnce(httpError(409, { ok: false, error: 'too_many_open' }));
    expect(await bookMeeting({ date: '2026-12-02', start: '10:00' })).toEqual({ status: 'too_many_open' });
  });

  test('not offered, and a failure, are not mistaken for a booking', async () => {
    mockInvoke.mockResolvedValueOnce(httpError(404));
    expect(await bookMeeting({ date: '2026-12-02', start: '10:00' })).toEqual({ status: 'not_offered' });

    mockInvoke.mockResolvedValueOnce(httpError(500));
    await expect(bookMeeting({ date: '2026-12-02', start: '10:00' })).rejects.toThrow('meeting_book_failed');

    mockInvoke.mockResolvedValueOnce({ data: { ok: true }, error: null });
    await expect(bookMeeting({ date: '2026-12-02', start: '10:00' })).rejects.toThrow('meeting_book_unreadable');
  });

  test('a call that never reached the server is a failure', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: new Error('network') });

    await expect(bookMeeting({ date: '2026-12-02', start: '10:00' })).rejects.toThrow('meeting_book_failed');
  });
});
