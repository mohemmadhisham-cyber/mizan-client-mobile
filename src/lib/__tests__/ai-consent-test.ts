import { aiDeclinedThisRun, hasAiConsent, noteAiDeclined, setAiConsent } from '@/lib/ai-consent';

const mockStore = new Map<string, string>();
const mockDevice = { failWrites: false };

jest.mock('@/lib/device-prefs', () => ({
  readDevicePref: (key: string) => mockStore.get(key) ?? null,
  writeDevicePref: async (key: string, value: string) => {
    if (mockDevice.failWrites) return false;
    mockStore.set(key, value);
    return true;
  },
}));

beforeEach(() => {
  mockStore.clear();
  mockDevice.failWrites = false;
});

describe('AI consent', () => {
  test('is not given until the person agrees', () => {
    expect(hasAiConsent('user-a')).toBe(false);
  });

  test('is never given when no one is signed in', () => {
    expect(hasAiConsent(undefined)).toBe(false);
  });

  test('is given after the person agrees', async () => {
    // Act
    const saved = await setAiConsent('user-a', true);

    // Assert
    expect(saved).toBe(true);
    expect(hasAiConsent('user-a')).toBe(true);
  });

  test('is kept per person, so a second person on the phone is asked too', async () => {
    await setAiConsent('user-a', true);

    expect(hasAiConsent('user-b')).toBe(false);
  });

  test('is gone after the person withdraws it', async () => {
    await setAiConsent('user-a', true);

    await setAiConsent('user-a', false);

    expect(hasAiConsent('user-a')).toBe(false);
  });

  test('is not given when the choice could not be saved', async () => {
    mockDevice.failWrites = true;

    const saved = await setAiConsent('user-a', true);

    expect(saved).toBe(false);
    expect(hasAiConsent('user-a')).toBe(false);
  });

  test('is not given by a value saved for an older wording', () => {
    mockStore.set('ai_consent.user-a', 'v0');

    expect(hasAiConsent('user-a')).toBe(false);
  });

  test('is never given for an empty id', async () => {
    mockStore.set('ai_consent.', 'v1');

    expect(hasAiConsent('')).toBe(false);
  });
});

describe('"Not now" for the AI', () => {
  test('is remembered while the app stays open', () => {
    noteAiDeclined('user-declined');

    expect(aiDeclinedThisRun('user-declined')).toBe(true);
  });

  test('is per person', () => {
    noteAiDeclined('user-declined-2');

    expect(aiDeclinedThisRun('someone-else')).toBe(false);
    expect(aiDeclinedThisRun(undefined)).toBe(false);
  });

  test('is forgotten once the person agrees', async () => {
    noteAiDeclined('user-changed-mind');

    await setAiConsent('user-changed-mind', true);

    expect(aiDeclinedThisRun('user-changed-mind')).toBe(false);
  });

  test('is not set by withdrawing consent', async () => {
    await setAiConsent('user-withdrew', false);

    expect(aiDeclinedThisRun('user-withdrew')).toBe(false);
  });

  test('is not consent', () => {
    noteAiDeclined('user-declined-3');

    expect(hasAiConsent('user-declined-3')).toBe(false);
  });
});
