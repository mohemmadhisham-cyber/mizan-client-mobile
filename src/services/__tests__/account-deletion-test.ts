import { FunctionsHttpError } from '@supabase/supabase-js';

import { assertSupabaseConfigured } from '@/lib/env';
import { requestAccountDeletion } from '@/services/account-deletion';

const mockInvoke = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: { functions: { invoke: (...args: unknown[]) => mockInvoke(...args) } },
}));
jest.mock('@/lib/env', () => ({ assertSupabaseConfigured: jest.fn() }));

/** The error the Supabase client gives when the function answers with a status that is not 2xx. */
function httpError(status: number): FunctionsHttpError {
  return new FunctionsHttpError({ status } as Response);
}

describe('requestAccountDeletion', () => {
  test('reports the request as recorded when the server says ok', async () => {
    // Arrange
    mockInvoke.mockResolvedValue({ data: { ok: true }, error: null });

    // Act
    const outcome = await requestAccountDeletion();

    // Assert
    expect(outcome).toEqual({ status: 'requested' });
  });

  test('asks the account-deletion function and sends no user or company id', async () => {
    mockInvoke.mockResolvedValue({ data: { ok: true }, error: null });

    await requestAccountDeletion();

    expect(mockInvoke).toHaveBeenCalledTimes(1);
    expect(mockInvoke).toHaveBeenCalledWith('account-deletion', { body: { action: 'request' } });
  });

  test('reports "not offered" when the server has no such function', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: httpError(404) });

    const outcome = await requestAccountDeletion();

    expect(outcome).toEqual({ status: 'not_offered' });
  });

  test('fails when the server refuses, so a refusal is not shown as "not offered"', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: httpError(403) });

    await expect(requestAccountDeletion()).rejects.toThrow('deletion_request_failed');
  });

  test('fails when the server has a fault', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: httpError(500) });

    await expect(requestAccountDeletion()).rejects.toThrow('deletion_request_failed');
  });

  test('fails when the request could not be sent', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: new Error('Failed to send a request') });

    await expect(requestAccountDeletion()).rejects.toThrow('deletion_request_failed');
  });

  test('fails when the client call itself throws', async () => {
    mockInvoke.mockRejectedValue(new Error('offline'));

    await expect(requestAccountDeletion()).rejects.toThrow('offline');
  });

  test('sends nothing when the app has no server settings', async () => {
    (assertSupabaseConfigured as jest.Mock).mockImplementationOnce(() => {
      throw new Error('supabase_not_configured');
    });

    await expect(requestAccountDeletion()).rejects.toThrow('supabase_not_configured');
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  test.each([
    ['an answer without ok', {}],
    ['ok that is not true', { ok: false }],
    ['ok as a word', { ok: 'true' }],
    ['no answer', null],
  ])('does not claim the request was recorded for %s', async (_name, data) => {
    mockInvoke.mockResolvedValue({ data, error: null });

    await expect(requestAccountDeletion()).rejects.toThrow('deletion_request_unreadable');
  });
});
