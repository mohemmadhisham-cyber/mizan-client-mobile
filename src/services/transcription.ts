// The classic file functions live under /legacy. Imported from the package root they
// are stubs that throw when called, so every upload and recording failed.
import { FunctionsHttpError } from '@supabase/supabase-js';
import * as FileSystem from 'expo-file-system/legacy';

import i18n from '@/i18n';
import { assertSupabaseConfigured } from '@/lib/env';
import { supabase } from '@/lib/supabase';

export interface TranscribeResult {
  ok: boolean;
  text?: string;
  error?: string;
  /** The server has no agreement on record for this person: ask before trying again. */
  consentRequired?: boolean;
}

/** The server's answer when a client has not agreed to their recording going to an AI provider. */
const CONSENT_REQUIRED = 'ai_consent_required';

/** The error code in the body of a refusal, when there is one. */
async function refusalCode(error: unknown): Promise<string | null> {
  if (!(error instanceof FunctionsHttpError)) return null;
  try {
    const body: unknown = await error.context.json();
    const code = (body as { error?: unknown } | null)?.error;
    return typeof code === 'string' ? code : null;
  } catch {
    return null;
  }
}

/** Reads a local voice recording and sends it to the transcribe-audio edge
 * function (OpenAI Whisper server-side). Returns plain text the caller can
 * treat exactly like typed input. */
export async function transcribeRecording(uri: string, mimeType = 'audio/m4a'): Promise<TranscribeResult> {
  assertSupabaseConfigured();

  let audioBase64: string;
  try {
    audioBase64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
  } catch {
    return { ok: false, error: i18n.t('errors.recordingUnreadable') };
  }

  const { data, error } = await supabase.functions.invoke<{ ok: boolean; text?: string; error?: string }>(
    'transcribe-audio',
    { body: { audioBase64, mimeType } },
  );
  if (error) {
    if ((await refusalCode(error)) === CONSENT_REQUIRED) {
      return { ok: false, error: i18n.t('errors.transcribeFailed'), consentRequired: true };
    }
    return { ok: false, error: error.message };
  }
  if (data?.error === CONSENT_REQUIRED) {
    return { ok: false, error: i18n.t('errors.transcribeFailed'), consentRequired: true };
  }
  if (!data?.ok) return { ok: false, error: data?.error ?? i18n.t('errors.transcribeFailed') };
  return { ok: true, text: data.text };
}
