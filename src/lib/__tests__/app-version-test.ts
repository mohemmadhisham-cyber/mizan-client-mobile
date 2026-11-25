import { currentAppVersion, isOlderThan, isStorePlatform, parseVersion, safeStoreUrl } from '@/lib/app-version';

jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { version: '1.4.2' } } }));

describe('parseVersion', () => {
  test('reads major.minor.patch', () => {
    expect(parseVersion('1.2.3')).toEqual([1, 2, 3]);
    expect(parseVersion(' 10.0.12 ')).toEqual([10, 0, 12]);
  });

  test.each([undefined, null, '', '1.2', '1.2.3.4', 'v1.2.3', '1.2.3-beta', '1.-2.3', 'latest', 123, '1.2.33333'])(
    'does not read %p',
    (value) => {
      expect(parseVersion(value)).toBeNull();
    },
  );
});

describe('isOlderThan', () => {
  test.each([
    ['1.0.0', '1.0.1'],
    ['1.0.9', '1.1.0'],
    ['1.9.9', '2.0.0'],
    ['1.2.0', '1.10.0'],
    ['2.0.0', '10.0.0'],
  ])('%s is older than %s', (current, minimum) => {
    expect(isOlderThan(current, minimum)).toBe(true);
  });

  test.each([
    ['1.0.0', '1.0.0'],
    ['1.0.1', '1.0.0'],
    ['1.10.0', '1.2.0'],
    ['2.0.0', '1.9.9'],
    ['10.0.0', '2.0.0'],
  ])('%s is not older than %s', (current, minimum) => {
    expect(isOlderThan(current, minimum)).toBe(false);
  });

  test('numbers are compared as numbers, not as text', () => {
    expect(isOlderThan('1.9.0', '1.10.0')).toBe(true);
    expect(isOlderThan('1.10.0', '1.9.0')).toBe(false);
  });

  test.each([
    ['this version cannot be read', null, '2.0.0'],
    ['this version is not a plain version', '1.0', '2.0.0'],
    ['the server sets no minimum', '1.0.0', null],
    ['the minimum cannot be read', '1.0.0', 'latest'],
    ['neither can be read', undefined, undefined],
  ])('is false when %s: a doubt never blocks the app', (_name, current, minimum) => {
    expect(isOlderThan(current, minimum)).toBe(false);
  });
});

describe('safeStoreUrl', () => {
  test('takes an https link to the platform’s own store', () => {
    expect(safeStoreUrl('ios', 'https://apps.apple.com/app/id123456789')).toBe('https://apps.apple.com/app/id123456789');
    expect(safeStoreUrl('android', ' https://play.google.com/store/apps/details?id=team.mizan.connect ')).toBe(
      'https://play.google.com/store/apps/details?id=team.mizan.connect',
    );
  });

  test.each([
    ['the other platform’s store', 'ios', 'https://play.google.com/store/apps/details?id=x'],
    ['another site', 'ios', 'https://example.com/app'],
    ['a look-alike host', 'ios', 'https://apps.apple.com.example.com/app'],
    ['a host hidden behind a user name', 'android', 'https://play.google.com@example.com/x'],
    ['a user name on the real host', 'android', 'https://someone@play.google.com/x'],
    ['a port on the host', 'android', 'https://play.google.com:8443/x'],
    ['plain http', 'android', 'http://play.google.com/store/apps/details?id=x'],
    ['a script', 'ios', 'javascript:alert(1)'],
    ['an app link', 'ios', 'itms-apps://apps.apple.com/app/id1'],
    ['a link with a space in it', 'ios', 'https://apps.apple.com/app id1'],
    ['the host with no path', 'ios', 'https://apps.apple.com'],
    ['nothing', 'ios', null],
    ['a number', 'android', 42],
  ] as const)('refuses %s', (_name, platform, value) => {
    expect(safeStoreUrl(platform, value)).toBeNull();
  });
});

describe('the app itself', () => {
  test('knows its version from its config', () => {
    expect(currentAppVersion()).toBe('1.4.2');
  });

  test('knows the two store platforms and nothing else', () => {
    expect(isStorePlatform('ios')).toBe(true);
    expect(isStorePlatform('android')).toBe(true);
    expect(isStorePlatform('web')).toBe(false);
  });
});
