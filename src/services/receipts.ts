import * as FileSystem from 'expo-file-system';

import { assertSupabaseConfigured } from '@/lib/env';
import { supabase } from '@/lib/supabase';

/**
 * Uploads a captured/picked receipt image to Supabase Storage and records a
 * `receipts` row. Mirrors the object-key convention already used by the
 * `onboarding-docs` bucket in balance-beams-ai: `<firm_id>/<client_id>/<name>`,
 * matching the receipts bucket's RLS (gates on those exact path segments).
 * Money/extraction fields are left null — AI extraction is a separate,
 * server-side pipeline (untrusted draft, human-reviewed; CLAUDE.md §9/§14).
 */

const MAX_BYTES = 10 * 1024 * 1024; // 10MB — mirrors the receipts bucket's server-side limit
const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'application/pdf',
]);

export interface CapturedFile {
  uri: string;
  mimeType: string;
}

export interface UploadReceiptResult {
  ok: boolean;
  error?: string;
  receiptId?: string;
}

function extensionFor(mimeType: string): string {
  switch (mimeType) {
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    case 'image/heic':
      return 'heic';
    case 'image/heif':
      return 'heif';
    case 'application/pdf':
      return 'pdf';
    default:
      return 'jpg';
  }
}

/** Generated filename — never derived from user-supplied input (CLAUDE.md §9). */
function generatedName(mimeType: string): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `receipt-${Date.now()}-${rand}.${extensionFor(mimeType)}`;
}

export async function uploadReceipt(
  file: CapturedFile,
  firmId: string,
  clientId: string,
  uploadedBy: string,
): Promise<UploadReceiptResult> {
  assertSupabaseConfigured();

  // Verified by the value we ourselves set from the capture/picker result, not
  // a client-supplied filename extension.
  if (!ALLOWED_MIME.has(file.mimeType)) {
    return { ok: false, error: 'Unsupported file type. Use a photo or PDF.' };
  }

  const info = await FileSystem.getInfoAsync(file.uri);
  if (!info.exists) return { ok: false, error: 'The file could not be found.' };
  if ((info.size ?? 0) > MAX_BYTES) {
    return { ok: false, error: 'That file is larger than 10MB.' };
  }

  const path = `${firmId}/${clientId}/${generatedName(file.mimeType)}`;

  let arrayBuffer: ArrayBuffer;
  try {
    arrayBuffer = await fetch(file.uri).then((r) => r.arrayBuffer());
  } catch {
    return { ok: false, error: 'Could not read the file. Please try again.' };
  }

  const { error: uploadError } = await supabase.storage
    .from('receipts')
    .upload(path, arrayBuffer, { contentType: file.mimeType, upsert: false });
  if (uploadError) return { ok: false, error: uploadError.message };

  const { data, error: insertError } = await supabase
    .from('receipts')
    .insert({
      firm_id: firmId,
      client_id: clientId,
      storage_path: path,
      uploaded_by: uploadedBy,
      status: 'uploaded',
    })
    .select('id')
    .single();

  if (insertError) {
    // Best-effort cleanup so a failed insert doesn't leave an orphaned file.
    await supabase.storage.from('receipts').remove([path]).catch(() => {});
    return { ok: false, error: insertError.message };
  }

  return { ok: true, receiptId: data.id as string };
}
