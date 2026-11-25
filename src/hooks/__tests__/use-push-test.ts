import { act, renderHook } from '@testing-library/react-native';
import * as Notifications from 'expo-notifications';

import { usePush } from '@/hooks/use-push';
import { refreshPush } from '@/lib/push';

const mockPush = jest.fn();
const mockRouter = { push: mockPush };

jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));
jest.mock('@/lib/push', () => ({ refreshPush: jest.fn(async () => {}) }));
jest.mock('expo-notifications', () => ({
  getLastNotificationResponse: jest.fn(),
  clearLastNotificationResponse: jest.fn(),
  addNotificationResponseReceivedListener: jest.fn(),
}));

const mockRefresh = refreshPush as jest.MockedFunction<typeof refreshPush>;
const mockLast = Notifications.getLastNotificationResponse as jest.Mock;
const mockClear = Notifications.clearLastNotificationResponse as jest.Mock;
const mockListen = Notifications.addNotificationResponseReceivedListener as jest.Mock;

let tap: (response: unknown) => void;
const remove = jest.fn();

/** A tap on a notification that tries to send the app somewhere of its own choosing. */
const HOSTILE_TAP = {
  notification: { request: { content: { data: { url: 'https://example.com/steal', route: '/delete-account', notificationId: 'x' } } } },
};

beforeEach(() => {
  mockPush.mockClear();
  mockRefresh.mockClear();
  mockLast.mockReset().mockReturnValue(null);
  mockClear.mockClear();
  remove.mockClear();
  mockListen.mockReset().mockImplementation((listener: (response: unknown) => void) => {
    tap = listener;
    return { remove };
  });
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
  });

  test('is not done with nobody signed in', async () => {
    await start({ userId: null, ready: true });

    expect(mockRefresh).not.toHaveBeenCalled();
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

describe('a tap on a notification', () => {
  test('opens the app’s own list of notifications', async () => {
    await start({ userId: 'user-a', ready: true });

    await act(async () => tap(HOSTILE_TAP));

    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith('/notifications');
  });

  test('never follows anything the notification carries', async () => {
    await start({ userId: 'user-a', ready: true });

    await act(async () => tap(HOSTILE_TAP));

    const routes = mockPush.mock.calls.map(([route]) => route);
    expect(routes).toEqual(['/notifications']);
  });

  test('the tap that opened the app is answered once the app is ready, and only once', async () => {
    mockLast.mockReturnValue(HOSTILE_TAP);
    const { rerender } = await start({ userId: 'user-a', ready: false });
    expect(mockPush).not.toHaveBeenCalled();

    mockLast.mockImplementation(() => (mockClear.mock.calls.length ? null : HOSTILE_TAP));
    await rerender({ userId: 'user-a', ready: true });
    expect(mockPush).toHaveBeenCalledTimes(1);

    // Signing out and in again must not answer the same tap a second time.
    await rerender({ userId: null, ready: true });
    await rerender({ userId: 'user-a', ready: true });
    expect(mockPush).toHaveBeenCalledTimes(1);
  });

  test('is not listened for with nobody signed in', async () => {
    mockLast.mockReturnValue(HOSTILE_TAP);

    await start({ userId: null, ready: true });

    expect(mockListen).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });

  test('stops being listened for when the person signs out', async () => {
    const { rerender } = await start({ userId: 'user-a', ready: true });

    await rerender({ userId: null, ready: true });

    expect(remove).toHaveBeenCalledTimes(1);
  });
});
