import { FunctionsHttpError } from '@supabase/supabase-js';

import { assertSupabaseConfigured } from '@/lib/env';
import { readServerConsent, writeServerConsent } from '@/services/ai-consent-server';

const mockInvoke = jest.fn();
const mockSession = { userId: 'user-a' as string | null };

jest.mock('@/lib/supabase', () => ({
  supabase: {
    functions: { invoke: (...args: unknown[]) => mockInvoke(...args) },
    auth: {
      getSession: async () => ({
        data: { session: mockSession.userId ? { user: { id: mockSession.userId } } : null },
      }),
    },
  },
}));
jest.mock('@/lib/env', () => ({ assertSupabaseConfigured: jest.fn() }));

beforeEach(() => {
  mockInvoke.mockReset();
  mockSession.userId = 'user-a';
});

function answer(data: unknown) {
  mockInvoke.mockResolvedValue({ data, error: null });
}

function httpError(status: number) {
  mockInvoke.mockResolvedValue({ data: null, error: new FunctionsHttpError({ status } as Response) });
}

describe('readServerConsent', () => {
  test('asks for the status and sends no user id', async () => {
    answer({ ok: true, granted: false });

    await readServerConsent('user-a');

    expect(mockInvoke).toHaveBeenCalledWith('connect', { body: { action: 'consent_status' } });
  });

  test('reports an agreement with its wording', async () => {
    answer({ ok: true, granted: true, version: 'v1', grantedAt: '2026-11-26T10:00:00Z', withdrawnAt: null });

    expect(await readServerConsent('user-a')).toEqual({ known: true, granted: true, version: 'v1', withdrawn: false });
  });

  test('tells a withdrawal apart from never having been asked', async () => {
    answer({ ok: true, granted: false, version: null, withdrawnAt: '2026-11-27T10:00:00Z' });
    expect(await readServerConsent('user-a')).toEqual({ known: true, granted: false, version: null, withdrawn: true });

    answer({ ok: true, granted: false, version: null, withdrawnAt: null });
    expect(await readServerConsent('user-a')).toEqual({ known: true, granted: false, version: null, withdrawn: false });
  });

  test('gives no wording for an agreement that does not stand', async () => {
    answer({ ok: true, granted: false, version: 'v1', withdrawnAt: '2026-11-27T10:00:00Z' });

    expect(await readServerConsent('user-a')).toMatchObject({ granted: false, version: null });
  });

  test.each([
    ['the server has no such function', () => httpError(404)],
    ['the server has a fault', () => httpError(500)],
    ['the request could not be sent', () => mockInvoke.mockResolvedValue({ data: null, error: new Error('offline') })],
    ['the call itself throws', () => mockInvoke.mockRejectedValue(new Error('offline'))],
    ['the answer is not readable', () => answer({ ok: true, granted: 'yes' })],
    ['the answer is a refusal', () => answer({ ok: false, error: 'unauthorized' })],
  ])('knows nothing when %s, and does not throw', async (_name, arrange) => {
    arrange();

    expect(await readServerConsent('user-a')).toEqual({ known: false });
  });

  test('knows nothing when the app has no server settings', async () => {
    (assertSupabaseConfigured as jest.Mock).mockImplementationOnce(() => {
      throw new Error('supabase_not_configured');
    });

    expect(await readServerConsent('user-a')).toEqual({ known: false });
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  test.each([['another person', 'user-b'], ['no one', null]])(
    'asks nothing when %s is signed in: the answer would be about someone else',
    async (_name, signedIn) => {
      mockSession.userId = signedIn;

      expect(await readServerConsent('user-a')).toEqual({ known: false });
      expect(mockInvoke).not.toHaveBeenCalled();
    },
  );
});

describe('writeServerConsent', () => {
  test('sends the wording with an agreement', async () => {
    answer({ ok: true, granted: true, version: 'v1' });

    expect(await writeServerConsent(true, 'v1', 'user-a')).toBe('saved');
    expect(mockInvoke).toHaveBeenCalledWith('connect', { body: { action: 'consent_grant', version: 'v1' } });
  });

  test('sends a withdrawal with nothing else', async () => {
    answer({ ok: true, granted: false });

    expect(await writeServerConsent(false, 'v1', 'user-a')).toBe('saved');
    expect(mockInvoke).toHaveBeenCalledWith('connect', { body: { action: 'consent_withdraw' } });
  });

  test('is "not offered" when the server keeps no such record yet', async () => {
    httpError(404);

    expect(await writeServerConsent(true, 'v1', 'user-a')).toBe('not_offered');
  });

  test.each([
    ['the server has a fault', () => httpError(500)],
    ['the server refuses', () => httpError(403)],
    ['the request could not be sent', () => mockInvoke.mockResolvedValue({ data: null, error: new Error('offline') })],
    ['the call itself throws', () => mockInvoke.mockRejectedValue(new Error('offline'))],
    ['the answer is not readable', () => answer({ ok: true })],
  ])('fails when %s', async (_name, arrange) => {
    arrange();

    expect(await writeServerConsent(true, 'v1', 'user-a')).toBe('failed');
  });

  test('fails when the server confirms the opposite of what was sent', async () => {
    answer({ ok: true, granted: true });

    expect(await writeServerConsent(false, 'v1', 'user-a')).toBe('failed');
  });

  test.each([['another person', 'user-b'], ['no one', null]])(
    'sends nothing when %s is signed in: an agreement must never be recorded for someone else',
    async (_name, signedIn) => {
      mockSession.userId = signedIn;

      expect(await writeServerConsent(true, 'v1', 'user-a')).toBe('failed');
      expect(mockInvoke).not.toHaveBeenCalled();
    },
  );
});
