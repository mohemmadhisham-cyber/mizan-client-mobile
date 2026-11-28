import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import {
  configurePushHandling,
  flushForgottenPush,
  forgetPushWhenSignedOut,
  isPushOn,
  isPushWorking,
  refreshPush,
  setPushViewer,
  turnPushOff,
  turnPushOn,
} from '@/lib/push';
import { forgetPushToken, registerPushToken, type PushWrite } from '@/services/push-tokens';

const mockPrefs = new Map<string, string>();
const mockWriteFailsFor = { key: null as string | null };
const mockConfig: { extra: { eas?: { projectId?: string } } } = { extra: { eas: { projectId: 'project-1' } } };

jest.mock('@/lib/device-prefs', () => ({
  readDevicePref: (key: string) => mockPrefs.get(key) ?? null,
  writeDevicePref: async (key: string, value: string) => {
    if (mockWriteFailsFor.key !== null && key.startsWith(mockWriteFailsFor.key)) return false;
    mockPrefs.set(key, value);
    return true;
  },
}));
jest.mock('@/services/push-tokens', () => ({ registerPushToken: jest.fn(), forgetPushToken: jest.fn() }));
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    get expoConfig() {
      return mockConfig;
    },
  },
}));
jest.mock('expo-notifications', () => ({
  AndroidImportance: { DEFAULT: 5 },
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  getExpoPushTokenAsync: jest.fn(),
  setNotificationChannelAsync: jest.fn(async () => null),
  setNotificationHandler: jest.fn(),
  dismissAllNotificationsAsync: jest.fn(async () => {}),
}));

const mockGetPermissions = Notifications.getPermissionsAsync as jest.Mock;
const mockRequestPermissions = Notifications.requestPermissionsAsync as jest.Mock;
const mockGetToken = Notifications.getExpoPushTokenAsync as jest.Mock;
const mockChannel = Notifications.setNotificationChannelAsync as jest.Mock;
const mockHandler = Notifications.setNotificationHandler as jest.Mock;
const mockDismiss = Notifications.dismissAllNotificationsAsync as jest.Mock;
const mockRegister = registerPushToken as jest.MockedFunction<typeof registerPushToken>;
const mockForget = forgetPushToken as jest.MockedFunction<typeof forgetPushToken>;

const TOKEN = 'ExponentPushToken[aaaaaaaaaaaaaaaaaaaaaa]';
const NEW_TOKEN = 'ExponentPushToken[bbbbbbbbbbbbbbbbbbbbbb]';

beforeEach(() => {
  mockPrefs.clear();
  mockWriteFailsFor.key = null;
  mockConfig.extra = { eas: { projectId: 'project-1' } };
  mockGetPermissions.mockReset().mockResolvedValue({ granted: true, canAskAgain: true });
  mockRequestPermissions.mockReset().mockResolvedValue({ granted: true });
  mockGetToken.mockReset().mockResolvedValue({ data: TOKEN });
  mockChannel.mockClear();
  mockHandler.mockClear();
  mockDismiss.mockClear();
  mockRegister.mockReset().mockResolvedValue('saved');
  mockForget.mockReset().mockResolvedValue('saved');
  setPushViewer(null);
});

afterEach(() => {
  jest.restoreAllMocks();
});

/** A person who has notifications on, on this phone. */
async function withPushOn(userId = 'user-a') {
  expect(await turnPushOn(userId, 'Notifications')).toBe('on');
  mockRegister.mockClear();
  mockForget.mockClear();
}

/** The tokens the server has still to be told to forget. */
const stillToForget = () => (mockPrefs.get('push_forget_pending') ?? '').split('\n').filter(Boolean);

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

  test('is "unavailable" in a build with no push set up', async () => {
    mockConfig.extra = {};

    expect(await turnPushOn('user-a', 'Notifications')).toBe('unavailable');
    expect(mockGetToken).not.toHaveBeenCalled();
  });

  test('is "unavailable" when the server does not keep phones yet', async () => {
    mockRegister.mockResolvedValue('not_offered');

    expect(await turnPushOn('user-a', 'Notifications')).toBe('unavailable');
    expect(isPushOn('user-a')).toBe(false);
  });

  test.each([
    ['the phone could not get its push address just now', () => mockGetToken.mockRejectedValue(new Error('network'))],
    ['the phone gives an empty address', () => mockGetToken.mockResolvedValue({ data: '' })],
    ['the server could not record the phone', () => mockRegister.mockResolvedValue('failed')],
    ['the phone’s own calls throw', () => mockGetPermissions.mockRejectedValue(new Error('boom'))],
  ])('has failed, and stays off, when %s', async (_name, arrange) => {
    arrange();

    expect(await turnPushOn('user-a', 'Notifications')).toBe('failed');
    expect(isPushOn('user-a')).toBe(false);
  });

  test('when the phone cannot keep the choice, the server is told to forget: the two never disagree', async () => {
    mockWriteFailsFor.key = 'push.';

    expect(await turnPushOn('user-a', 'Notifications')).toBe('failed');
    expect(mockForget).toHaveBeenCalledWith(TOKEN);
    expect(isPushOn('user-a')).toBe(false);
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

    expect(mockForget).toHaveBeenCalledWith(TOKEN);
    expect(isPushOn('user-a')).toBe(false);
    expect(stillToForget()).toEqual([]);
  });

  test.each<[string, PushWrite]>([
    ['could not be reached', 'failed'],
    ['answers as if it kept no phones, when this phone was put on its list', 'not_offered'],
  ])('stays on when the server %s: only it can stop a push arriving', async (_name, answer) => {
    await withPushOn();
    mockForget.mockResolvedValue(answer);

    expect(await turnPushOff('user-a')).toBe(false);
    expect(isPushOn('user-a')).toBe(true);
  });

  test('says so when the choice could not be kept', async () => {
    await withPushOn();
    mockWriteFailsFor.key = 'push.user-a';

    expect(await turnPushOff('user-a')).toBe(false);
  });

  test('once off, there is nothing left to take off at sign-out', async () => {
    await withPushOn();
    await turnPushOff('user-a');
    mockForget.mockClear();

    await forgetPushWhenSignedOut('user-a');

    expect(mockForget).not.toHaveBeenCalled();
  });
});

describe('when the app starts or a person signs in', () => {
  test('a phone with notifications on is put on the list again', async () => {
    await withPushOn();

    await refreshPush('user-a');

    expect(mockRegister).toHaveBeenCalledWith(TOKEN, 'ios', 'user-a');
    expect(mockForget).not.toHaveBeenCalled();
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
    expect(mockForget).toHaveBeenCalledWith(TOKEN);

    // The new one is what comes off when the person is signed out.
    mockForget.mockClear();
    await forgetPushWhenSignedOut('user-a');
    expect(mockForget).toHaveBeenCalledWith(NEW_TOKEN);
  });

  test('a new token the phone cannot remember comes straight off again: it could not be taken off later', async () => {
    await withPushOn();
    mockGetToken.mockResolvedValue({ data: NEW_TOKEN });
    mockWriteFailsFor.key = 'push_token.';

    await refreshPush('user-a');

    expect(mockForget).toHaveBeenCalledWith(NEW_TOKEN);
  });

  test('nothing is sent once the person is no longer the one signed in', async () => {
    await withPushOn();

    await refreshPush('user-a', () => false);

    expect(mockRegister).not.toHaveBeenCalled();
  });

  test('nothing is sent if the person turned it off while the phone was being asked', async () => {
    await withPushOn();
    mockGetToken.mockImplementation(async () => {
      // Off, by another road, at the worst moment.
      mockPrefs.set('push.user-a', 'off');
      return { data: TOKEN };
    });

    await refreshPush('user-a');

    expect(mockRegister).not.toHaveBeenCalled();
  });

  test('never throws', async () => {
    await withPushOn();
    mockGetPermissions.mockRejectedValue(new Error('boom'));

    await expect(refreshPush('user-a')).resolves.toBeUndefined();
  });
});

describe('when a person is no longer signed in on this phone', () => {
  test('the phone comes off the list, with no session needed, and the choice is kept for next time', async () => {
    await withPushOn();

    await forgetPushWhenSignedOut('user-a');

    expect(mockForget).toHaveBeenCalledWith(TOKEN);
    expect(stillToForget()).toEqual([]);
    expect(isPushOn('user-a')).toBe(true);
  });

  test('notifications already on the phone’s screen are cleared', async () => {
    await withPushOn();

    await forgetPushWhenSignedOut('user-a');

    expect(mockDismiss).toHaveBeenCalledTimes(1);
  });

  test('is done once: a second call finds nothing to do', async () => {
    await withPushOn();
    await forgetPushWhenSignedOut('user-a');
    mockForget.mockClear();

    await forgetPushWhenSignedOut('user-a');

    expect(mockForget).not.toHaveBeenCalled();
  });

  test('sends nothing for a person who never turned them on', async () => {
    await forgetPushWhenSignedOut('user-a');

    expect(mockForget).not.toHaveBeenCalled();
    expect(mockDismiss).not.toHaveBeenCalled();
  });

  test('if the server cannot be reached, the token stays written down and is tried again later', async () => {
    await withPushOn();
    mockForget.mockResolvedValue('failed');

    await forgetPushWhenSignedOut('user-a');
    expect(stillToForget()).toEqual([TOKEN]);

    mockForget.mockClear().mockResolvedValue('saved');
    await flushForgottenPush();

    expect(mockForget).toHaveBeenCalledWith(TOKEN);
    expect(stillToForget()).toEqual([]);
  });

  test('the next person to sign in has the last person’s phone taken off the list first', async () => {
    await withPushOn('user-a');
    mockForget.mockResolvedValue('failed');
    await forgetPushWhenSignedOut('user-a');
    mockForget.mockClear().mockResolvedValue('saved');

    // B signs in. B has not turned notifications on.
    await refreshPush('user-b');

    expect(mockForget).toHaveBeenCalledWith(TOKEN);
    expect(mockRegister).not.toHaveBeenCalled();
    expect(stillToForget()).toEqual([]);
  });

  test('a phone the next person has put on the list is not taken off by an old note to forget it', async () => {
    await withPushOn('user-a');
    mockForget.mockResolvedValue('failed');
    await forgetPushWhenSignedOut('user-a');
    expect(stillToForget()).toEqual([TOKEN]);

    // B turns notifications on, on the same phone: the same token, and it is B's now.
    expect(await turnPushOn('user-b', 'Notifications')).toBe('on');
    expect(stillToForget()).toEqual([]);

    mockForget.mockClear().mockResolvedValue('saved');
    await flushForgottenPush();
    expect(mockForget).not.toHaveBeenCalled();
  });

  test('signing in again puts the phone back on the list', async () => {
    await withPushOn();
    await forgetPushWhenSignedOut('user-a');

    await refreshPush('user-a');

    expect(mockRegister).toHaveBeenCalledWith(TOKEN, 'ios', 'user-a');
  });

  test('never throws', async () => {
    await withPushOn();
    mockForget.mockRejectedValue(new Error('boom'));

    await expect(forgetPushWhenSignedOut('user-a')).resolves.toBeUndefined();
    await expect(flushForgottenPush()).resolves.toBeUndefined();
  });
});

describe('one thing at a time', () => {
  test('an "off" asked for while an "on" is still under way is sent after it, never before', async () => {
    await withPushOn();
    const sent: string[] = [];
    let finishRegister: (answer: PushWrite) => void = () => {};
    mockRegister.mockImplementation(() => {
      sent.push('register');
      return new Promise<PushWrite>((resolve) => (finishRegister = resolve));
    });
    mockForget.mockImplementation(async () => {
      sent.push('forget');
      return 'saved';
    });

    const refreshing = refreshPush('user-a');
    const turningOff = turnPushOff('user-a');
    // Let the refresh reach the server.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(sent).toEqual(['register']);

    finishRegister('saved');
    await refreshing;
    expect(await turningOff).toBe(true);

    expect(sent).toEqual(['register', 'forget']);
    expect(isPushOn('user-a')).toBe(false);
  });
});

describe('whether notifications are working', () => {
  test('they are when the person has them on and the phone allows them', async () => {
    await withPushOn();

    expect(await isPushWorking('user-a')).toBe(true);
  });

  test('they are not once the phone’s own settings have turned them off', async () => {
    await withPushOn();
    mockGetPermissions.mockResolvedValue({ granted: false, canAskAgain: false });

    expect(await isPushWorking('user-a')).toBe(false);
    expect(mockRequestPermissions).not.toHaveBeenCalled();
  });

  test('they are not for a person who has them off, and the phone is not asked', async () => {
    expect(await isPushWorking('user-a')).toBe(false);
    expect(mockGetPermissions).not.toHaveBeenCalled();
  });

  test('never throws', async () => {
    await withPushOn();
    mockGetPermissions.mockRejectedValue(new Error('boom'));

    expect(await isPushWorking('user-a')).toBe(false);
  });
});

describe('a notification that arrives while the app is open', () => {
  test('is shown quietly to a signed-in person: a banner and the list, no sound, no badge', async () => {
    configurePushHandling();
    setPushViewer('user-a');

    const { handleNotification } = mockHandler.mock.calls[0][0];
    expect(await handleNotification()).toEqual({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    });
  });

  test('is not shown with nobody signed in', async () => {
    configurePushHandling();
    setPushViewer(null);

    const { handleNotification } = mockHandler.mock.calls[0][0];
    expect(await handleNotification()).toEqual({
      shouldShowBanner: false,
      shouldShowList: false,
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
