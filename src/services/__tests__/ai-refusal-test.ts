import { FunctionsHttpError } from '@supabase/supabase-js';

import { askAi } from '@/services/ai-advisor';
import { extractReceipt } from '@/services/receipts';
import { transcribeRecording } from '@/services/transcription';

const mockInvoke = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: { functions: { invoke: (...args: unknown[]) => mockInvoke(...args) } },
}));
jest.mock('@/lib/env', () => ({ assertSupabaseConfigured: jest.fn() }));
jest.mock('@/i18n', () => ({ __esModule: true, default: { t: (key: string) => key }, currentLocale: () => 'en' }));
jest.mock('expo-file-system/legacy', () => ({
  readAsStringAsync: jest.fn(async () => 'AAAA'),
  EncodingType: { Base64: 'base64' },
}));

beforeEach(() => {
  mockInvoke.mockReset();
});

/** A refusal that comes back as an HTTP error with a body. */
function refusedWithStatus(status: number, body: unknown) {
  const context = { status, json: async () => body };
  mockInvoke.mockResolvedValue({ data: null, error: new FunctionsHttpError(context as unknown as Response) });
}

/** A refusal that comes back as an ordinary answer. */
function refusedInAnswer(body: unknown) {
  mockInvoke.mockResolvedValue({ data: body, error: null });
}

const CONSENT = { ok: false, error: 'ai_consent_required' };

describe('when the server has no agreement on record', () => {
  test('the advisor is told, whichever way the refusal arrives', async () => {
    refusedInAnswer(CONSENT);
    expect(await askAi('How is my cash?', null)).toMatchObject({ ok: false, consentRequired: true });

    refusedWithStatus(403, CONSENT);
    expect(await askAi('How is my cash?', null)).toMatchObject({ ok: false, consentRequired: true });
  });

  test('the advisor never shows the raw code', async () => {
    refusedInAnswer(CONSENT);

    const result = await askAi('How is my cash?', null);

    expect(result.error).not.toContain('ai_consent_required');
  });

  test('the voice note is told, whichever way the refusal arrives', async () => {
    refusedInAnswer(CONSENT);
    expect(await transcribeRecording('file:///voice.m4a')).toMatchObject({ ok: false, consentRequired: true });

    refusedWithStatus(403, CONSENT);
    expect(await transcribeRecording('file:///voice.m4a')).toMatchObject({ ok: false, consentRequired: true });
  });

  test('the voice note never shows the raw code', async () => {
    refusedInAnswer(CONSENT);

    const result = await transcribeRecording('file:///voice.m4a');

    expect(result.error).toBe('errors.transcribeFailed');
  });

  test('the receipt form is told, and the photo counts as not read', async () => {
    refusedInAnswer({ ok: true, ocrConfigured: false, extracted: null, error: 'ai_consent_required' });

    expect(await extractReceipt('receipt-1')).toEqual({ extracted: null, ocrConfigured: false, consentRequired: true });
  });
});

describe('other refusals are not mistaken for a missing agreement', () => {
  test('the advisor', async () => {
    refusedInAnswer({ ok: false, error: 'rate_limited' });

    expect((await askAi('How is my cash?', null)).consentRequired).toBeFalsy();
  });

  test('the voice note', async () => {
    refusedInAnswer({ ok: false, error: 'audio_too_large' });

    expect((await transcribeRecording('file:///voice.m4a')).consentRequired).toBeFalsy();
  });

  test('the receipt form, for a locked account', async () => {
    refusedInAnswer({ ok: true, ocrConfigured: false, extracted: null, error: 'account_locked' });

    expect((await extractReceipt('receipt-1')).consentRequired).toBeFalsy();
  });
});
