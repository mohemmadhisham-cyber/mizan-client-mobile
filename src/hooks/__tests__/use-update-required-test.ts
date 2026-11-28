import { act, renderHook } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';

import { RECHECK_AFTER_MS, useUpdateRequired } from '@/hooks/use-update-required';
import { checkUpdateRequired, type UpdateCheck } from '@/services/app-version';

jest.mock('@/services/app-version', () => ({ checkUpdateRequired: jest.fn() }));

const mockCheck = checkUpdateRequired as jest.MockedFunction<typeof checkUpdateRequired>;
const STORE = 'https://apps.apple.com/app/id123456789';

let appStateListener: (state: AppStateStatus) => void;
let now: number;

beforeEach(() => {
  mockCheck.mockReset().mockResolvedValue({ status: 'current' });
  now = 1_000_000;
  jest.spyOn(Date, 'now').mockImplementation(() => now);
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener) => {
    appStateListener = listener as (state: AppStateStatus) => void;
    return { remove: jest.fn() } as unknown as ReturnType<typeof AppState.addEventListener>;
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

const comesBack = () => act(async () => appStateListener('active'));

describe('whether the app must be updated', () => {
  test('the server is asked once when the app starts', async () => {
    const { result } = await renderHook(() => useUpdateRequired());

    expect(mockCheck).toHaveBeenCalledTimes(1);
    expect(result.current).toBeNull();
  });

  test('a version that is too old is blocked, with the store page to open', async () => {
    mockCheck.mockResolvedValue({ status: 'required', storeUrl: STORE });

    const { result } = await renderHook(() => useUpdateRequired());

    expect(result.current).toEqual({ storeUrl: STORE });
  });

  test('no answer does not block the app', async () => {
    mockCheck.mockResolvedValue({ status: 'unknown' });

    const { result } = await renderHook(() => useUpdateRequired());

    expect(result.current).toBeNull();
  });

  test('a failure to ask does not block the app', async () => {
    mockCheck.mockRejectedValue(new Error('boom'));

    const { result } = await renderHook(() => useUpdateRequired());

    expect(result.current).toBeNull();
  });
});

describe('asking again', () => {
  test('after no answer, the server is asked again the next time the app comes into view', async () => {
    mockCheck.mockResolvedValue({ status: 'unknown' });
    const { result } = await renderHook(() => useUpdateRequired());

    mockCheck.mockResolvedValue({ status: 'required', storeUrl: null });
    await comesBack();

    expect(mockCheck).toHaveBeenCalledTimes(2);
    expect(result.current).toEqual({ storeUrl: null });
  });

  test('after a clear answer, it is not asked again each time the app comes into view', async () => {
    await renderHook(() => useUpdateRequired());

    now += RECHECK_AFTER_MS - 1;
    await comesBack();
    await comesBack();

    expect(mockCheck).toHaveBeenCalledTimes(1);
  });

  test('after a clear answer has stood long enough, it is asked again', async () => {
    const { result } = await renderHook(() => useUpdateRequired());

    now += RECHECK_AFTER_MS;
    mockCheck.mockResolvedValue({ status: 'required', storeUrl: STORE });
    await comesBack();

    expect(mockCheck).toHaveBeenCalledTimes(2);
    expect(result.current).toEqual({ storeUrl: STORE });
  });

  test('going out of view asks nothing', async () => {
    mockCheck.mockResolvedValue({ status: 'unknown' });
    await renderHook(() => useUpdateRequired());

    await act(async () => appStateListener('background'));
    await act(async () => appStateListener('inactive'));

    expect(mockCheck).toHaveBeenCalledTimes(1);
  });

  test('one question is out at a time', async () => {
    let answer: (check: UpdateCheck) => void = () => {};
    mockCheck.mockImplementation(() => new Promise<UpdateCheck>((resolve) => (answer = resolve)));
    await renderHook(() => useUpdateRequired());

    await comesBack();
    await comesBack();

    expect(mockCheck).toHaveBeenCalledTimes(1);
    await act(async () => answer({ status: 'current' }));
  });

  test('once the app is too old, a later "fine" does not open it again', async () => {
    mockCheck.mockResolvedValue({ status: 'required', storeUrl: STORE });
    const { result } = await renderHook(() => useUpdateRequired());

    now += RECHECK_AFTER_MS;
    mockCheck.mockResolvedValue({ status: 'current' });
    await comesBack();

    expect(result.current).toEqual({ storeUrl: STORE });
  });
});
