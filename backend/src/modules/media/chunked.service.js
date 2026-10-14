// Resumable uploads: the file arrives in small chunks, the server always knows how many bytes it has, so a dropped connection never restarts the file.
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

export const CHUNK_SIZE = 4 * 1024 * 1024;
export const MAX_SIZE = 500 * 1024 * 1024;
export const TTL_MS = 24 * 3600 * 1000;
export const ALLOWED = { 'video/mp4': '.mp4', 'video/webm': '.webm', 'video/quicktime': '.mov', 'audio/mpeg': '.mp3', 'audio/wav': '.wav', 'audio/x-wav': '.wav', 'audio/mp4': '.m4a', 'audio/x-m4a': '.m4a', 'audio/aac': '.aac', 'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp' };
const FAMILY = { 'video/mp4': ['mp4'], 'video/quicktime': ['mp4'], 'audio/mp4': ['mp4'], 'audio/x-m4a': ['mp4'], 'video/webm': ['webm'], 'audio/wav': ['wav'], 'audio/x-wav': ['wav'], 'audio/mpeg': ['mp3'], 'audio/aac': ['mp3'], 'image/png': ['png'], 'image/jpeg': ['jpeg'], 'image/webp': ['webp'] };
export const typeOf = (mime) => (mime.startsWith('video/') ? 'VIDEO' : mime.startsWith('audio/') ? 'AUDIO' : 'IMAGE');

// Never trust the declared type: look at the first bytes of the real file.
export function sniff(buf) {
  if (buf.length < 12) return null;
  const s = (a, b) => buf.toString('latin1', a, b);
  if (s(4, 8) === 'ftyp') return 'mp4';
  if (buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) return 'webm';
  if (buf[0] === 0x89 && s(1, 4) === 'PNG') return 'png';
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpeg';
  if (s(0, 4) === 'RIFF' && s(8, 12) === 'WEBP') return 'webp';
  if (s(0, 4) === 'RIFF' && s(8, 12) === 'WAVE') return 'wav';
  if (s(0, 3) === 'ID3' || (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0)) return 'mp3';
  return null;
}

export function createChunkStore(dir, { now = Date.now, chunkSize = CHUNK_SIZE } = {}) {
  const metaP = (id) => path.join(dir, `${id}.json`), partP = (id) => path.join(dir, `${id}.part`), locks = new Map();
  const exists = (p) => fs.stat(p).then(() => true, () => false);
  const writeMeta = (m) => fs.writeFile(metaP(m.id), JSON.stringify(m));
  const serial = (id, fn) => { const next = (locks.get(id) || Promise.resolve()).then(fn, fn); locks.set(id, next.catch(() => {})); return next; }; // two chunks of one upload never run at the same time

  async function load(id, userId) {
    if (!/^[0-9a-f-]{36}$/.test(String(id))) return null;
    let m; try { m = JSON.parse(await fs.readFile(metaP(id), 'utf8')); } catch { return null; }
    if (m.userId !== userId) return null; // someone else's upload looks like it does not exist
    const received = m.result ? m.size : await fs.stat(partP(id)).then((s) => s.size, () => 0);
    return { ...m, received };
  }
  return {
    load, chunkSize,
    async create({ userId, name, size, mime, projectId, duration }) {
      if (!ALLOWED[mime]) throw Object.assign(new Error('Unsupported file type'), { status: 415 });
      if (!Number.isInteger(size) || size < 1 || size > MAX_SIZE) throw Object.assign(new Error('File too large (max 500MB)'), { status: 413 });
      await fs.mkdir(dir, { recursive: true });
      const id = crypto.randomUUID();
      await writeMeta({ id, userId, name, size, mime, projectId: projectId || null, duration: duration || null, createdAt: now() });
      await fs.writeFile(partP(id), '');
      return { id, chunkSize };
    },
    append: (id, userId, offset, buf) => serial(id, async () => {
      const m = await load(id, userId);
      if (!m || m.result) return { status: 404, error: 'Upload not found' };
      if (offset !== m.received) return { status: 409, error: 'Offset mismatch', received: m.received }; // client continues from where the server is
      if (buf.length === 0 || buf.length > chunkSize || m.received + buf.length > m.size) return { status: 413, error: 'Chunk too large' };
      await fs.appendFile(partP(id), buf);
      return { received: m.received + buf.length };
    }),
    async finalize(id, userId) {
      const m = await load(id, userId);
      if (!m) return { status: 404, error: 'Upload not found' };
      if (m.result) return { result: m.result }; // already completed (retry after a lost reply)
      if (m.received !== m.size) return { status: 409, error: 'Upload is not complete', received: m.received };
      const fh = await fs.open(partP(id), 'r'), head = Buffer.alloc(16); await fh.read(head, 0, 16, 0); await fh.close();
      if (!(FAMILY[m.mime] || []).includes(sniff(head))) { await this.discard(id); return { status: 415, error: 'The file content does not match its type' }; }
      return { path: partP(id), meta: m, mime: m.mime, ext: ALLOWED[m.mime], type: typeOf(m.mime) };
    },
    async markDone(id, result) { const m = JSON.parse(await fs.readFile(metaP(id), 'utf8')); await writeMeta({ ...m, result, doneAt: now() }); },
    async discard(id) { await fs.unlink(partP(id)).catch(() => {}); await fs.unlink(metaP(id)).catch(() => {}); },
    async sweep() { // remove abandoned uploads (older than 24 h)
      let n = 0; let files = []; try { files = await fs.readdir(dir); } catch { return 0; }
      for (const f of files.filter((x) => x.endsWith('.json'))) {
        try { const m = JSON.parse(await fs.readFile(path.join(dir, f), 'utf8')); if (now() - (m.doneAt || m.createdAt) > TTL_MS) { await this.discard(m.id); n++; } } catch { /* ignore broken meta */ }
      }
      return n;
    },
    exists,
  };
}
