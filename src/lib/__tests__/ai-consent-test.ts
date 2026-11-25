import {
  aiDeclinedThisRun,
  hasAiConsent,
  noteAiDeclined,
  recordAiConsent,
  setAiConsent,
  syncAiConsent,
} from '@/lib/ai-consent';
import { readServerConsent, writeServerConsent } from '@/services/ai-consent-server';

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

jest.mock('@/services/ai-consent-server', () => ({
  readServerConsent: jest.fn(),
  writeServerConsent: jest.fn(),
}));

const mockRead = readServerConsent as jest.MockedFunction<typeof readServerConsent>;
const mockWrite = writeServerConsent as jest.MockedFunction<typeof writeServerConsent>;

beforeEach(() => {
  mockStore.clear();
  mockDevice.failWrites = false;
  mockRead.mockReset();
  mockWrite.mockReset();
});

describe('recording a choice', () => {
  test('tells the server the wording, then keeps the agreement on the device', async () => {
    mockWrite.mockResolvedValue('saved');

    expect(await recordAiConsent('user-a', true)).toBe(true);

    expect(mockWrite).toHaveBeenCalledWith(true, 'v1');
    expect(hasAiConsent('user-a')).toBe(true);
  });

  test('keeps the agreement on the device alone when the server keeps no record yet', async () => {
    mockWrite.mockResolvedValue('not_offered');

    expect(await recordAiConsent('user-a', true)).toBe(true);
    expect(hasAiConsent('user-a')).toBe(true);
  });

  test('changes nothing on the device when the server failed to record an agreement', async () => {
    mockWrite.mockResolvedValue('failed');

    expect(await recordAiConsent('user-a', true)).toBe(false);
    expect(hasAiConsent('user-a')).toBe(false);
  });

  test('keeps the agreement standing when the server failed to record a withdrawal, and says so', async () => {
    await setAiConsent('user-a', true);
    mockWrite.mockResolvedValue('failed');

    expect(await recordAiConsent('user-a', false)).toBe(false);
    expect(hasAiConsent('user-a')).toBe(true);
  });

  test('withdraws on the server and on the device', async () => {
    await setAiConsent('user-a', true);
    mockWrite.mockResolvedValue('saved');

    expect(await recordAiConsent('user-a', false)).toBe(true);

    expect(mockWrite).toHaveBeenCalledWith(false, 'v1');
    expect(hasAiConsent('user-a')).toBe(false);
  });

  test('reports a failure when the device could not save, even though the server did', async () => {
    mockWrite.mockResolvedValue('saved');
    mockDevice.failWrites = true;

    expect(await recordAiConsent('user-a', true)).toBe(false);
  });
});

describe('bringing the device and the server into line after sign-in', () => {
  test('changes nothing when the server is not known', async () => {
    await setAiConsent('user-a', true);
    mockRead.mockResolvedValue({ known: false });

    await syncAiConsent('user-a');

    expect(hasAiConsent('user-a')).toBe(true);
    expect(mockWrite).not.toHaveBeenCalled();
  });

  test('applies a withdrawal made on another phone', async () => {
    await setAiConsent('user-a', true);
    mockRead.mockResolvedValue({ known: true, granted: false, version: null, withdrawn: true });

    await syncAiConsent('user-a');

    expect(hasAiConsent('user-a')).toBe(false);
    // A withdrawal is never undone by sending the old agreement back up.
    expect(mockWrite).not.toHaveBeenCalled();
  });

  test('brings an agreement to a new phone', async () => {
    mockRead.mockResolvedValue({ known: true, granted: true, version: 'v1', withdrawn: false });

    await syncAiConsent('user-a');

    expect(hasAiConsent('user-a')).toBe(true);
    expect(mockWrite).not.toHaveBeenCalled();
  });

  test('does not carry over an agreement to another wording: the person is asked again', async () => {
    mockRead.mockResolvedValue({ known: true, granted: true, version: 'v0', withdrawn: false });

    await syncAiConsent('user-a');

    expect(hasAiConsent('user-a')).toBe(false);
  });

  test('sends up an agreement made before the server kept a record', async () => {
    await setAiConsent('user-a', true);
    mockRead.mockResolvedValue({ known: true, granted: false, version: null, withdrawn: false });
    mockWrite.mockResolvedValue('saved');

    await syncAiConsent('user-a');

    expect(mockWrite).toHaveBeenCalledWith(true, 'v1');
    expect(hasAiConsent('user-a')).toBe(true);
  });

  test('sends nothing up for a person who has not agreed anywhere', async () => {
    mockRead.mockResolvedValue({ known: true, granted: false, version: null, withdrawn: false });

    await syncAiConsent('user-a');

    expect(mockWrite).not.toHaveBeenCalled();
    expect(hasAiConsent('user-a')).toBe(false);
  });
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
