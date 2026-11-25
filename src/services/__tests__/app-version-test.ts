import { FunctionsHttpError } from '@supabase/supabase-js';

import { ANSWER_TIMEOUT_MS, checkUpdateRequired } from '@/services/app-version';

const mockInvoke = jest.fn();
const mockConfigured = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: { functions: { invoke: (...args: unknown[]) => mockInvoke(...args) } },
}));
jest.mock('@/lib/env', () => ({ assertSupabaseConfigured: () => mockConfigured() }));
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { version: '1.0.0', android: { package: 'com.mizan.client' } } },
}));

const IOS_STORE = 'https://apps.apple.com/app/id123456789';

function serverSays(answer: unknown) {
  mockInvoke.mockResolvedValue({ data: answer, error: null });
}

beforeEach(() => {
  mockInvoke.mockReset();
  mockConfigured.mockReset();
});

describe('asking the server whether this version may still be used', () => {
  test('asks for this phone’s platform, and sends nothing about the person', async () => {
    serverSays({ ok: true, minVersion: null, storeUrl: null });

    await checkUpdateRequired('android', '1.0.0');

    expect(mockInvoke).toHaveBeenCalledWith('app-version', { body: { platform: 'android' } });
  });

  test('an update is required when this version is older than the minimum', async () => {
    serverSays({ ok: true, minVersion: '1.2.0', storeUrl: IOS_STORE });

    expect(await checkUpdateRequired('ios', '1.1.9')).toEqual({ status: 'required', storeUrl: IOS_STORE });
  });

  test('uses the app’s own version when none is given', async () => {
    serverSays({ ok: true, minVersion: '1.0.1', storeUrl: IOS_STORE });

    expect((await checkUpdateRequired('ios')).status).toBe('required');
  });

  test.each([
    ['this version is the minimum', '1.2.0'],
    ['this version is newer', '1.3.0'],
  ])('carries on when %s', async (_name, current) => {
    serverSays({ ok: true, minVersion: '1.2.0', storeUrl: IOS_STORE });

    expect(await checkUpdateRequired('ios', current)).toEqual({ status: 'current' });
  });

  test.each([
    ['sets no minimum', { ok: true, minVersion: null, storeUrl: null }],
    ['leaves the minimum out', { ok: true }],
    ['gives a minimum that is not a version', { ok: true, minVersion: 'latest', storeUrl: IOS_STORE }],
  ])('carries on when the server %s', async (_name, answer) => {
    serverSays(answer);

    expect(await checkUpdateRequired('ios', '1.0.0')).toEqual({ status: 'current' });
  });

  test('carries on when this app’s own version cannot be read', async () => {
    serverSays({ ok: true, minVersion: '9.0.0', storeUrl: IOS_STORE });

    expect(await checkUpdateRequired('ios', null)).toEqual({ status: 'current' });
  });

  test('drops a store link that is not the store’s own, and still requires the update', async () => {
    serverSays({ ok: true, minVersion: '2.0.0', storeUrl: 'https://example.com/get-the-app' });

    expect(await checkUpdateRequired('ios', '1.0.0')).toEqual({ status: 'required', storeUrl: null });
  });

  test.each([
    ['is very long', `https://example.com/${'x'.repeat(5_000)}`],
    ['is not text', 42],
    ['is a list', ['https://apps.apple.com/app/id123456789']],
  ])('still requires the update when the store link %s: a bad link does not hide a clear minimum', async (_name, storeUrl) => {
    serverSays({ ok: true, minVersion: '2.0.0', storeUrl });

    expect(await checkUpdateRequired('ios', '1.0.0')).toEqual({ status: 'required', storeUrl: null });
  });

  test('carries on when the minimum is not text', async () => {
    serverSays({ ok: true, minVersion: 2, storeUrl: IOS_STORE });

    expect(await checkUpdateRequired('ios', '1.0.0')).toEqual({ status: 'current' });
  });

  test('drops the other platform’s store link', async () => {
    serverSays({ ok: true, minVersion: '2.0.0', storeUrl: IOS_STORE });

    expect(await checkUpdateRequired('android', '1.0.0')).toEqual({ status: 'required', storeUrl: null });
  });

  test('the web build is never asked to update, and the server is not asked', async () => {
    expect(await checkUpdateRequired('web', '1.0.0')).toEqual({ status: 'current' });
    expect(mockInvoke).not.toHaveBeenCalled();
  });
});

describe('when the server gives no clear answer', () => {
  test.each([
    ['the function is not there yet', { data: null, error: new FunctionsHttpError({ status: 404 } as Response) }],
    ['the server fails', { data: null, error: new FunctionsHttpError({ status: 500 } as Response) }],
    ['the phone is offline', { data: null, error: new Error('Network request failed') }],
    ['the answer is not what was asked for', { data: { ok: false, error: 'platform must be ios or android' }, error: null }],
    ['the answer is not an answer at all', { data: '<html>', error: null }],
  ])('nothing is known when %s, and the app is not blocked', async (_name, result) => {
    mockInvoke.mockResolvedValue(result);

    expect(await checkUpdateRequired('ios', '0.0.1')).toEqual({ status: 'unknown' });
  });

  test('nothing is known when the server never answers: the wait ends, so the next try can be made', async () => {
    jest.useFakeTimers();
    try {
      mockInvoke.mockReturnValue(new Promise(() => {}));
      let answer: unknown = 'still waiting';
      void checkUpdateRequired('ios', '0.0.1').then((check) => (answer = check));

      await jest.advanceTimersByTimeAsync(ANSWER_TIMEOUT_MS - 1);
      expect(answer).toBe('still waiting');

      await jest.advanceTimersByTimeAsync(1);
      expect(answer).toEqual({ status: 'unknown' });
    } finally {
      jest.useRealTimers();
    }
  });

  test('an answer in time leaves no timer running', async () => {
    jest.useFakeTimers();
    try {
      serverSays({ ok: true, minVersion: null, storeUrl: null });

      await checkUpdateRequired('ios', '1.0.0');

      expect(jest.getTimerCount()).toBe(0);
    } finally {
      jest.useRealTimers();
    }
  });

  test('nothing is known when asking throws', async () => {
    mockInvoke.mockRejectedValue(new Error('boom'));

    expect(await checkUpdateRequired('ios', '0.0.1')).toEqual({ status: 'unknown' });
  });

  test('nothing is known when the app has no server configured, and none is asked', async () => {
    mockConfigured.mockImplementation(() => {
      throw new Error('Supabase is not configured.');
    });

    expect(await checkUpdateRequired('ios', '0.0.1')).toEqual({ status: 'unknown' });
    expect(mockInvoke).not.toHaveBeenCalled();
  });
});
