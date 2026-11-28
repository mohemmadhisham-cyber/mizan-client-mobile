import {
  type AccountantRequest,
  canChooseLines,
  decideRequest,
  lineChoice,
  requestErrorKey,
  toggleLine,
} from '@/services/accountant-requests';

const mockInvoke = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: { functions: { invoke: (...args: unknown[]) => mockInvoke(...args) } },
}));
jest.mock('@/lib/env', () => ({ assertSupabaseConfigured: jest.fn() }));

const REQUEST_ID = '3f2c1a9e-0b7d-4c5e-9a1f-2d3e4f5a6b7c';

function prices(changes: AccountantRequest['changes']): AccountantRequest {
  return { id: REQUEST_ID, kind: 'set_prices', title: 'New prices', sentAt: '2026-11-26T10:00:00Z', changes };
}

const SIX = prices([
  { id: 11, label: 'Latte', from: 1800, to: 2000 },
  { id: 12, label: 'Mocha', from: 1900, to: 2100 },
  { id: 13, label: 'Tea', from: 900, to: 1000 },
  { id: 14, label: 'Cookie', from: 700, to: 800 },
  { id: 15, label: 'Muffin S', from: 1200, to: 1400, product: 7 },
  { id: 16, label: 'Muffin L', from: 1200, to: 1400, product: 7 },
]);

const all = (request: AccountantRequest) => new Set(request.changes.map((c) => c.id as number));

beforeEach(() => {
  mockInvoke.mockReset();
});

describe('choosing price lines', () => {
  test('a price change with ids on every line can be chosen line by line', () => {
    expect(canChooseLines(SIX)).toBe(true);
  });

  test('not when a line has no id, when ids repeat, for one line, or for another kind', () => {
    expect(canChooseLines(prices([{ label: 'Latte', from: 1, to: 2 }, { id: 2, label: 'Tea', from: 1, to: 2 }]))).toBe(false);
    expect(canChooseLines(prices([{ id: 2, label: 'A', from: 1, to: 2 }, { id: 2, label: 'B', from: 1, to: 2 }]))).toBe(false);
    expect(canChooseLines(prices([{ id: 2, label: 'A', from: 1, to: 2 }]))).toBe(false);
    expect(canChooseLines({ ...SIX, kind: 'loan_drafts' })).toBe(false);
    // A line without both prices is never offered on its own: it would show a price the owner was not sent.
    expect(canChooseLines(prices([{ id: 1, label: 'A', from: 1, to: null }, { id: 2, label: 'B', from: 1, to: 2 }]))).toBe(false);
  });

  test('tapping a line keeps it, and tapping again approves it, without changing the set it was given', () => {
    const start = all(SIX);
    const kept = toggleLine(SIX, start, 12);
    expect(kept.has(12)).toBe(false);
    expect(start.has(12)).toBe(true);
    expect(toggleLine(SIX, kept, 12).has(12)).toBe(true);
  });

  test('variants of one product move together', () => {
    const kept = toggleLine(SIX, all(SIX), 15);
    expect(kept.has(15)).toBe(false);
    expect(kept.has(16)).toBe(false);
    expect(toggleLine(SIX, kept, 16).has(15)).toBe(true);
  });

  test('every line chosen sends nothing extra: the whole request, as before', () => {
    expect(lineChoice(SIX, all(SIX), { '12': 'not this' })).toBeNull();
  });

  test('some lines: the chosen ids in order, and a trimmed reason for each kept line that has one', () => {
    let chosen = toggleLine(SIX, all(SIX), 12);
    chosen = toggleLine(SIX, chosen, 14);
    expect(lineChoice(SIX, chosen, { '12': '  Too soon  ', '14': '   ', '11': 'ignored, it is approved' })).toEqual({
      items: [11, 13, 15, 16],
      keptReasons: { '12': 'Too soon' },
    });
  });
});

describe('approving some lines', () => {
  test('sends the chosen ids and reasons, and reads "3 of 6" from the answer', async () => {
    mockInvoke.mockResolvedValue({ data: { ok: true, state: 'applied', approved: 3, of: 6, notWritten: [] }, error: null });

    const outcome = await decideRequest(REQUEST_ID, 'approve', undefined, { items: [11, 13, 14], keptReasons: { '12': 'Too soon' } });

    expect(mockInvoke).toHaveBeenCalledWith('client-targets', {
      body: { action: 'owner_decide', actionId: REQUEST_ID, decision: 'approve', items: [11, 13, 14], keptReasons: { '12': 'Too soon' } },
    });
    expect(outcome).toEqual({ status: 'applied', approved: 3, of: 6, notWritten: [] });
  });

  test('leaves out keptReasons when there are none', async () => {
    mockInvoke.mockResolvedValue({ data: { ok: true, state: 'applied', approved: 1, of: 2 }, error: null });

    await decideRequest(REQUEST_ID, 'approve', undefined, { items: [11], keptReasons: {} });

    expect(mockInvoke).toHaveBeenCalledWith('client-targets', {
      body: { action: 'owner_decide', actionId: REQUEST_ID, decision: 'approve', items: [11] },
    });
  });

  test('passes on the lines that could not be written', async () => {
    mockInvoke.mockResolvedValue({ data: { ok: true, state: 'applied', approved: 2, of: 6, notWritten: [13] }, error: null });

    expect(await decideRequest(REQUEST_ID, 'approve', undefined, { items: [11, 13], keptReasons: {} })).toEqual({
      status: 'applied', approved: 2, of: 6, notWritten: [13],
    });
  });

  test('never sends lines with a decline, nor an empty list', async () => {
    mockInvoke.mockResolvedValue({ data: { ok: true, state: 'declined' }, error: null });
    await decideRequest(REQUEST_ID, 'decline', 'No', { items: [11], keptReasons: {} });
    expect(mockInvoke).toHaveBeenCalledWith('client-targets', {
      body: { action: 'owner_decide', actionId: REQUEST_ID, decision: 'decline', reason: 'No' },
    });

    mockInvoke.mockClear();
    expect(await decideRequest(REQUEST_ID, 'approve', undefined, { items: [], keptReasons: {} })).toEqual({
      status: 'error', code: 'invalid_items',
    });
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  test('a reason that is too long is refused before anything is sent', async () => {
    const outcome = await decideRequest(REQUEST_ID, 'approve', undefined, { items: [11], keptReasons: { '12': 'x'.repeat(501) } });

    expect(outcome).toEqual({ status: 'error', code: 'invalid_reason' });
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  test('the new refusals have their own words', () => {
    expect(requestErrorKey('same_product')).toBe('requests.errSameProduct');
    expect(requestErrorKey('invalid_items')).toBe('requests.errInvalidItems');
    expect(requestErrorKey('items_not_supported')).toBe('requests.errContactAccountant');
  });
});
