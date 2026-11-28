import * as FileSystem from 'expo-file-system';

import i18n from '@/i18n';
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
    return { ok: false, error: i18n.t('errors.receiptTypeUnsupported') };
  }

  const info = await FileSystem.getInfoAsync(file.uri);
  if (!info.exists) return { ok: false, error: i18n.t('errors.fileNotFound') };
  if ((info.size ?? 0) > MAX_BYTES) {
    return { ok: false, error: i18n.t('errors.fileTooLarge') };
  }

  const path = `${firmId}/${clientId}/${generatedName(file.mimeType)}`;

  let arrayBuffer: ArrayBuffer;
  try {
    arrayBuffer = await fetch(file.uri).then((r) => r.arrayBuffer());
  } catch {
    return { ok: false, error: i18n.t('errors.fileReadFailed') };
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

/**
 * Creates a photo-less receipt row for MANUAL entry (no camera/upload). The
 * client fills the details in the same review wizard. Mirrors uploadReceipt's
 * minimal insert (money/category fields are set later via submitReceiptReview,
 * server-side; CLAUDE.md §9/§14) — just without a storage_path.
 */
export async function createManualReceipt(
  firmId: string,
  clientId: string,
  uploadedBy: string,
): Promise<UploadReceiptResult> {
  assertSupabaseConfigured();
  const { data, error } = await supabase
    .from('receipts')
    .insert({ firm_id: firmId, client_id: clientId, uploaded_by: uploadedBy, status: 'uploaded' })
    .select('id')
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, receiptId: data.id as string };
}

/**
 * Expense categories the client picks in the capture wizard. Each maps to a
 * SUGGESTED GL code/name — a hint for the accountant, who maps it to the real
 * Odoo account on approval. Nothing here posts to the ledger (CLAUDE.md §14).
 */
export interface ExpenseCategory {
  key: string;
  label: string;
  glCode: string;
  glName: string;
  icon: string;
}

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  { key: 'office', label: 'Office Supplies', glCode: '6010', glName: 'Office Supplies', icon: 'briefcase-outline' },
  { key: 'travel', label: 'Travel & Transport', glCode: '6020', glName: 'Travel & Transport', icon: 'airplane-outline' },
  { key: 'meals', label: 'Meals & Entertainment', glCode: '6030', glName: 'Meals & Entertainment', icon: 'restaurant-outline' },
  { key: 'software', label: 'Software & Subscriptions', glCode: '6040', glName: 'Software & Subscriptions', icon: 'cloud-outline' },
  { key: 'rent', label: 'Rent', glCode: '6050', glName: 'Rent', icon: 'business-outline' },
  { key: 'utilities', label: 'Utilities', glCode: '6060', glName: 'Utilities', icon: 'flash-outline' },
  { key: 'professional', label: 'Professional Fees', glCode: '6070', glName: 'Professional Fees', icon: 'document-text-outline' },
  { key: 'marketing', label: 'Marketing & Advertising', glCode: '6080', glName: 'Marketing & Advertising', icon: 'megaphone-outline' },
  { key: 'telecom', label: 'Telephone & Internet', glCode: '6090', glName: 'Telephone & Internet', icon: 'call-outline' },
  { key: 'bank', label: 'Bank Charges', glCode: '6100', glName: 'Bank Charges', icon: 'card-outline' },
  { key: 'other', label: 'Other Expenses', glCode: '6900', glName: 'Other Expenses', icon: 'ellipsis-horizontal' },
];

/**
 * Translation key for a stored category. Receipts keep the English `label`
 * (the accountant and the books read it), so screens translate for display
 * only. Returns null for a category that is not one of ours.
 */
export function expenseCategoryKey(label: string): string | null {
  const match = EXPENSE_CATEGORIES.find((c) => c.label === label);
  return match ? `expenseCategories.${match.key}` : null;
}

export interface ExtractedReceipt {
  vendor: string | null;
  date: string | null;
  totalMinor: number | null;
  vatMinor: number | null;
  currency: string | null;
  confidence: number | null;
}

/** Kick off OCR extraction on an uploaded receipt (server-side, via the
 * receipt-ocr edge function). Returns the extracted draft fields, or null
 * when the OCR service isn't wired yet (the wizard then starts blank). */
export async function extractReceipt(
  receiptId: string,
): Promise<{ extracted: ExtractedReceipt | null; ocrConfigured: boolean }> {
  const { data, error } = await supabase.functions.invoke('receipt-ocr', { body: { action: 'extract', receiptId } });
  if (error || !data?.ok) return { extracted: null, ocrConfigured: false };
  return { extracted: (data.extracted as ExtractedReceipt | null) ?? null, ocrConfigured: Boolean(data.ocrConfigured) };
}

/** Submit the client's confirmed fields + picked category/GL suggestion. The
 * receipt moves to needs_review for the accountant. */
export async function submitReceiptReview(input: {
  receiptId: string;
  category: string;
  glCode: string;
  glName: string;
  vendor: string | null;
  date: string | null;
  totalMinor: number | null;
  vatMinor: number | null;
  currency: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  const { data, error } = await supabase.functions.invoke('receipt-ocr', { body: { action: 'submit', ...input } });
  if (error || !data?.ok) return { ok: false, error: error?.message ?? data?.error ?? i18n.t('errors.saveFailed') };
  return { ok: true };
}

export type ReceiptStatus = 'uploaded' | 'extracting' | 'extracted' | 'needs_review' | 'approved' | 'rejected' | 'posted';

export interface MyReceipt {
  id: string;
  status: ReceiptStatus;
  vendorName: string | null;
  receiptDate: string | null;
  totalMinor: number | null;
  currency: string | null;
  category: string | null;
  createdAt: string;
}

/** The client's own receipts, newest first (RLS "receipts client read":
 * client_id = user_client(auth.uid()), so no client filter needed here). */
export async function listMyReceipts(): Promise<MyReceipt[]> {
  const { data, error } = await supabase
    .from('receipts')
    .select('id, status, vendor_name, receipt_date, total_amount, currency, category, created_at')
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  return ((data ?? []) as {
    id: string; status: string; vendor_name: string | null; receipt_date: string | null;
    total_amount: number | null; currency: string | null; category: string | null; created_at: string;
  }[]).map((r) => ({
    id: r.id,
    status: r.status as ReceiptStatus,
    vendorName: r.vendor_name,
    receiptDate: r.receipt_date,
    totalMinor: r.total_amount,
    currency: r.currency,
    category: r.category,
    createdAt: r.created_at,
  }));
}
