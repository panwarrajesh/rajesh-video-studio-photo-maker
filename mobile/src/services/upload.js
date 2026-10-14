import * as FS from 'expo-file-system/legacy';
import * as SecureStore from 'expo-secure-store';
import { api } from './api';
import { API_URL } from '../config';
import { resumableUpload } from '../shared/resumableUpload.js';
import { b64ToBytes } from '../shared/bytes.js';

const wait = (ms) => new Promise((ok) => setTimeout(ok, ms));
const keyOf = (uri, size) => { let h = 5381; for (const ch of `${uri}|${size}`) h = ((h * 33) ^ ch.charCodeAt(0)) >>> 0; return `rvs_up_${h.toString(16)}`; };

// Old servers (without /media/uploads) still work: one-shot multipart upload with retry.
async function uploadMultipart({ projectId, uri, mime, duration, onProgress, attempts = 3 }) {
  let last;
  for (let i = 0; i < attempts; i++) {
    try {
      const token = await api.getAccessToken();
      const task = FS.createUploadTask(`${API_URL}/media/upload`, uri, {
        httpMethod: 'POST', uploadType: FS.FileSystemUploadType.MULTIPART, fieldName: 'file', mimeType: mime,
        headers: { Authorization: `Bearer ${token}`, 'X-Client': 'mobile' }, parameters: { projectId, ...(duration ? { duration: String(duration) } : {}) },
      }, (p) => onProgress?.(p.totalBytesExpectedToSend ? p.totalBytesSent / p.totalBytesExpectedToSend : 0));
      const r = await task.uploadAsync(), body = JSON.parse(r?.body || '{}');
      if (r && r.status >= 200 && r.status < 300) return body;
      if (r?.status === 401) { await api.refresh(); last = new Error('Session refresh needed'); }
      else if (r && r.status < 500) throw Object.assign(new Error(body.error || `Upload failed (${r.status})`), { fatal: true });
      else last = new Error(body.error || `Server error (${r?.status})`);
    } catch (e) { if (e.fatal) throw e; last = e; }
    if (i < attempts - 1) await wait(800 * 2 ** i);
  }
  throw new Error(last?.message || 'Upload failed. Check your internet connection and retry.');
}

// Chunked + resumable: a lost connection continues from the last chunk the server has (never restarts a big video).
export async function uploadMedia({ projectId, uri, mime, duration, onProgress }) {
  const info = await FS.getInfoAsync(uri);
  if (!info.exists) throw new Error('The selected file is no longer available.');
  const key = keyOf(uri, info.size), name = decodeURIComponent(uri.split('/').pop() || 'media');
  try {
    return await resumableUpload({
      file: { name, size: info.size, mime, projectId, duration },
      request: (method, path, o = {}) => api.request(path, { method, body: o.json ?? o.raw, headers: o.headers, raw: !!o.raw }),
      readChunk: async (offset, length) => b64ToBytes(await FS.readAsStringAsync(uri, { encoding: FS.EncodingType.Base64, position: offset, length })),
      onProgress, sleep: wait,
      resume: { get: () => SecureStore.getItemAsync(key), set: (v) => SecureStore.setItemAsync(key, v), clear: () => SecureStore.deleteItemAsync(key) },
    });
  } catch (e) {
    if (e.status === 404 && !e.data?.error) return uploadMultipart({ projectId, uri, mime, duration, onProgress }); // server too old
    throw new Error(e.network ? 'No internet connection. Try again when you are online.' : e.message);
  }
}
