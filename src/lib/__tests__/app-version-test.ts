import {
  currentAppVersion,
  isOlderThan,
  isStorePlatform,
  ownAndroidPackage,
  parseVersion,
  safeStoreUrl,
} from '@/lib/app-version';

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { version: '1.4.2', android: { package: 'com.mizan.client' } } },
}));

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
  test('takes an https link to the app’s page on the platform’s own store', () => {
    expect(safeStoreUrl('ios', 'https://apps.apple.com/app/id123456789')).toBe('https://apps.apple.com/app/id123456789');
    expect(safeStoreUrl('ios', 'https://apps.apple.com/ae/app/mizan-connect/id123456789?mt=8')).toBe(
      'https://apps.apple.com/ae/app/mizan-connect/id123456789?mt=8',
    );
    expect(safeStoreUrl('android', ' https://play.google.com/store/apps/details?id=com.mizan.client ')).toBe(
      'https://play.google.com/store/apps/details?id=com.mizan.client',
    );
    expect(safeStoreUrl('android', 'https://play.google.com/store/apps/details?id=com.mizan.client&hl=ar')).toBe(
      'https://play.google.com/store/apps/details?id=com.mizan.client&hl=ar',
    );
  });

  test('on Android the page must be this app’s own', () => {
    expect(safeStoreUrl('android', 'https://play.google.com/store/apps/details?id=com.someone.else')).toBeNull();
    expect(safeStoreUrl('android', 'https://play.google.com/store/apps/details?id=com.mizan.client.evil')).toBeNull();
  });

  test('an app that does not know its own identifier still takes only an app’s page', () => {
    expect(safeStoreUrl('android', 'https://play.google.com/store/apps/details?id=com.any.app', null)).toBe(
      'https://play.google.com/store/apps/details?id=com.any.app',
    );
    expect(safeStoreUrl('android', 'https://play.google.com/store/search?q=x', null)).toBeNull();
  });

  test('takes a long link: length alone refuses nothing', () => {
    const long = `https://play.google.com/store/apps/details?id=com.mizan.client&referrer=${'x'.repeat(600)}`;

    expect(safeStoreUrl('android', long)).toBe(long);
  });

  test.each([
    ['the other platform’s store', 'ios', 'https://play.google.com/store/apps/details?id=com.mizan.client'],
    ['the store’s front page', 'ios', 'https://apps.apple.com/'],
    ['another kind of page on the store', 'ios', 'https://apps.apple.com/ae/developer/someone/id123456789'],
    ['an app page with something after it', 'ios', 'https://apps.apple.com/app/id123456789/../../redirect'],
    ['an app page with a fragment', 'ios', 'https://apps.apple.com/app/id123456789#x'],
    ['another page on the Android store', 'android', 'https://play.google.com/store/search?q=mizan'],
    ['an Android page with no app named', 'android', 'https://play.google.com/store/apps/details'],
    ['an Android page whose app id is not one', 'android', 'https://play.google.com/store/apps/details?id=../x'],
    ['capital letters in the address', 'ios', 'HTTPS://APPS.APPLE.COM/app/id123456789'],
    ['another site', 'ios', 'https://example.com/app'],
    ['a look-alike host', 'ios', 'https://apps.apple.com.example.com/app'],
    ['a host hidden behind a user name', 'android', 'https://play.google.com@example.com/store/apps/details?id=com.mizan.client'],
    ['a user name on the real host', 'android', 'https://someone@play.google.com/store/apps/details?id=com.mizan.client'],
    ['a port on the host', 'android', 'https://play.google.com:8443/store/apps/details?id=com.mizan.client'],
    ['plain http', 'android', 'http://play.google.com/store/apps/details?id=com.mizan.client'],
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
  test('knows its version and its Android identifier from its config', () => {
    expect(currentAppVersion()).toBe('1.4.2');
    expect(ownAndroidPackage()).toBe('com.mizan.client');
  });

  test('knows the two store platforms and nothing else', () => {
    expect(isStorePlatform('ios')).toBe(true);
    expect(isStorePlatform('android')).toBe(true);
    expect(isStorePlatform('web')).toBe(false);
  });
});
