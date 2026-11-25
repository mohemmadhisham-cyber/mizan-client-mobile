import * as FileSystem from 'expo-file-system/legacy';

import { accountantChatService, isAudioMime, isImageMime, storedExtension } from '@/services/accountant-chat';

const mockUpload = jest.fn();
const mockInsert = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: {
    storage: { from: () => ({ upload: (...args: unknown[]) => mockUpload(...args) }) },
    from: () => ({ insert: (...args: unknown[]) => mockInsert(...args) }),
  },
}));
jest.mock('@/i18n', () => ({ __esModule: true, default: { t: (key: string) => key }, currentLocale: () => 'en' }));
jest.mock('expo-file-system/legacy', () => ({ getInfoAsync: jest.fn() }));

const mockInfo = FileSystem.getInfoAsync as jest.Mock;
const TEN_MB = 10 * 1024 * 1024;

beforeEach(() => {
  mockUpload.mockReset().mockResolvedValue({ error: null });
  mockInsert.mockReset().mockResolvedValue({ error: null });
  mockInfo.mockReset().mockResolvedValue({ exists: true, size: 1000 });
  globalThis.fetch = jest.fn(async () => ({ arrayBuffer: async () => new ArrayBuffer(8) })) as unknown as typeof fetch;
});

const send = (attachment?: { uri: string; mimeType: string; fileName?: string }) =>
  accountantChatService.sendMessage('client-1', 'firm-1', 'user-1', 'Here it is', attachment);

describe('storedExtension', () => {
  test('uses the ending of the file name when it is plain', () => {
    expect(storedExtension('March statement.PDF', 'application/pdf')).toBe('pdf');
    expect(storedExtension('photo.jpeg', 'image/jpeg')).toBe('jpeg');
  });

  test.each([
    ['a path that climbs out', '../../etc/passwd'],
    ['an ending with a slash', 'a.b/c'],
    ['an ending that is too long', 'file.verylongextension'],
    ['an ending with odd characters', 'file.p d f'],
    ['a name with no ending', 'statement'],
    ['no name at all', undefined],
  ])('falls back to the kind of file for %s', (_name, fileName) => {
    expect(storedExtension(fileName, 'application/pdf')).toBe('pdf');
  });

  test('gives a neutral ending when neither the name nor the kind is usable', () => {
    expect(storedExtension(undefined, 'application/vnd.something+weird')).toBe('bin');
    expect(storedExtension('x', '')).toBe('bin');
  });
});

describe('kinds of attachment', () => {
  test('tells images, voice and documents apart', () => {
    expect(isImageMime('image/jpeg')).toBe(true);
    expect(isImageMime('application/pdf')).toBe(false);
    expect(isImageMime(null)).toBe(false);
    expect(isAudioMime('audio/m4a')).toBe(true);
    expect(isAudioMime('application/pdf')).toBe(false);
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

  test('never lets a file name choose where the file is stored', async () => {
    await send({ uri: 'file:///cache/x', mimeType: 'application/pdf', fileName: '../../other-firm/other-client/x.pdf/../../y' });

    const [path] = mockUpload.mock.calls[0];
    expect(path).toMatch(/^firm-1\/client-1\/\d+-[a-z0-9]+\.pdf$/);
  });

  test.each(['application/zip', 'text/html', 'application/x-msdownload', 'image/svg+xml'])(
    'refuses a %s file before reading or sending anything',
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
});
