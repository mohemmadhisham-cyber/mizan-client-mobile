import * as FileSystem from 'expo-file-system';

import i18n from '@/i18n';
import { assertSupabaseConfigured } from '@/lib/env';
import { supabase } from '@/lib/supabase';

export interface TranscribeResult {
  ok: boolean;
  text?: string;
  error?: string;
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
  if (error) return { ok: false, error: error.message };
  if (!data?.ok) return { ok: false, error: data?.error ?? i18n.t('errors.transcribeFailed') };
  return { ok: true, text: data.text };
}
