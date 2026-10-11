import * as FS from 'expo-file-system/legacy';
import { api } from './api';
import { API_URL } from '../config';

const wait = (ms) => new Promise((ok) => setTimeout(ok, ms));
// Uploads one file with progress. Network/5xx errors are retried with backoff; 4xx (wrong type, too big, plan limit) fail immediately with the server message.
export async function uploadMedia({ projectId, uri, mime, duration, onProgress, attempts = 3 }) {
  let last;
  for (let i = 0; i < attempts; i++) {
    try {
      const token = await api.getAccessToken();
      const task = FS.createUploadTask(`${API_URL}/media/upload`, uri, {
        httpMethod: 'POST', uploadType: FS.FileSystemUploadType.MULTIPART, fieldName: 'file', mimeType: mime,
        headers: { Authorization: `Bearer ${token}`, 'X-Client': 'mobile' }, parameters: { projectId, ...(duration ? { duration: String(duration) } : {}) },
      }, (p) => onProgress?.(p.totalBytesExpectedToSend ? p.totalBytesSent / p.totalBytesExpectedToSend : 0));
      const r = await task.uploadAsync();
      const body = JSON.parse(r?.body || '{}');
      if (r && r.status >= 200 && r.status < 300) return body;
      if (r?.status === 401) { await api.refresh(); last = new Error('Session refresh needed'); }
      else if (r && r.status < 500) throw Object.assign(new Error(body.error || `Upload failed (${r.status})`), { fatal: true });
      else last = new Error(body.error || `Server error (${r?.status})`);
    } catch (e) { if (e.fatal) throw e; last = e; }
    if (i < attempts - 1) await wait(800 * 2 ** i);
  }
  throw new Error(last?.message || 'Upload failed. Check your internet connection and retry.');
}
