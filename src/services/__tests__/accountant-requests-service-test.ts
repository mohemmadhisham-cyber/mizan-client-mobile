import { FunctionsHttpError } from '@supabase/supabase-js';

import { DECLINE_REASON_MAX, decideRequest, listPendingRequests } from '@/services/accountant-requests';

const mockInvoke = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: { functions: { invoke: (...args: unknown[]) => mockInvoke(...args) } },
}));
jest.mock('@/lib/env', () => ({ assertSupabaseConfigured: jest.fn() }));

const REQUEST_ID = '3f2c1a9e-0b7d-4c5e-9a1f-2d3e4f5a6b7c';

/** A request the app can show in full. */
function priceRequest(overrides: Record<string, unknown> = {}) {
  return {
    id: REQUEST_ID,
    kind: 'set_prices',
    title: 'New prices',
    sentAt: '2026-11-26T10:00:00Z',
    changes: [{ label: 'Latte', from: 1800, to: 2000 }],
    ...overrides,
  };
}

function answer(data: unknown) {
  mockInvoke.mockResolvedValue({ data, error: null });
}

/** The error the Supabase client gives for a status that is not 2xx, with the body the server sent. */
function httpError(status: number, body: unknown, readable = true): FunctionsHttpError {
  const context = {
    status,
    json: async () => {
      if (!readable) throw new SyntaxError('Unexpected token');
      return body;
    },
  };
  return new FunctionsHttpError(context as unknown as Response);
}

function fail(error: unknown) {
  mockInvoke.mockResolvedValue({ data: null, error });
}

describe('listPendingRequests', () => {
  test('asks for the pending list and sends no client or firm id', async () => {
    answer({ ok: true, requests: [] });

    await listPendingRequests();

    expect(mockInvoke).toHaveBeenCalledTimes(1);
    expect(mockInvoke).toHaveBeenCalledWith('client-targets', { body: { action: 'owner_pending' } });
  });

  test('returns a request the app can show in full', async () => {
    answer({ ok: true, requests: [priceRequest()] });

    const result = await listPendingRequests();

    expect(result.unreadable).toBe(0);
    expect(result.requests).toHaveLength(1);
    expect(result.requests[0]).toMatchObject({ id: REQUEST_ID, kind: 'set_prices', title: 'New prices' });
    expect(result.requests[0].changes[0]).toMatchObject({ label: 'Latte', from: 1800, to: 2000 });
  });

  test('counts a request it cannot read, and still returns the ones it can', async () => {
    answer({ ok: true, requests: [priceRequest(), { id: 'not-a-uuid', kind: 'set_prices' }] });

    const result = await listPendingRequests();

    expect(result.requests).toHaveLength(1);
    expect(result.unreadable).toBe(1);
  });

  test.each([
    ['a price change with no new price', priceRequest({ changes: [{ label: 'Latte', from: 1800 }] })],
    ['a price that is not a whole number of minor units', priceRequest({ changes: [{ label: 'Latte', from: 18.5, to: 20 }] })],
    ['a budget request with no budget', priceRequest({ kind: 'activate_budget', changes: [] })],
    ['a loan draft with no amount', priceRequest({ kind: 'loan_drafts', changes: [{ label: 'Instalment 3' }] })],
    ['a statement with no amount', priceRequest({ kind: 'send_statements', changes: [{ label: 'Customer A' }] })],
    ['more changes than one request may carry', priceRequest({ changes: Array.from({ length: 501 }, () => ({ label: 'Item', from: 1, to: 2 })) })],
    ['a currency that is not a three-letter code', priceRequest({ currency: 'dirham' })],
  ])('does not show %s: the owner must see all of what they approve', async (_name, request) => {
    answer({ ok: true, requests: [request] });

    const result = await listPendingRequests();

    expect(result.requests).toHaveLength(0);
    expect(result.unreadable).toBe(1);
  });

  test('shows a kind it does not know from its title and changes', async () => {
    answer({ ok: true, requests: [priceRequest({ kind: 'something_new', changes: [{ label: 'A line' }] })] });

    const result = await listPendingRequests();

    expect(result.requests).toHaveLength(1);
    expect(result.unreadable).toBe(0);
  });

  test('removes direction-override characters, so text cannot be reordered on screen', async () => {
    answer({ ok: true, requests: [priceRequest({ title: 'New ‮prices‬', from: '⁦Accountant⁩' })] });

    const result = await listPendingRequests();

    expect(result.requests[0].title).toBe('New prices');
    expect(result.requests[0].from).toBe('Accountant');
  });

  test('keeps Arabic text as it is', async () => {
    answer({ ok: true, requests: [priceRequest({ titleAr: 'أسعار جديدة' })] });

    const result = await listPendingRequests();

    expect(result.requests[0].titleAr).toBe('أسعار جديدة');
  });

  test('fails with the server code when the answer is a refusal', async () => {
    answer({ ok: false, error: 'forbidden' });

    await expect(listPendingRequests()).rejects.toMatchObject({ code: 'forbidden' });
  });

  test('fails as unreadable when the answer is not a list', async () => {
    answer({ something: 'else' });

    await expect(listPendingRequests()).rejects.toMatchObject({ code: 'request_unreadable' });
  });

  test('fails with the code in the body of a server error', async () => {
    fail(httpError(403, { error: 'forbidden' }));

    await expect(listPendingRequests()).rejects.toMatchObject({ code: 'forbidden' });
  });

  test('fails as a server error when the body cannot be read', async () => {
    fail(httpError(500, null, false));

    await expect(listPendingRequests()).rejects.toMatchObject({ code: 'server_error' });
  });

  test('fails as a network error when the request could not be sent', async () => {
    fail(new Error('Failed to send a request'));

    await expect(listPendingRequests()).rejects.toMatchObject({ code: 'network_error' });
  });
});

describe('decideRequest', () => {
  test('sends only the request id and the decision when approving', async () => {
    answer({ ok: true, state: 'applied' });

    const outcome = await decideRequest(REQUEST_ID, 'approve', 'a reason that must not be sent');

    expect(outcome).toEqual({ status: 'applied' });
    expect(mockInvoke).toHaveBeenCalledWith('client-targets', {
      body: { action: 'owner_decide', actionId: REQUEST_ID, decision: 'approve' },
    });
  });

  test('sends the reason, trimmed, when declining', async () => {
    answer({ ok: true, state: 'declined' });

    const outcome = await decideRequest(REQUEST_ID, 'decline', '  Prices are too high.  ');

    expect(outcome).toEqual({ status: 'declined' });
    expect(mockInvoke).toHaveBeenCalledWith('client-targets', {
      body: { action: 'owner_decide', actionId: REQUEST_ID, decision: 'decline', reason: 'Prices are too high.' },
    });
  });

  test('sends no reason when it is only spaces', async () => {
    answer({ ok: true, state: 'declined' });

    await decideRequest(REQUEST_ID, 'decline', '   ');

    expect(mockInvoke).toHaveBeenCalledWith('client-targets', {
      body: { action: 'owner_decide', actionId: REQUEST_ID, decision: 'decline' },
    });
  });

  test('refuses a reason that is too long, without calling the server', async () => {
    const outcome = await decideRequest(REQUEST_ID, 'decline', 'x'.repeat(DECLINE_REASON_MAX + 1));

    expect(outcome).toEqual({ status: 'error', code: 'invalid_reason' });
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  test('accepts a reason of exactly the longest length', async () => {
    answer({ ok: true, state: 'declined' });

    const outcome = await decideRequest(REQUEST_ID, 'decline', 'x'.repeat(DECLINE_REASON_MAX));

    expect(outcome).toEqual({ status: 'declined' });
  });

  test('does not claim success for a state it does not know', async () => {
    answer({ ok: true, state: 'queued' });

    const outcome = await decideRequest(REQUEST_ID, 'approve');

    expect(outcome).toEqual({ status: 'error', code: 'request_unreadable' });
  });

  test('does not claim success when ok comes with no state', async () => {
    answer({ ok: true });

    expect(await decideRequest(REQUEST_ID, 'approve')).toEqual({ status: 'error', code: 'request_unreadable' });
  });

  test('asks for a one-time code when approving needs one', async () => {
    answer({ ok: false, error: 'step_up_required', scope: 'targets.approve' });

    const outcome = await decideRequest(REQUEST_ID, 'approve');

    expect(outcome).toEqual({ status: 'step_up_required', scope: 'targets.approve' });
  });

  test('asks for the one scope it knows when the server names none', async () => {
    answer({ ok: false, error: 'step_up_required' });

    expect(await decideRequest(REQUEST_ID, 'approve')).toEqual({ status: 'step_up_required', scope: 'targets.approve' });
  });

  test('never collects a code for a scope it was handed', async () => {
    answer({ ok: false, error: 'step_up_required', scope: 'payments.send' });

    const outcome = await decideRequest(REQUEST_ID, 'approve');

    expect(outcome).toEqual({ status: 'error', code: 'unknown' });
  });

  test('never collects a code for a decline', async () => {
    answer({ ok: false, error: 'step_up_required', scope: 'targets.approve' });

    const outcome = await decideRequest(REQUEST_ID, 'decline');

    expect(outcome).toEqual({ status: 'error', code: 'unknown' });
  });

  test('passes on the server code when the request is no longer waiting', async () => {
    answer({ ok: false, error: 'not_waiting' });

    expect(await decideRequest(REQUEST_ID, 'approve')).toEqual({ status: 'error', code: 'not_waiting' });
  });

  test('reports an unknown failure when the server gives no code', async () => {
    answer({ ok: false });

    expect(await decideRequest(REQUEST_ID, 'approve')).toEqual({ status: 'error', code: 'unknown' });
  });

  test('reports an unreadable answer as a failure', async () => {
    answer('not an object');

    expect(await decideRequest(REQUEST_ID, 'approve')).toEqual({ status: 'error', code: 'request_unreadable' });
  });

  test('reports the code in the body of a server error', async () => {
    fail(httpError(409, { error: 'budget_changed' }));

    expect(await decideRequest(REQUEST_ID, 'approve')).toEqual({ status: 'error', code: 'budget_changed' });
  });

  test('reports a network error when the request could not be sent', async () => {
    fail(new Error('Failed to send a request'));

    expect(await decideRequest(REQUEST_ID, 'approve')).toEqual({ status: 'error', code: 'network_error' });
  });
});
