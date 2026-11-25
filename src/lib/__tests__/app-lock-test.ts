import * as LocalAuthentication from 'expo-local-authentication';

import {
  askToUnlock,
  isAppLockOn,
  locksOnReturn,
  maySwitchLock,
  phoneCanLock,
  RELOCK_AFTER_MS,
  setAppLock,
  startsLocked,
} from '@/lib/app-lock';

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
jest.mock('expo-local-authentication', () => ({
  SecurityLevel: { NONE: 0, SECRET: 1, BIOMETRIC_WEAK: 2, BIOMETRIC_STRONG: 3 },
  getEnrolledLevelAsync: jest.fn(),
  authenticateAsync: jest.fn(),
}));

const mockLevel = LocalAuthentication.getEnrolledLevelAsync as jest.Mock;
const mockAuthenticate = LocalAuthentication.authenticateAsync as jest.Mock;

beforeEach(() => {
  mockPrefs.clear();
  mockWriteFails.value = false;
  mockLevel.mockReset().mockResolvedValue(LocalAuthentication.SecurityLevel.BIOMETRIC_STRONG);
  mockAuthenticate.mockReset().mockResolvedValue({ success: true });
});

describe('the choice to lock the app', () => {
  test('is off until the person turns it on', () => {
    expect(isAppLockOn('user-a')).toBe(false);
  });

  test('is kept per person: one person turning it on does not lock another', async () => {
    expect(await setAppLock('user-a', true)).toBe(true);

    expect(isAppLockOn('user-a')).toBe(true);
    expect(isAppLockOn('user-b')).toBe(false);
  });

  test('can be turned off again', async () => {
    await setAppLock('user-a', true);
    await setAppLock('user-a', false);

    expect(isAppLockOn('user-a')).toBe(false);
  });

  test('is off for nobody', () => {
    expect(isAppLockOn(null)).toBe(false);
    expect(isAppLockOn(undefined)).toBe(false);
  });

  test('says so when it could not be saved', async () => {
    mockWriteFails.value = true;

    expect(await setAppLock('user-a', true)).toBe(false);
    expect(isAppLockOn('user-a')).toBe(false);
  });
});

describe('whether the phone can lock the app', () => {
  test.each([
    ['a passcode', LocalAuthentication.SecurityLevel.SECRET],
    ['a weak biometric', LocalAuthentication.SecurityLevel.BIOMETRIC_WEAK],
    ['a strong biometric', LocalAuthentication.SecurityLevel.BIOMETRIC_STRONG],
  ])('it can with %s', async (_name, level) => {
    mockLevel.mockResolvedValue(level);

    expect(await phoneCanLock()).toBe(true);
  });

  test('it cannot with nothing set up', async () => {
    mockLevel.mockResolvedValue(LocalAuthentication.SecurityLevel.NONE);

    expect(await phoneCanLock()).toBe(false);
  });

  test('it cannot when the phone will not say', async () => {
    mockLevel.mockRejectedValue(new Error('not supported'));

    expect(await phoneCanLock()).toBe(false);
  });
});

describe('asking the phone to confirm the person', () => {
  test('unlocks when the phone says yes', async () => {
    expect(await askToUnlock('Unlock')).toBe('unlocked');
  });

  test('lets the phone fall back to its passcode', async () => {
    await askToUnlock('Unlock');

    expect(mockAuthenticate).toHaveBeenCalledWith({ promptMessage: 'Unlock', disableDeviceFallback: false });
  });

  test('is refused when the person cancels or is not recognised', async () => {
    mockAuthenticate.mockResolvedValue({ success: false, error: 'user_cancel' });

    expect(await askToUnlock('Unlock')).toBe('refused');
  });

  test('is refused, not unlocked, when asking fails', async () => {
    mockAuthenticate.mockRejectedValue(new Error('boom'));

    expect(await askToUnlock('Unlock')).toBe('refused');
  });

  test('says the phone has nothing to confirm with, and does not ask', async () => {
    mockLevel.mockResolvedValue(LocalAuthentication.SecurityLevel.NONE);

    expect(await askToUnlock('Unlock')).toBe('unavailable');
    expect(mockAuthenticate).not.toHaveBeenCalled();
  });
});

describe('switching the lock in Settings', () => {
  test('is allowed either way once the phone has confirmed the person', () => {
    expect(maySwitchLock(false, 'unlocked')).toBe(true);
    expect(maySwitchLock(true, 'unlocked')).toBe(true);
  });

  test('is not allowed when the phone refused: the lock cannot be switched off by someone else', () => {
    expect(maySwitchLock(true, 'refused')).toBe(false);
    expect(maySwitchLock(false, 'refused')).toBe(false);
  });

  test('off is allowed on a phone that can no longer confirm anyone, and on is not', () => {
    expect(maySwitchLock(true, 'unavailable')).toBe(true);
    expect(maySwitchLock(false, 'unavailable')).toBe(false);
  });
});

describe('when the app is locked', () => {
  test('it starts locked for a session already on the phone, with the lock on', () => {
    expect(startsLocked(true, true)).toBe(true);
  });

  test('it does not start locked with the lock off, or with nobody signed in', () => {
    expect(startsLocked(true, false)).toBe(false);
    expect(startsLocked(false, true)).toBe(false);
  });

  test('it locks again after long enough out of sight, and not after a glance away', () => {
    expect(locksOnReturn(true, RELOCK_AFTER_MS)).toBe(true);
    expect(locksOnReturn(true, RELOCK_AFTER_MS - 1)).toBe(false);
    expect(locksOnReturn(true, 0)).toBe(false);
  });

  test('it never locks again with the lock off', () => {
    expect(locksOnReturn(false, RELOCK_AFTER_MS * 100)).toBe(false);
  });
});
