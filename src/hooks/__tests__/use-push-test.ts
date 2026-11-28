import { act, renderHook } from '@testing-library/react-native';
import * as Notifications from 'expo-notifications';
import { AppState, type AppStateStatus } from 'react-native';

import { usePush } from '@/hooks/use-push';
import { flushForgottenPush, forgetPushWhenSignedOut, refreshPush, setPushViewer } from '@/lib/push';

const mockNavigate = jest.fn();
const mockRouter = { navigate: mockNavigate };

jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));
jest.mock('@/lib/push', () => ({
  refreshPush: jest.fn(async () => {}),
  forgetPushWhenSignedOut: jest.fn(async () => {}),
  flushForgottenPush: jest.fn(async () => {}),
  setPushViewer: jest.fn(),
}));
jest.mock('expo-notifications', () => ({
  getLastNotificationResponse: jest.fn(),
  clearLastNotificationResponse: jest.fn(),
  addNotificationResponseReceivedListener: jest.fn(),
}));

const mockRefresh = refreshPush as jest.MockedFunction<typeof refreshPush>;
const mockForgetFor = forgetPushWhenSignedOut as jest.MockedFunction<typeof forgetPushWhenSignedOut>;
const mockFlush = flushForgottenPush as jest.MockedFunction<typeof flushForgottenPush>;
const mockViewer = setPushViewer as jest.MockedFunction<typeof setPushViewer>;
const mockLast = Notifications.getLastNotificationResponse as jest.Mock;
const mockClear = Notifications.clearLastNotificationResponse as jest.Mock;
const mockListen = Notifications.addNotificationResponseReceivedListener as jest.Mock;

let tap: (response: unknown) => void;
let appStateListener: (state: AppStateStatus) => void;
const remove = jest.fn();

/** A tap on a notification that tries to send the app somewhere of its own choosing. */
const HOSTILE_TAP = {
  notification: { request: { content: { data: { url: 'https://example.com/steal', route: '/delete-account', notificationId: 'x' } } } },
};

beforeEach(() => {
  mockNavigate.mockClear();
  mockRefresh.mockClear();
  mockForgetFor.mockClear();
  mockFlush.mockClear();
  mockViewer.mockClear();
  mockLast.mockReset().mockReturnValue(null);
  mockClear.mockClear();
  remove.mockClear();
  mockListen.mockReset().mockImplementation((listener: (response: unknown) => void) => {
    tap = listener;
    return { remove };
  });
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener) => {
    appStateListener = listener as (state: AppStateStatus) => void;
    return { remove: jest.fn() } as unknown as ReturnType<typeof AppState.addEventListener>;
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

interface Props {
  userId: string | null;
  ready: boolean;
}

const start = (props: Props) => renderHook((p: Props) => usePush(p.userId, p.ready), { initialProps: props });

describe('keeping this phone on the list', () => {
  test('is done when a person is signed in', async () => {
    await start({ userId: 'user-a', ready: true });

    expect(mockRefresh).toHaveBeenCalledTimes(1);
    expect(mockRefresh.mock.calls[0][0]).toBe('user-a');
    expect(mockViewer).toHaveBeenLastCalledWith('user-a');
  });

  test('is not done with nobody signed in', async () => {
    await start({ userId: null, ready: true });

    expect(mockRefresh).not.toHaveBeenCalled();
    expect(mockViewer).toHaveBeenLastCalledWith(null);
  });

  test('is done again for the next person, and the first person’s is told it is no longer current', async () => {
    const { rerender } = await start({ userId: 'user-a', ready: true });
    const firstIsCurrent = mockRefresh.mock.calls[0][1] as () => boolean;
    expect(firstIsCurrent()).toBe(true);

    await rerender({ userId: 'user-b', ready: true });

    expect(firstIsCurrent()).toBe(false);
    expect(mockRefresh).toHaveBeenLastCalledWith('user-b', expect.any(Function));
  });
});

describe('taking this phone off the list', () => {
  test('is done when the person stops being signed in, however that came about', async () => {
    const { rerender } = await start({ userId: 'user-a', ready: true });
    expect(mockForgetFor).not.toHaveBeenCalled();

    // Signed out, signed out everywhere, or the session ended on its own: all look like this from here.
    await rerender({ userId: null, ready: true });

    expect(mockForgetFor).toHaveBeenCalledTimes(1);
    expect(mockForgetFor).toHaveBeenCalledWith('user-a');
  });

  test('is done for the first person when another signs in straight after', async () => {
    const { rerender } = await start({ userId: 'user-a', ready: true });

    await rerender({ userId: 'user-b', ready: true });

    expect(mockForgetFor).toHaveBeenCalledWith('user-a');
    expect(mockForgetFor).not.toHaveBeenCalledWith('user-b');
  });

  test('is not done while the same person stays signed in', async () => {
    const { rerender } = await start({ userId: 'user-a', ready: false });

    await rerender({ userId: 'user-a', ready: true });

    expect(mockForgetFor).not.toHaveBeenCalled();
  });

  test('anything still to be forgotten is tried when nobody is signed in, and whenever the app comes back into view', async () => {
    await start({ userId: null, ready: true });
    expect(mockFlush).toHaveBeenCalledTimes(1);

    await act(async () => appStateListener('background'));
    expect(mockFlush).toHaveBeenCalledTimes(1);

    await act(async () => appStateListener('active'));
    expect(mockFlush).toHaveBeenCalledTimes(2);
  });
});

describe('a tap on a notification', () => {
  test('opens the app’s own list of notifications, and nothing the notification carries', async () => {
    await start({ userId: 'user-a', ready: true });

    await act(async () => tap(HOSTILE_TAP));

    const routes = mockNavigate.mock.calls.map(([route]) => route);
    expect(routes).toEqual(['/notifications']);
  });

  test('the tap that opened the app is answered once the app is ready, and only once', async () => {
    mockLast.mockReturnValue(HOSTILE_TAP);
    const { rerender } = await start({ userId: 'user-a', ready: false });
    expect(mockNavigate).not.toHaveBeenCalled();

    // The phone forgets the tap when told to, as the real one does.
    mockLast.mockImplementation(() => (mockClear.mock.calls.length ? null : HOSTILE_TAP));
    await rerender({ userId: 'user-a', ready: true });
    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockClear).toHaveBeenCalled();

    await rerender({ userId: null, ready: true });
    await rerender({ userId: 'user-a', ready: true });
    expect(mockNavigate).toHaveBeenCalledTimes(1);
  });

  test('a tap made while nobody was signed in is dropped, not kept for whoever signs in next', async () => {
    mockLast.mockReturnValue(HOSTILE_TAP);

    await start({ userId: null, ready: true });

    expect(mockClear).toHaveBeenCalledTimes(1);
    expect(mockListen).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  test('stops being listened for when the person signs out', async () => {
    const { rerender } = await start({ userId: 'user-a', ready: true });

    await rerender({ userId: null, ready: true });

    expect(remove).toHaveBeenCalledTimes(1);
  });
});
