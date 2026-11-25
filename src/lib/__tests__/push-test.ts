import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import {
  configurePushHandling,
  forgetPushOnSignOut,
  isPushOn,
  refreshPush,
  SIGN_OUT_WAIT_MS,
  turnPushOff,
  turnPushOn,
} from '@/lib/push';
import { registerPushToken, unregisterPushToken } from '@/services/push-tokens';

const mockPrefs = new Map<string, string>();
const mockWriteFails = { value: false };

jest.mock('@/lib/device-prefs', () => ({
  readDevicePref: (key: string) => mockPrefs.get(key) ?? null,
  writeDevicePref: async (key: string, value: string) => {
    if (mockWriteFails.value) return false;
    mockPrefs.set(key, value);
    return true;
  },
}));
jest.mock('@/services/push-tokens', () => ({ registerPushToken: jest.fn(), unregisterPushToken: jest.fn() }));
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { extra: { eas: { projectId: 'project-1' } } } },
}));
jest.mock('expo-notifications', () => ({
  AndroidImportance: { DEFAULT: 5 },
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  getExpoPushTokenAsync: jest.fn(),
  setNotificationChannelAsync: jest.fn(async () => null),
  setNotificationHandler: jest.fn(),
}));

const mockGetPermissions = Notifications.getPermissionsAsync as jest.Mock;
const mockRequestPermissions = Notifications.requestPermissionsAsync as jest.Mock;
const mockGetToken = Notifications.getExpoPushTokenAsync as jest.Mock;
const mockChannel = Notifications.setNotificationChannelAsync as jest.Mock;
const mockHandler = Notifications.setNotificationHandler as jest.Mock;
const mockRegister = registerPushToken as jest.MockedFunction<typeof registerPushToken>;
const mockUnregister = unregisterPushToken as jest.MockedFunction<typeof unregisterPushToken>;

const TOKEN = 'ExponentPushToken[aaaaaaaaaaaaaaaaaaaaaa]';
const NEW_TOKEN = 'ExponentPushToken[bbbbbbbbbbbbbbbbbbbbbb]';

beforeEach(() => {
  mockPrefs.clear();
  mockWriteFails.value = false;
  mockGetPermissions.mockReset().mockResolvedValue({ granted: true, canAskAgain: true });
  mockRequestPermissions.mockReset().mockResolvedValue({ granted: true });
  mockGetToken.mockReset().mockResolvedValue({ data: TOKEN });
  mockChannel.mockClear();
  mockHandler.mockClear();
  mockRegister.mockReset().mockResolvedValue('saved');
  mockUnregister.mockReset().mockResolvedValue('saved');
});

afterEach(() => {
  jest.restoreAllMocks();
});

/** A person who has notifications on, on this phone. */
async function withPushOn(userId = 'user-a') {
  expect(await turnPushOn(userId, 'Notifications')).toBe('on');
  mockRegister.mockClear();
  mockUnregister.mockClear();
}

describe('turning notifications on', () => {
  test('puts this phone on the server’s list and remembers the choice, per person', async () => {
    expect(await turnPushOn('user-a', 'Notifications')).toBe('on');

    expect(mockRegister).toHaveBeenCalledWith(TOKEN, 'ios', 'user-a');
    expect(mockGetToken).toHaveBeenCalledWith({ projectId: 'project-1' });
    expect(isPushOn('user-a')).toBe(true);
    expect(isPushOn('user-b')).toBe(false);
  });

  test('is off until the person turns it on, and off for nobody', () => {
    expect(isPushOn('user-a')).toBe(false);
    expect(isPushOn(null)).toBe(false);
  });

  test('puts the phone’s own question when it has not been answered', async () => {
    mockGetPermissions.mockResolvedValue({ granted: false, canAskAgain: true });

    expect(await turnPushOn('user-a', 'Notifications')).toBe('on');
    expect(mockRequestPermissions).toHaveBeenCalledTimes(1);
  });

  test('does not ask again when the phone already allows it', async () => {
    await turnPushOn('user-a', 'Notifications');

    expect(mockRequestPermissions).not.toHaveBeenCalled();
  });

  test('is "denied" when the person says no, and nothing is sent to the server', async () => {
    mockGetPermissions.mockResolvedValue({ granted: false, canAskAgain: true });
    mockRequestPermissions.mockResolvedValue({ granted: false });

    expect(await turnPushOn('user-a', 'Notifications')).toBe('denied');
    expect(mockRegister).not.toHaveBeenCalled();
    expect(isPushOn('user-a')).toBe(false);
  });

  test('is "denied" without asking when the phone will not ask again', async () => {
    mockGetPermissions.mockResolvedValue({ granted: false, canAskAgain: false });

    expect(await turnPushOn('user-a', 'Notifications')).toBe('denied');
    expect(mockRequestPermissions).not.toHaveBeenCalled();
  });

  test.each([
    ['the phone has no push address', () => mockGetToken.mockRejectedValue(new Error('no credentials'))],
    ['the phone gives an empty address', () => mockGetToken.mockResolvedValue({ data: '' })],
    ['the server does not keep phones yet', () => mockRegister.mockResolvedValue('not_offered')],
  ])('is "unavailable" when %s', async (_name, arrange) => {
    arrange();

    expect(await turnPushOn('user-a', 'Notifications')).toBe('unavailable');
    expect(isPushOn('user-a')).toBe(false);
  });

  test('has failed, and stays off, when the server could not record the phone', async () => {
    mockRegister.mockResolvedValue('failed');

    expect(await turnPushOn('user-a', 'Notifications')).toBe('failed');
    expect(isPushOn('user-a')).toBe(false);
  });

  test('when the phone cannot keep the choice, the server is told to forget: the two never disagree', async () => {
    mockWriteFails.value = true;

    expect(await turnPushOn('user-a', 'Notifications')).toBe('failed');
    expect(mockUnregister).toHaveBeenCalledWith(TOKEN, 'user-a');
    expect(isPushOn('user-a')).toBe(false);
  });

  test('has failed, without throwing, when the phone’s own calls throw', async () => {
    mockGetPermissions.mockRejectedValue(new Error('boom'));

    expect(await turnPushOn('user-a', 'Notifications')).toBe('failed');
  });

  test('on Android a channel with the given name exists before the phone is asked', async () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    const order: string[] = [];
    mockChannel.mockImplementation(async () => {
      order.push('channel');
      return null;
    });
    mockGetPermissions.mockImplementation(async () => {
      order.push('permission');
      return { granted: true, canAskAgain: true };
    });

    expect(await turnPushOn('user-a', 'الإشعارات')).toBe('on');

    expect(order).toEqual(['channel', 'permission']);
    expect(mockChannel).toHaveBeenCalledWith('default', { name: 'الإشعارات', importance: 5 });
    expect(mockRegister).toHaveBeenCalledWith(TOKEN, 'android', 'user-a');
  });

  test('on iOS no channel is made', async () => {
    await turnPushOn('user-a', 'Notifications');

    expect(mockChannel).not.toHaveBeenCalled();
  });

  test('is "unavailable" on the web, and the phone is not asked', async () => {
    jest.replaceProperty(Platform, 'OS', 'web');

    expect(await turnPushOn('user-a', 'Notifications')).toBe('unavailable');
    expect(mockGetPermissions).not.toHaveBeenCalled();
  });
});

describe('turning notifications off', () => {
  test('takes this phone off the server’s list, then shows off', async () => {
    await withPushOn();

    expect(await turnPushOff('user-a')).toBe(true);

    expect(mockUnregister).toHaveBeenCalledWith(TOKEN, 'user-a');
    expect(isPushOn('user-a')).toBe(false);
  });

  test('stays on when the server could not be told: only it can stop a push arriving', async () => {
    await withPushOn();
    mockUnregister.mockResolvedValue('failed');

    expect(await turnPushOff('user-a')).toBe(false);
    expect(isPushOn('user-a')).toBe(true);
  });

  test('goes off when the server keeps no phones: there is nothing there to take off', async () => {
    await withPushOn();
    mockUnregister.mockResolvedValue('not_offered');

    expect(await turnPushOff('user-a')).toBe(true);
    expect(isPushOn('user-a')).toBe(false);
  });

  test('says so when the choice could not be kept', async () => {
    await withPushOn();
    mockWriteFails.value = true;

    expect(await turnPushOff('user-a')).toBe(false);
  });
});

describe('when the app starts or a person signs in', () => {
  test('a phone with notifications on is put on the list again', async () => {
    await withPushOn();

    await refreshPush('user-a');

    expect(mockRegister).toHaveBeenCalledWith(TOKEN, 'ios', 'user-a');
    expect(mockUnregister).not.toHaveBeenCalled();
  });

  test('nothing is sent for a person who has not turned them on', async () => {
    await refreshPush('user-a');

    expect(mockGetPermissions).not.toHaveBeenCalled();
    expect(mockRegister).not.toHaveBeenCalled();
  });

  test('the phone’s question is never put here, and nothing is sent if the phone no longer allows it', async () => {
    await withPushOn();
    mockGetPermissions.mockResolvedValue({ granted: false, canAskAgain: true });

    await refreshPush('user-a');

    expect(mockRequestPermissions).not.toHaveBeenCalled();
    expect(mockRegister).not.toHaveBeenCalled();
  });

  test('a token the phone has changed is followed: the new one goes on the list and the old one comes off', async () => {
    await withPushOn();
    mockGetToken.mockResolvedValue({ data: NEW_TOKEN });

    await refreshPush('user-a');

    expect(mockRegister).toHaveBeenCalledWith(NEW_TOKEN, 'ios', 'user-a');
    expect(mockUnregister).toHaveBeenCalledWith(TOKEN, 'user-a');

    // The new one is what is taken off at sign-out.
    mockUnregister.mockClear();
    await forgetPushOnSignOut('user-a');
    expect(mockUnregister).toHaveBeenCalledWith(NEW_TOKEN, 'user-a');
  });

  test('nothing is sent once the person is no longer the one signed in', async () => {
    await withPushOn();

    await refreshPush('user-a', () => false);

    expect(mockRegister).not.toHaveBeenCalled();
  });

  test('never throws', async () => {
    await withPushOn();
    mockGetPermissions.mockRejectedValue(new Error('boom'));

    await expect(refreshPush('user-a')).resolves.toBeUndefined();
  });
});

describe('signing out', () => {
  test('takes this phone off the list, and keeps the choice for when the person signs in again', async () => {
    await withPushOn();

    await forgetPushOnSignOut('user-a');

    expect(mockUnregister).toHaveBeenCalledWith(TOKEN, 'user-a');
    expect(isPushOn('user-a')).toBe(true);
  });

  test('sends nothing for a person who never turned them on', async () => {
    await forgetPushOnSignOut('user-a');

    expect(mockUnregister).not.toHaveBeenCalled();
  });

  test('sends nothing for a person who turned them off', async () => {
    await withPushOn();
    await turnPushOff('user-a');
    mockUnregister.mockClear();

    await forgetPushOnSignOut('user-a');

    expect(mockUnregister).not.toHaveBeenCalled();
  });

  test('does not hold signing out up: it stops waiting for a server that does not answer', async () => {
    await withPushOn();
    jest.useFakeTimers();
    try {
      mockUnregister.mockReturnValue(new Promise(() => {}));
      let done = false;
      void forgetPushOnSignOut('user-a').then(() => (done = true));

      await jest.advanceTimersByTimeAsync(SIGN_OUT_WAIT_MS - 1);
      expect(done).toBe(false);

      await jest.advanceTimersByTimeAsync(1);
      expect(done).toBe(true);
    } finally {
      jest.useRealTimers();
    }
  });

  test('never throws, and leaves no timer running', async () => {
    await withPushOn();
    jest.useFakeTimers();
    try {
      mockUnregister.mockRejectedValue(new Error('boom'));

      await expect(forgetPushOnSignOut('user-a')).resolves.toBeUndefined();
      expect(jest.getTimerCount()).toBe(0);
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('a notification that arrives while the app is open', () => {
  test('is shown quietly: a banner and the list, no sound, no badge', async () => {
    configurePushHandling();

    const { handleNotification } = mockHandler.mock.calls[0][0];
    expect(await handleNotification()).toEqual({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    });
  });

  test('nothing is set up on the web', () => {
    jest.replaceProperty(Platform, 'OS', 'web');

    configurePushHandling();

    expect(mockHandler).not.toHaveBeenCalled();
  });
});
