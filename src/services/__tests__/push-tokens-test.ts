import { FunctionsHttpError } from '@supabase/supabase-js';

import { forgetPushToken, registerPushToken } from '@/services/push-tokens';

const mockInvoke = jest.fn();
const mockSession = { userId: 'user-a' as string | null };
const mockConfigured = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: {
    functions: { invoke: (...args: unknown[]) => mockInvoke(...args) },
    auth: {
      getSession: async () => ({ data: { session: mockSession.userId ? { user: { id: mockSession.userId } } : null } }),
    },
  },
}));
jest.mock('@/lib/env', () => ({ assertSupabaseConfigured: () => mockConfigured() }));

const TOKEN = 'ExponentPushToken[aaaaaaaaaaaaaaaaaaaaaa]';
const notThere = { data: null, error: new FunctionsHttpError({ status: 404 } as Response) };

beforeEach(() => {
  mockInvoke.mockReset().mockResolvedValue({ data: { ok: true, registered: true }, error: null });
  mockConfigured.mockReset();
  mockSession.userId = 'user-a';
});

describe('putting this phone on the server’s list', () => {
  test('sends the token and the platform, and no user id: the server takes the person from the session', async () => {
    expect(await registerPushToken(TOKEN, 'ios', 'user-a')).toBe('saved');

    expect(mockInvoke).toHaveBeenCalledWith('connect', { body: { action: 'push_register', token: TOKEN, platform: 'ios' } });
  });

  test('is not sent when another person has signed in since: it would register the phone for them', async () => {
    mockSession.userId = 'user-b';

    expect(await registerPushToken(TOKEN, 'ios', 'user-a')).toBe('failed');
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  test('is not sent with nobody signed in', async () => {
    mockSession.userId = null;

    expect(await registerPushToken(TOKEN, 'android', 'user-a')).toBe('failed');
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  test('is "not offered" when the server does not keep phones yet', async () => {
    mockInvoke.mockResolvedValue(notThere);

    expect(await registerPushToken(TOKEN, 'ios', 'user-a')).toBe('not_offered');
  });

  test.each([
    ['the server fails', { data: null, error: new FunctionsHttpError({ status: 500 } as Response) }],
    ['the server refuses the token', { data: null, error: new FunctionsHttpError({ status: 400 } as Response) }],
    ['the phone is offline', { data: null, error: new Error('Network request failed') }],
    ['the answer says it is not registered', { data: { ok: true, registered: false }, error: null }],
    ['the answer is not an answer', { data: '<html>', error: null }],
  ])('has failed when %s', async (_name, result) => {
    mockInvoke.mockResolvedValue(result);

    expect(await registerPushToken(TOKEN, 'ios', 'user-a')).toBe('failed');
  });

  test('has failed, without throwing, when asking throws or the app has no server', async () => {
    mockInvoke.mockRejectedValue(new Error('boom'));
    expect(await registerPushToken(TOKEN, 'ios', 'user-a')).toBe('failed');

    mockConfigured.mockImplementation(() => {
      throw new Error('Supabase is not configured.');
    });
    expect(await registerPushToken(TOKEN, 'ios', 'user-a')).toBe('failed');
  });
});

describe('taking this phone off the list', () => {
  beforeEach(() => {
    mockInvoke.mockResolvedValue({ data: { ok: true, registered: false }, error: null });
  });

  test('sends the token only', async () => {
    expect(await forgetPushToken(TOKEN)).toBe('saved');

    expect(mockInvoke).toHaveBeenCalledWith('connect', { body: { action: 'push_forget', token: TOKEN } });
  });

  test.each([
    ['nobody is signed in', null],
    ['another person is signed in', 'user-b'],
  ])('is sent when %s: a phone must be able to come off the list after its session has gone', async (_name, userId) => {
    mockSession.userId = userId;

    expect(await forgetPushToken(TOKEN)).toBe('saved');
    expect(mockInvoke).toHaveBeenCalledTimes(1);
  });

  test('has failed when the answer says the phone is still on the list', async () => {
    mockInvoke.mockResolvedValue({ data: { ok: true, registered: true }, error: null });

    expect(await forgetPushToken(TOKEN)).toBe('failed');
  });

  test('is "not offered" when the server does not keep phones yet', async () => {
    mockInvoke.mockResolvedValue(notThere);

    expect(await forgetPushToken(TOKEN)).toBe('not_offered');
  });

  test('has failed, without throwing, when the phone is offline or asking throws', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: new Error('Network request failed') });
    expect(await forgetPushToken(TOKEN)).toBe('failed');

    mockInvoke.mockRejectedValue(new Error('boom'));
    expect(await forgetPushToken(TOKEN)).toBe('failed');
  });
});
