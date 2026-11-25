// The classic file functions live under /legacy. Imported from the package root they
// are stubs that throw when called, so every upload and recording failed.
import * as FileSystem from 'expo-file-system/legacy';

import i18n from '@/i18n';
import { supabase } from '@/lib/supabase';

export interface ChatMessage {
  id: string;
  senderUserId: string;
  senderRole: string;
  body: string;
  attachmentPath: string | null;
  attachmentMime: string | null;
  createdAt: string;
}

export interface ChatAttachment {
  uri: string;
  mimeType: string;
  fileName?: string;
  /** The file at `uri` is a copy the app made for sending: it is deleted once it is sent or dropped. */
  ownedCopy?: boolean;
}

interface MessageRow {
  id: string;
  sender_user_id: string;
  sender_role: string;
  body: string;
  attachment_path: string | null;
  attachment_mime: string | null;
  created_at: string;
}

const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/heic', 'image/webp', 'application/pdf', 'audio/m4a', 'audio/mp4']);

export function isAudioMime(mime: string | null): boolean {
  return !!mime && mime.startsWith('audio/');
}

export function isImageMime(mime: string | null): boolean {
  return !!mime && mime.startsWith('image/');
}

const IMAGE_ENDING = /\.(jpe?g|png|heic|webp)$/i;

/**
 * Whether a stored attachment is a picture. Its kind says so; an old message
 * with no kind recorded is judged by the ending of its stored name, since
 * pictures were the only attachments before kinds were recorded.
 */
export function isImageAttachment(mime: string | null, path: string | null): boolean {
  if (mime) return isImageMime(mime);
  return !!path && IMAGE_ENDING.test(path);
}

/**
 * The kind of a file chosen as a document: what the phone reports when it is
 * a kind the chat takes, and otherwise judged by a `.pdf` ending. Null when
 * it cannot be told: the file is then refused, never assumed to be a PDF.
 */
export function resolveDocumentMime(asset: { mimeType?: string | null; name?: string | null }): string | null {
  if (asset.mimeType && (DOCUMENT_MIME_TYPES as readonly string[]).includes(asset.mimeType)) return asset.mimeType;
  if (!asset.mimeType && asset.name && /\.pdf$/i.test(asset.name)) return 'application/pdf';
  return null;
}

const PDF_START = [0x25, 0x50, 0x44, 0x46, 0x2d]; // "%PDF-"

/** A PDF says so in its first five bytes. A file that claims to be one and does not is not sent. */
export function looksLikePdf(bytes: ArrayBuffer): boolean {
  const start = new Uint8Array(bytes.slice(0, PDF_START.length));
  return start.length === PDF_START.length && PDF_START.every((byte, index) => start[index] === byte);
}

/** Deletes a copy the app made of a chosen file. Best effort: the phone clears its cache anyway. */
export function deleteOwnedCopy(attachment: ChatAttachment | null): void {
  if (!attachment?.ownedCopy) return;
  FileSystem.deleteAsync(attachment.uri, { idempotent: true }).catch(() => {});
}

/** The kinds of document the chat takes, for the file chooser. Images and voice have their own ways in. */
export const DOCUMENT_MIME_TYPES = ['application/pdf'] as const;

const EXTENSION_FOR_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/heic': 'heic',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
  'audio/m4a': 'm4a',
  'audio/mp4': 'm4a',
};

/**
 * The ending a stored file gets: decided by its kind alone. The file's own
 * name is chosen by whoever made the file and is never used, so a file called
 * "statement.pdf.exe" is stored as what it was sent as, not as what it is called.
 */
export function storedExtension(mimeType: string): string {
  return EXTENSION_FOR_MIME[mimeType] ?? 'bin';
}

function fromRow(r: MessageRow): ChatMessage {
  return {
    id: r.id,
    senderUserId: r.sender_user_id,
    senderRole: r.sender_role,
    body: r.body,
    attachmentPath: r.attachment_path,
    attachmentMime: r.attachment_mime,
    createdAt: r.created_at,
  };
}

let subscriptionCount = 0;

export const accountantChatService = {
  async getMessages(clientId: string): Promise<ChatMessage[]> {
    const { data, error } = await supabase
      .from('accountant_messages')
      .select('id, sender_user_id, sender_role, body, attachment_path, attachment_mime, created_at')
      .eq('client_id', clientId)
      .order('created_at', { ascending: true })
      .limit(200);
    if (error || !data) return [];
    return (data as MessageRow[]).map(fromRow);
  },

  async sendMessage(
    clientId: string,
    firmId: string,
    userId: string,
    body: string,
    attachment?: ChatAttachment,
  ): Promise<{ ok: boolean; error?: string }> {
    let attachmentPath: string | null = null;
    let attachmentMime: string | null = null;

    if (attachment) {
      if (!ALLOWED_MIME.has(attachment.mimeType)) {
        return { ok: false, error: i18n.t('errors.fileTypeUnsupported') };
      }
      const info = await FileSystem.getInfoAsync(attachment.uri);
      if (!info.exists) return { ok: false, error: i18n.t('errors.fileUnreadable') };
      if ((info.size ?? 0) > MAX_ATTACHMENT_BYTES) return { ok: false, error: i18n.t('errors.attachmentTooLarge') };

      const ext = storedExtension(attachment.mimeType);
      const path = `${firmId}/${clientId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const bytes = await fetch(attachment.uri).then((r) => r.arrayBuffer());
      // Measured again on the bytes themselves: the phone does not always report a size.
      if (bytes.byteLength > MAX_ATTACHMENT_BYTES) return { ok: false, error: i18n.t('errors.attachmentTooLarge') };
      if (attachment.mimeType === 'application/pdf' && !looksLikePdf(bytes)) {
        return { ok: false, error: i18n.t('errors.fileTypeUnsupported') };
      }
      const { error: uploadError } = await supabase.storage.from('chat-attachments').upload(path, bytes, {
        contentType: attachment.mimeType,
      });
      if (uploadError) return { ok: false, error: i18n.t('errors.attachmentUploadFailed') };
      attachmentPath = path;
      attachmentMime = attachment.mimeType;
    }

    const { error } = await supabase.from('accountant_messages').insert({
      client_id: clientId,
      firm_id: firmId,
      sender_user_id: userId,
      sender_role: 'client_user',
      body,
      attachment_path: attachmentPath,
      attachment_mime: attachmentMime,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  },

  async getAttachmentUrl(path: string): Promise<string | null> {
    const { data, error } = await supabase.storage.from('chat-attachments').createSignedUrl(path, 60 * 10);
    if (error || !data) return null;
    return data.signedUrl;
  },

  subscribeToMessages(clientId: string, onInsert: (message: ChatMessage) => void) {
    // One channel per open view: two views on one topic would share, and close, each other's.
    subscriptionCount += 1;
    const channel = supabase
      .channel(`accountant-messages-${clientId}-${subscriptionCount}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'accountant_messages', filter: `client_id=eq.${clientId}` },
        (payload) => onInsert(fromRow(payload.new as MessageRow)),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  },
};
