import { FunctionsHttpError } from '@supabase/supabase-js';

import { reviewSignIn, verifyEmailOtp } from '@/services/auth';

const mockVerify = jest.fn();
const mockInvoke = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: { verifyOtp: (...args: unknown[]) => mockVerify(...args) },
    functions: { invoke: (...args: unknown[]) => mockInvoke(...args) },
  },
}));
jest.mock('@/lib/env', () => ({ assertSupabaseConfigured: jest.fn() }));
jest.mock('@/i18n', () => ({ __esModule: true, default: { t: (key: string) => key }, currentLocale: () => 'en' }));

const WRONG = { data: null, error: { message: 'Token has expired or is invalid' } };

beforeEach(() => {
  mockVerify.mockReset();
  mockInvoke.mockReset();
});

describe('signing in with the emailed code', () => {
  test('a right code signs in, and the review sign-in is never asked', async () => {
    mockVerify.mockResolvedValue({ data: {}, error: null });

    expect(await verifyEmailOtp('owner@example.com', '123456')).toEqual({ ok: true });
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  test('a wrong code for anyone else shows the normal error', async () => {
    mockVerify.mockResolvedValue(WRONG);
    mockInvoke.mockResolvedValue({ data: null, error: new FunctionsHttpError({ status: 400 } as Response) });

    expect(await verifyEmailOtp('owner@example.com', '000000')).toEqual({ ok: false, error: WRONG.error.message });
  });

  test('the review account signs in with its fixed code', async () => {
    mockVerify.mockResolvedValueOnce(WRONG).mockResolvedValueOnce({ data: {}, error: null });
    mockInvoke.mockResolvedValue({ data: { ok: true, tokenHash: 'hash-123' }, error: null });

    expect(await verifyEmailOtp('Reviewer@Example.com', '482916')).toEqual({ ok: true });
    expect(mockInvoke).toHaveBeenCalledWith('connect', {
      body: { action: 'review_sign_in', email: 'reviewer@example.com', code: '482916' },
    });
    expect(mockVerify).toHaveBeenLastCalledWith({ token_hash: 'hash-123', type: 'magiclink' });
  });
});

describe('the review sign-in', () => {
  test.each([
    ['the server says no', { data: null, error: new FunctionsHttpError({ status: 400 } as Response) }],
    ['the answer has no token', { data: { ok: true }, error: null }],
    ['the token is not text', { data: { ok: true, tokenHash: 7 }, error: null }],
    ['the answer is not ok', { data: { ok: false, tokenHash: 'x' }, error: null }],
  ])('is false when %s, and nothing else is tried', async (_name, answer) => {
    mockInvoke.mockResolvedValue(answer);

    expect(await reviewSignIn('reviewer@example.com', '482916')).toBe(false);
    expect(mockVerify).not.toHaveBeenCalled();
  });

  test('is false when the token cannot be turned into a session', async () => {
    mockInvoke.mockResolvedValue({ data: { ok: true, tokenHash: 'hash' }, error: null });
    mockVerify.mockResolvedValue({ data: null, error: { message: 'expired' } });

    expect(await reviewSignIn('reviewer@example.com', '482916')).toBe(false);
  });

  test('never throws', async () => {
    mockInvoke.mockRejectedValue(new Error('offline'));

    expect(await reviewSignIn('reviewer@example.com', '482916')).toBe(false);
  });
});
