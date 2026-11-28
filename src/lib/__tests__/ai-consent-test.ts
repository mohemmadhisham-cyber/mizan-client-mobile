import {
  aiDeclinedThisRun,
  hasAiConsent,
  noteAiDeclined,
  recordAiConsent,
  setAiConsent,
  syncAiConsent,
} from '@/lib/ai-consent';
import { readServerConsent, writeServerConsent, type ServerConsent } from '@/services/ai-consent-server';

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

const NEVER_ASKED: ServerConsent = { known: true, granted: false, version: null, withdrawn: false };
const AGREED: ServerConsent = { known: true, granted: true, version: 'v1', withdrawn: false };
const WITHDRAWN: ServerConsent = { known: true, granted: false, version: null, withdrawn: true };

beforeEach(() => {
  mockStore.clear();
  mockDevice.failWrites = false;
  mockRead.mockReset();
  mockWrite.mockReset();
});

describe('AI consent', () => {
  test('is not given until the person agrees', () => {
    expect(hasAiConsent('user-a')).toBe(false);
  });

  test('is never given when no one is signed in', () => {
    expect(hasAiConsent(undefined)).toBe(false);
  });

  test('is given after the person agrees', async () => {
    const saved = await setAiConsent('user-a', true);

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

  test('is never given for an empty id', () => {
    mockStore.set('ai_consent.', 'v1');

    expect(hasAiConsent('')).toBe(false);
  });
});

describe('agreeing', () => {
  test('tells the server the wording and who it is for, then keeps the agreement on the device', async () => {
    mockWrite.mockResolvedValue('saved');

    expect(await recordAiConsent('user-a', true)).toBe(true);

    expect(mockWrite).toHaveBeenCalledWith(true, 'v1', 'user-a');
    expect(hasAiConsent('user-a')).toBe(true);
  });

  test('keeps the agreement on the device alone when the server keeps no record yet', async () => {
    mockWrite.mockResolvedValue('not_offered');

    expect(await recordAiConsent('user-a', true)).toBe(true);
    expect(hasAiConsent('user-a')).toBe(true);
  });

  test('changes nothing on the device when the server failed to record it', async () => {
    mockWrite.mockResolvedValue('failed');

    expect(await recordAiConsent('user-a', true)).toBe(false);
    expect(hasAiConsent('user-a')).toBe(false);
  });

  test('reports a failure when the device could not save, even though the server did', async () => {
    mockWrite.mockResolvedValue('saved');
    mockDevice.failWrites = true;

    expect(await recordAiConsent('user-a', true)).toBe(false);
  });
});

describe('withdrawing', () => {
  beforeEach(async () => {
    await setAiConsent('user-a', true);
  });

  test('takes effect on this phone even when the server cannot be reached', async () => {
    mockWrite.mockResolvedValue('failed');

    expect(await recordAiConsent('user-a', false)).toBe(true);

    expect(hasAiConsent('user-a')).toBe(false);
  });

  test('takes effect on this phone before the server is told', async () => {
    let onDeviceWhenServerWasTold: boolean | null = null;
    mockWrite.mockImplementation(async () => {
      onDeviceWhenServerWasTold = hasAiConsent('user-a');
      return 'saved';
    });

    await recordAiConsent('user-a', false);

    expect(onDeviceWhenServerWasTold).toBe(false);
  });

  test('tells the server', async () => {
    mockWrite.mockResolvedValue('saved');

    await recordAiConsent('user-a', false);

    expect(mockWrite).toHaveBeenCalledWith(false, 'v1', 'user-a');
    expect(hasAiConsent('user-a')).toBe(false);
  });

  test('works when the server keeps no record yet', async () => {
    mockWrite.mockResolvedValue('not_offered');

    expect(await recordAiConsent('user-a', false)).toBe(true);
    expect(hasAiConsent('user-a')).toBe(false);
  });

  test('still tells the server when the device could not save, and says it was not saved', async () => {
    mockWrite.mockResolvedValue('saved');
    mockDevice.failWrites = true;

    expect(await recordAiConsent('user-a', false)).toBe(false);
    expect(mockWrite).toHaveBeenCalledWith(false, 'v1', 'user-a');
  });

  test('is sent by the next sync when the server could not be reached at the time', async () => {
    mockWrite.mockResolvedValue('failed');
    await recordAiConsent('user-a', false);
    mockWrite.mockReset();
    mockWrite.mockResolvedValue('saved');
    mockRead.mockResolvedValue(AGREED);

    await syncAiConsent('user-a');

    expect(mockWrite).toHaveBeenCalledWith(false, 'v1', 'user-a');
    expect(hasAiConsent('user-a')).toBe(false);
  });

  test('is not sent twice: once the server knows, a later agreement elsewhere is not undone', async () => {
    mockWrite.mockResolvedValue('saved');
    await recordAiConsent('user-a', false);
    mockWrite.mockReset();
    // The person later agreed again on another phone.
    mockRead.mockResolvedValue(AGREED);

    await syncAiConsent('user-a');

    expect(mockWrite).not.toHaveBeenCalled();
    expect(hasAiConsent('user-a')).toBe(true);
  });
});

describe('bringing the device and the server into line after sign-in', () => {
  test('asks the server about this person', async () => {
    mockRead.mockResolvedValue(NEVER_ASKED);

    await syncAiConsent('user-a');

    expect(mockRead).toHaveBeenCalledWith('user-a');
  });

  test('changes nothing when the server is not known', async () => {
    await setAiConsent('user-a', true);
    mockRead.mockResolvedValue({ known: false });

    await syncAiConsent('user-a');

    expect(hasAiConsent('user-a')).toBe(true);
    expect(mockWrite).not.toHaveBeenCalled();
  });

  test('applies a withdrawal made on another phone', async () => {
    await setAiConsent('user-a', true);
    mockRead.mockResolvedValue(WITHDRAWN);

    await syncAiConsent('user-a');

    expect(hasAiConsent('user-a')).toBe(false);
    expect(mockWrite).not.toHaveBeenCalled();
  });

  test('brings an agreement to a phone that was never asked', async () => {
    mockRead.mockResolvedValue(AGREED);

    await syncAiConsent('user-a');

    expect(hasAiConsent('user-a')).toBe(true);
    expect(mockWrite).not.toHaveBeenCalled();
  });

  test('never turns consent back on over a withdrawal made here that the server has not heard of', async () => {
    await setAiConsent('user-a', true);
    await setAiConsent('user-a', false);
    mockRead.mockResolvedValue(AGREED);
    mockWrite.mockResolvedValue('failed');

    await syncAiConsent('user-a');

    expect(hasAiConsent('user-a')).toBe(false);
    expect(mockWrite).toHaveBeenCalledWith(false, 'v1', 'user-a');
  });

  test('does not carry over an agreement to another wording: the person is asked again', async () => {
    mockRead.mockResolvedValue({ known: true, granted: true, version: 'v0', withdrawn: false });

    await syncAiConsent('user-a');

    expect(hasAiConsent('user-a')).toBe(false);
  });

  test('sends up an agreement made before the server kept a record', async () => {
    await setAiConsent('user-a', true);
    mockRead.mockResolvedValue(NEVER_ASKED);
    mockWrite.mockResolvedValue('saved');

    await syncAiConsent('user-a');

    expect(mockWrite).toHaveBeenCalledWith(true, 'v1', 'user-a');
    expect(hasAiConsent('user-a')).toBe(true);
  });

  test('sends nothing up for a person who has not agreed anywhere', async () => {
    mockRead.mockResolvedValue(NEVER_ASKED);

    await syncAiConsent('user-a');

    expect(mockWrite).not.toHaveBeenCalled();
    expect(hasAiConsent('user-a')).toBe(false);
  });

  test('writes nothing when the person made a choice while the server was being asked', async () => {
    await setAiConsent('user-a', true);
    // The server still says "agreed", but while it was being asked the person withdrew.
    mockRead.mockImplementation(async () => {
      await setAiConsent('user-a', false);
      return AGREED;
    });

    await syncAiConsent('user-a');

    expect(hasAiConsent('user-a')).toBe(false);
    expect(mockWrite).not.toHaveBeenCalled();
  });

  test('writes nothing once this person is no longer the one signed in', async () => {
    await setAiConsent('user-a', true);
    mockRead.mockResolvedValue(NEVER_ASKED);

    await syncAiConsent('user-a', () => false);

    expect(mockWrite).not.toHaveBeenCalled();
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
