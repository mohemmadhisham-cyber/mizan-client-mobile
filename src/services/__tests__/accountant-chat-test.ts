import * as FileSystem from 'expo-file-system/legacy';

import {
  accountantChatService,
  deleteOwnedCopy,
  isAudioMime,
  isImageAttachment,
  isImageMime,
  looksLikePdf,
  resolveDocumentMime,
  storedExtension,
} from '@/services/accountant-chat';

const mockUpload = jest.fn();
const mockInsert = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: {
    storage: { from: () => ({ upload: (...args: unknown[]) => mockUpload(...args) }) },
    from: () => ({ insert: (...args: unknown[]) => mockInsert(...args) }),
  },
}));
jest.mock('@/i18n', () => ({ __esModule: true, default: { t: (key: string) => key }, currentLocale: () => 'en' }));
jest.mock('expo-file-system/legacy', () => ({ getInfoAsync: jest.fn(), deleteAsync: jest.fn(async () => {}) }));

const mockInfo = FileSystem.getInfoAsync as jest.Mock;
const mockDelete = FileSystem.deleteAsync as jest.Mock;
const TEN_MB = 10 * 1024 * 1024;

/** The bytes of a file that starts the way a PDF does. */
function pdfBytes(length = 64): ArrayBuffer {
  const bytes = new Uint8Array(length);
  bytes.set([0x25, 0x50, 0x44, 0x46, 0x2d]);
  return bytes.buffer;
}

function fileContains(bytes: ArrayBuffer) {
  globalThis.fetch = jest.fn(async () => ({ arrayBuffer: async () => bytes })) as unknown as typeof fetch;
}

beforeEach(() => {
  mockUpload.mockReset().mockResolvedValue({ error: null });
  mockInsert.mockReset().mockResolvedValue({ error: null });
  mockInfo.mockReset().mockResolvedValue({ exists: true, size: 1000 });
  mockDelete.mockClear();
  fileContains(pdfBytes());
});

const send = (attachment?: { uri: string; mimeType: string; fileName?: string }) =>
  accountantChatService.sendMessage('client-1', 'firm-1', 'user-1', 'Here it is', attachment);

describe('storedExtension', () => {
  test('is decided by the kind of file', () => {
    expect(storedExtension('application/pdf')).toBe('pdf');
    expect(storedExtension('image/jpeg')).toBe('jpg');
    expect(storedExtension('audio/mp4')).toBe('m4a');
  });

  test('gives a neutral ending for a kind the chat does not take', () => {
    expect(storedExtension('text/html')).toBe('bin');
    expect(storedExtension('')).toBe('bin');
    expect(storedExtension('../../etc/passwd')).toBe('bin');
  });
});

describe('resolveDocumentMime', () => {
  test('takes a PDF the phone names as one', () => {
    expect(resolveDocumentMime({ mimeType: 'application/pdf', name: 'anything' })).toBe('application/pdf');
  });

  test('takes a file with no kind reported when its name ends in .pdf', () => {
    expect(resolveDocumentMime({ mimeType: undefined, name: 'March statement.PDF' })).toBe('application/pdf');
    expect(resolveDocumentMime({ mimeType: null, name: 'a.pdf' })).toBe('application/pdf');
  });

  test.each([
    ['no kind and no name', {}],
    ['no kind and another ending', { name: 'statement.docx' }],
    ['no kind and .pdf in the middle', { name: 'statement.pdf.exe' }],
    ['a kind the chat does not take', { mimeType: 'application/zip', name: 'x.pdf' }],
    ['a web page', { mimeType: 'text/html', name: 'x.pdf' }],
  ])('refuses %s: a file is never assumed to be a PDF', (_name, asset) => {
    expect(resolveDocumentMime(asset)).toBeNull();
  });
});

describe('looksLikePdf', () => {
  test('knows a PDF by its first bytes', () => {
    expect(looksLikePdf(pdfBytes())).toBe(true);
  });

  test.each([
    ['an empty file', new ArrayBuffer(0)],
    ['a file shorter than the mark', new Uint8Array([0x25, 0x50]).buffer],
    ['a web page', new TextEncoder().encode('<html><script>').buffer as ArrayBuffer],
    ['a program', new Uint8Array([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00]).buffer],
  ])('is not fooled by %s', (_name, bytes) => {
    expect(looksLikePdf(bytes)).toBe(false);
  });
});

describe('kinds of attachment', () => {
  test('tells images, voice and documents apart', () => {
    expect(isImageMime('image/jpeg')).toBe(true);
    expect(isImageMime('application/pdf')).toBe(false);
    expect(isAudioMime('audio/m4a')).toBe(true);
    expect(isAudioMime('application/pdf')).toBe(false);
  });

  test('judges an old message with no kind recorded by the ending of its stored name', () => {
    expect(isImageAttachment(null, 'firm/client/123-abc.jpg')).toBe(true);
    expect(isImageAttachment(null, 'firm/client/123-abc.HEIC')).toBe(true);
    expect(isImageAttachment(null, 'firm/client/123-abc.pdf')).toBe(false);
    expect(isImageAttachment(null, null)).toBe(false);
  });

  test('believes the recorded kind over the name', () => {
    expect(isImageAttachment('application/pdf', 'firm/client/123-abc.jpg')).toBe(false);
    expect(isImageAttachment('image/png', 'firm/client/123-abc.pdf')).toBe(true);
  });
});

describe('a copy made for sending', () => {
  test('is deleted', () => {
    deleteOwnedCopy({ uri: 'file:///cache/statement.pdf', mimeType: 'application/pdf', ownedCopy: true });

    expect(mockDelete).toHaveBeenCalledWith('file:///cache/statement.pdf', { idempotent: true });
  });

  test('is the only thing deleted: a photo in the library is not the app’s to delete', () => {
    deleteOwnedCopy({ uri: 'file:///photos/IMG_1.jpg', mimeType: 'image/jpeg' });
    deleteOwnedCopy(null);

    expect(mockDelete).not.toHaveBeenCalled();
  });
});

describe('sending a message', () => {
  test('sends words alone without touching storage', async () => {
    expect(await send()).toEqual({ ok: true });

    expect(mockUpload).not.toHaveBeenCalled();
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ client_id: 'client-1', firm_id: 'firm-1', sender_user_id: 'user-1', body: 'Here it is', attachment_path: null }),
    );
  });

  test('stores a PDF under the firm and the client, with a made-up name', async () => {
    const result = await send({ uri: 'file:///cache/statement.pdf', mimeType: 'application/pdf', fileName: 'March statement.pdf' });

    expect(result).toEqual({ ok: true });
    const [path, , options] = mockUpload.mock.calls[0];
    expect(path).toMatch(/^firm-1\/client-1\/\d+-[a-z0-9]+\.pdf$/);
    expect(path).not.toContain('March');
    expect(options).toEqual({ contentType: 'application/pdf' });
    expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({ attachment_path: path, attachment_mime: 'application/pdf' }));
  });

  test.each([
    'x.pdf.exe',
    'x.html',
    '../../other-firm/other-client/x.pdf/../../y',
    'no-ending',
  ])('stores "%s" as a .pdf under this client: the name chooses nothing', async (fileName) => {
    await send({ uri: 'file:///cache/x', mimeType: 'application/pdf', fileName });

    expect(mockUpload.mock.calls[0][0]).toMatch(/^firm-1\/client-1\/\d+-[a-z0-9]+\.pdf$/);
  });

  test('refuses a file that claims to be a PDF and is not one', async () => {
    fileContains(new TextEncoder().encode('<html><script>alert(1)</script>').buffer as ArrayBuffer);

    const result = await send({ uri: 'file:///cache/x.pdf', mimeType: 'application/pdf' });

    expect(result).toEqual({ ok: false, error: 'errors.fileTypeUnsupported' });
    expect(mockUpload).not.toHaveBeenCalled();
    expect(mockInsert).not.toHaveBeenCalled();
  });

  test.each(['application/zip', 'text/html', 'application/x-msdownload', 'image/svg+xml', ''])(
    'refuses a "%s" file before reading or sending anything',
    async (mimeType) => {
      const result = await send({ uri: 'file:///cache/x', mimeType });

      expect(result).toEqual({ ok: false, error: 'errors.fileTypeUnsupported' });
      expect(mockInfo).not.toHaveBeenCalled();
      expect(mockUpload).not.toHaveBeenCalled();
      expect(mockInsert).not.toHaveBeenCalled();
    },
  );

  test('refuses a file over 10 MB', async () => {
    mockInfo.mockResolvedValue({ exists: true, size: TEN_MB + 1 });

    const result = await send({ uri: 'file:///cache/big.pdf', mimeType: 'application/pdf' });

    expect(result).toEqual({ ok: false, error: 'errors.attachmentTooLarge' });
    expect(mockUpload).not.toHaveBeenCalled();
  });

  test('refuses a file over 10 MB even when the phone reports no size', async () => {
    mockInfo.mockResolvedValue({ exists: true });
    fileContains(pdfBytes(TEN_MB + 1));

    const result = await send({ uri: 'file:///cache/big.pdf', mimeType: 'application/pdf' });

    expect(result).toEqual({ ok: false, error: 'errors.attachmentTooLarge' });
    expect(mockUpload).not.toHaveBeenCalled();
  });

  test('takes a file of exactly 10 MB', async () => {
    mockInfo.mockResolvedValue({ exists: true, size: TEN_MB });

    expect(await send({ uri: 'file:///cache/big.pdf', mimeType: 'application/pdf' })).toEqual({ ok: true });
  });

  test('refuses a file that is no longer there', async () => {
    mockInfo.mockResolvedValue({ exists: false });

    expect(await send({ uri: 'file:///cache/gone.pdf', mimeType: 'application/pdf' })).toEqual({ ok: false, error: 'errors.fileUnreadable' });
  });

  test('sends no message when the file could not be stored', async () => {
    mockUpload.mockResolvedValue({ error: { message: 'new row violates row-level security policy' } });

    const result = await send({ uri: 'file:///cache/x.pdf', mimeType: 'application/pdf' });

    expect(result).toEqual({ ok: false, error: 'errors.attachmentUploadFailed' });
    expect(mockInsert).not.toHaveBeenCalled();
  });

  test('sends a photo without asking it to look like a PDF', async () => {
    fileContains(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]).buffer);

    expect(await send({ uri: 'file:///photos/IMG_1.jpg', mimeType: 'image/jpeg' })).toEqual({ ok: true });
    expect(mockUpload.mock.calls[0][0]).toMatch(/\.jpg$/);
  });
});
