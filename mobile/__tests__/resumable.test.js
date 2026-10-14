jest.mock('expo-file-system/legacy', () => ({ getInfoAsync: jest.fn(), readAsStringAsync: jest.fn(), createUploadTask: jest.fn(), EncodingType: { Base64: 'base64' }, FileSystemUploadType: { MULTIPART: 1 } }));
jest.mock('expo-secure-store', () => ({ getItemAsync: jest.fn(async () => null), setItemAsync: jest.fn(async () => {}), deleteItemAsync: jest.fn(async () => {}) }));
jest.mock('../src/services/api', () => ({ api: { request: jest.fn(), getAccessToken: jest.fn(async () => 'TOKEN'), refresh: jest.fn() } }));
jest.mock('../src/config', () => ({ API_URL: 'https://api.test/api' }));
import * as FS from 'expo-file-system/legacy';
import * as SecureStore from 'expo-secure-store';
import { api } from '../src/services/api';
import { uploadMedia } from '../src/services/upload';
import { b64ToBytes } from '../src/shared/bytes.js';
import { resumableUpload } from '../src/shared/resumableUpload.js';
import { ApiError } from '../src/shared/apiClient.js';

const CONTENT = Buffer.from('ABCDEFGHIJKLMNOPQRSTUVWXYZ'); // 26 bytes, server chunk size 10 => 3 chunks
beforeEach(() => { jest.clearAllMocks(); FS.getInfoAsync.mockResolvedValue({ exists: true, size: CONTENT.length }); FS.readAsStringAsync.mockImplementation(async (u, o) => CONTENT.subarray(o.position, o.position + o.length).toString('base64')); });

test('b64ToBytes matches Buffer for every length and for a big chunk', () => {
  for (let n = 0; n < 12; n++) { const b = Buffer.from(Array.from({ length: n }, (_, i) => (i * 37 + 11) & 255)); expect(Buffer.from(b64ToBytes(b.toString('base64')))).toEqual(b); }
  const big = Buffer.from(Array.from({ length: 300001 }, (_, i) => (i * 7919) & 255)); expect(Buffer.from(b64ToBytes(big.toString('base64'))).equals(big)).toBe(true);
});
test('uploadMedia reads the file in chunks (position/length), sends them in order and returns the media record', async () => {
  const got = []; let received = 0;
  api.request.mockImplementation(async (path, o) => {
    if (path === '/media/uploads') return { uploadId: 'U1', chunkSize: 10, received: 0 };
    if (path === '/media/uploads/U1' && o.method === 'PATCH') { expect(Number(o.headers['Upload-Offset'])).toBe(received); expect(o.raw).toBe(true); got.push(Buffer.from(o.body).toString()); received += o.body.length; return { received }; }
    if (path.endsWith('/complete')) return { id: 'm1', duration: 3 }; throw new Error(`unexpected ${path}`);
  });
  const progress = []; const media = await uploadMedia({ projectId: 'p1', uri: 'file:///cache/My%20clip.mp4', mime: 'video/mp4', onProgress: (p) => progress.push(p) });
  expect(got).toEqual(['ABCDEFGHIJ', 'KLMNOPQRST', 'UVWXYZ']); expect(media).toEqual({ id: 'm1', duration: 3 });
  expect(FS.readAsStringAsync.mock.calls.map((c) => [c[1].position, c[1].length])).toEqual([[0, 10], [10, 10], [20, 6]]); expect(progress.at(-1)).toBe(1);
  expect(api.request.mock.calls[0][1].body).toMatchObject({ name: 'My clip.mp4', size: 26, mime: 'video/mp4', projectId: 'p1' });
  expect(SecureStore.deleteItemAsync).toHaveBeenCalled();                                  // resume record removed once finished
});
test('an unfinished upload of the same file is resumed from the server offset (nothing is re-sent)', async () => {
  SecureStore.getItemAsync.mockResolvedValueOnce('U9'); const sent = [];
  api.request.mockImplementation(async (path, o) => { if (o.method === 'GET') return { uploadId: 'U9', received: 20, chunkSize: 10, size: 26 }; if (o.method === 'PATCH') { sent.push(o.headers['Upload-Offset']); return { received: 26 }; } return { id: 'm2' }; });
  await uploadMedia({ projectId: 'p1', uri: 'file:///cache/a.mp4', mime: 'video/mp4' }); expect(sent).toEqual(['20']); expect(FS.readAsStringAsync).toHaveBeenCalledTimes(1);
});
test('an old server without /media/uploads falls back to the one-shot upload; a real "project not found" does not', async () => {
  api.request.mockRejectedValueOnce(new ApiError('Request failed (404)', 404, false, {}));
  FS.createUploadTask.mockReturnValue({ uploadAsync: async () => ({ status: 201, body: JSON.stringify({ id: 'legacy' }) }) });
  expect((await uploadMedia({ projectId: 'p1', uri: 'file:///a.mp4', mime: 'video/mp4' })).id).toBe('legacy'); expect(FS.createUploadTask).toHaveBeenCalled();
  api.request.mockRejectedValueOnce(new ApiError('Project not found', 404, false, { error: 'Project not found' })); FS.createUploadTask.mockClear();
  await expect(uploadMedia({ projectId: 'nope', uri: 'file:///a.mp4', mime: 'video/mp4' })).rejects.toThrow('Project not found'); expect(FS.createUploadTask).not.toHaveBeenCalled();
});
test('offline gives a friendly message; a deleted source file is reported', async () => {
  api.request.mockRejectedValue(new ApiError('Network error', 0, true)); const fast = jest.spyOn(global, 'setTimeout').mockImplementation((fn) => { fn(); return 0; });
  await expect(uploadMedia({ projectId: 'p1', uri: 'file:///a.mp4', mime: 'video/mp4' })).rejects.toThrow('No internet connection'); fast.mockRestore();
  FS.getInfoAsync.mockResolvedValue({ exists: false }); await expect(uploadMedia({ projectId: 'p1', uri: 'file:///gone.mp4', mime: 'video/mp4' })).rejects.toThrow('no longer available');
});
test('shared client: a lost reply (409 with the real offset) makes it continue from the server, never duplicating bytes', async () => {
  let server = 0; const log = [];
  const request = async (m, p, o = {}) => { if (p === '/media/uploads') return { uploadId: 'X', chunkSize: 10, received: 0 };
    if (m === 'PATCH') { const off = Number(o.headers['Upload-Offset']); log.push(off); if (off !== server) throw Object.assign(new Error('mismatch'), { status: 409, data: { received: server } }); server += o.raw.length; if (log.length === 1) throw Object.assign(new Error('net'), { network: true }); return { received: server }; } return { id: 'ok' }; };
  await resumableUpload({ request, readChunk: async (o, l) => CONTENT.subarray(o, o + l), file: { name: 'a', size: 26, mime: 'video/mp4' }, sleep: async () => {} }); expect(server).toBe(26); expect(log).toEqual([0, 0, 10, 20]);
});
