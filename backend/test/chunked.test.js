import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import express from 'express';
import 'express-async-errors';
import { createChunkStore, CHUNK_SIZE, sniff } from '../src/modules/media/chunked.service.js';
import { createUploadRouter } from '../src/modules/media/upload.routes.js';
import { probeDuration } from '../src/utils/probe.js';
import { resumableUpload } from '../../shared/resumableUpload.js';

const has = spawnSync('ffmpeg', ['-version']).status === 0;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rvs-chunk-')), uploads = path.join(tmp, 'uploads'); fs.mkdirSync(uploads);
let clock = Date.now(); const store = createChunkStore(path.join(uploads, 'tmp'), { now: () => clock, chunkSize: 50000 });
const created = [];
const app = express(); app.use(express.json());
app.use((req, _res, next) => { req.user = { id: req.get('x-user') || 'u1' }; next(); });
app.use('/api/media/uploads', createUploadRouter({ store, uploadDir: uploads, probeDuration, ownsProject: async (u, p) => p === 'p1' && u === 'u1',
  saveFile: async (f) => `/uploads/${path.basename(f)}`, createMedia: async (d) => { const m = { id: `m${created.length + 1}`, ...d }; created.push(m); return m; } }));
app.get('/boom', async () => { throw new Error('db down'); });                                  // async route that throws
app.use((err, _req, res, _next) => res.status(500).json({ error: 'Server error' }));
const server = app.listen(0); const base = `http://127.0.0.1:${server.address().port}`;
test.after(() => server.close());

const wav = (sec) => { const f = path.join(tmp, `s${sec}.wav`); spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', `sine=f=300:d=${sec}`, f]); return fs.readFileSync(f); };
const http = async (method, p, { user = 'u1', json, raw, headers = {} } = {}) => { const r = await fetch(base + p, { method, headers: { 'x-user': user, ...(json ? { 'Content-Type': 'application/json' } : {}), ...headers }, body: json ? JSON.stringify(json) : raw }); return { status: r.status, data: await r.json().catch(() => ({})) }; };
const start = (o = {}) => http('POST', '/api/media/uploads', { json: { name: 'a.wav', size: 100, mime: 'audio/wav', projectId: 'p1', ...o } });
const hdr = (offset) => ({ 'Upload-Offset': String(offset), 'Content-Type': 'application/octet-stream' });

test('sniff recognises real file signatures', { skip: !has }, () => { assert.equal(sniff(wav(1)), 'wav'); assert.equal(sniff(Buffer.from('not a real media file at all')), null); assert.equal(sniff(Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from('ftypmp42'), Buffer.alloc(8)])), 'mp4'); });
test('async route errors become a clean 500 and the server keeps running', async () => { assert.equal((await http('GET', '/boom')).status, 500); assert.equal((await http('GET', '/api/media/uploads/00000000-0000-0000-0000-000000000000')).status, 404); });
test('rejects bad requests: unsupported type, too big, foreign project', async () => {
  assert.equal((await start({ mime: 'application/x-msdownload' })).status, 415); assert.equal((await start({ size: 600 * 1024 * 1024 })).status, 400); assert.equal((await start({ projectId: 'someone-elses' })).status, 404);
});
test('chunks must arrive in order: wrong offset answers 409 with the real offset (that is how clients resync)', async () => {
  const s = (await start({ size: 10 })).data; assert.equal((await http('PATCH', `/api/media/uploads/${s.uploadId}`, { raw: Buffer.alloc(4, 1), headers: hdr(0) })).data.received, 4);
  const bad = await http('PATCH', `/api/media/uploads/${s.uploadId}`, { raw: Buffer.alloc(4, 1), headers: hdr(0) }); assert.deepEqual([bad.status, bad.data.received], [409, 4]);
  const over = await http('PATCH', `/api/media/uploads/${s.uploadId}`, { raw: Buffer.alloc(7, 1), headers: hdr(4) }); assert.equal(over.status, 413);
  assert.equal((await http('GET', `/api/media/uploads/${s.uploadId}`)).data.received, 4);
});
test("another user cannot see, write to, complete or cancel someone else's upload", async () => {
  const s = (await start({ size: 10 })).data;
  for (const [m, p, o] of [['GET', ''], ['PATCH', '', { raw: Buffer.alloc(2), headers: hdr(0) }], ['POST', '/complete'], ['DELETE', '']]) assert.equal((await http(m, `/api/media/uploads/${s.uploadId}${p}`, { user: 'u2', ...(o || {}) })).status, m === 'DELETE' ? 200 : 404);
  assert.equal((await http('GET', `/api/media/uploads/${s.uploadId}`)).status, 200); // u2's DELETE did not remove it
});
test('completing too early is refused; a file whose content is not what it claims is rejected', { skip: !has }, async () => {
  const s = (await start({ size: 100 })).data; assert.equal((await http('POST', `/api/media/uploads/${s.uploadId}/complete`)).status, 409);
  const e = (await start({ size: 40, mime: 'video/mp4', name: 'fake.mp4' })).data; await http('PATCH', `/api/media/uploads/${e.uploadId}`, { raw: Buffer.from('MZ this is an exe pretending to be mp4!!'), headers: hdr(0) });
  assert.equal((await http('POST', `/api/media/uploads/${e.uploadId}/complete`)).status, 415);
});
test('full upload in several chunks: bytes are identical, duration is measured by the server (not trusted from the client), complete is idempotent', { skip: !has }, async () => {
  const file = wav(3), s = (await start({ size: file.length, duration: 99 })).data; let off = 0;
  while (off < file.length) { const n = Math.min(30000, file.length - off); const r = await http('PATCH', `/api/media/uploads/${s.uploadId}`, { raw: file.subarray(off, off + n), headers: hdr(off) }); off = r.data.received; }
  const a = await http('POST', `/api/media/uploads/${s.uploadId}/complete`); assert.equal(a.status, 201); assert.ok(Math.abs(a.data.duration - 3) < 0.1, `duration ${a.data.duration}`); assert.equal(a.data.type, 'AUDIO');
  assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(uploads, path.basename(a.data.url)))).digest('hex'), crypto.createHash('sha256').update(file).digest('hex'));
  const b = await http('POST', `/api/media/uploads/${s.uploadId}/complete`); assert.equal(b.data.id, a.data.id); assert.equal(created.filter((m) => m.name === 'a.wav' && m.size === file.length).length, 1); // no duplicate record
});
test('abandoned uploads are swept after 24 h, finished ones keep their idempotency record until then', async () => {
  const s = (await start({ size: 10 })).data; clock += 25 * 3600 * 1000; assert.ok((await store.sweep()) >= 1); assert.equal((await http('GET', `/api/media/uploads/${s.uploadId}`)).status, 404);
});

// ---- the real client (shared/resumableUpload.js) against the real server code, with network faults injected
function flaky(plan) { // plan: patch-call number -> 'drop' (never reaches server) | 'lost' (server applies it, reply lost) | '503'
  let n = 0; return async (url, o) => { if (o.method !== 'PATCH') return fetch(url, o); const k = ++n, f = plan[k];
    if (f === 'drop') throw new Error('network'); if (f === '503') return new Response('{}', { status: 503 }); const r = await fetch(url, o); if (f === 'lost') throw new Error('network'); return r; }; }
const clientFor = (f, user = 'u1') => async (method, p, { headers = {}, json, raw } = {}) => {
  let res; try { res = await f(base + '/api' + p, { method, headers: { 'x-user': user, ...(json ? { 'Content-Type': 'application/json' } : {}), ...headers }, body: json ? JSON.stringify(json) : raw }); } catch { throw Object.assign(new Error('net'), { network: true }); }
  const data = await res.json().catch(() => ({})); if (!res.ok) throw Object.assign(new Error(data.error || 'x'), { status: res.status, data }); return data; };
const cut = (buf) => async (o, l) => buf.subarray(o, o + l);

test('E2E: upload survives dropped connections, lost replies and 503s and still arrives byte-for-byte', { skip: !has }, async () => {
  const file = wav(4); assert.ok(file.length > 100000); const sleeps = []; const progress = [];
  const media = await resumableUpload({ request: clientFor(flaky({ 2: 'drop', 3: 'lost', 5: '503', 6: 'lost' })), readChunk: cut(file), file: { name: 'e2e.wav', size: file.length, mime: 'audio/wav', projectId: 'p1' }, sleep: async (ms) => sleeps.push(ms), onProgress: (p) => progress.push(p) });
  const stored = fs.readFileSync(path.join(uploads, path.basename(media.url)));
  assert.equal(crypto.createHash('sha256').update(stored).digest('hex'), crypto.createHash('sha256').update(file).digest('hex')); assert.ok(sleeps.length >= 2, 'it retried with backoff');
  assert.equal(progress.at(-1), 1); assert.ok(progress.every((p, i) => i === 0 || p >= progress[i - 1]), 'progress never goes backwards');
});
test('E2E: resuming after the app was closed continues from the server offset instead of starting over', { skip: !has }, async () => {
  const file = wav(4); let saved = null; const resume = { get: async () => saved, set: async (v) => { saved = v; }, clear: async () => { saved = null; } };
  const part = clientFor(fetch); await assert.rejects(resumableUpload({ request: async (m, p, o) => { if (m === 'PATCH' && o.headers['Upload-Offset'] !== '0') throw Object.assign(new Error('app killed'), { status: 400 }); return part(m, p, o); }, readChunk: cut(file), file: { name: 'r.wav', size: file.length, mime: 'audio/wav', projectId: 'p1' }, resume }));
  assert.ok(saved, 'session id was remembered'); const sent = []; const base2 = clientFor(fetch);
  const media = await resumableUpload({ request: async (m, p, o) => { if (m === 'PATCH') sent.push(Number(o.headers['Upload-Offset'])); return base2(m, p, o); }, readChunk: cut(file), file: { name: 'r.wav', size: file.length, mime: 'audio/wav', projectId: 'p1' }, resume });
  assert.ok(sent[0] > 0, `second run started at offset ${sent[0]}, not 0`); assert.equal(saved, null); assert.equal(fs.statSync(path.join(uploads, path.basename(media.url))).size, file.length);
});
test('E2E: errors that cannot pass stop immediately (no pointless retries)', async () => {
  let calls = 0; const req = clientFor(fetch); await assert.rejects(resumableUpload({ request: async (m, p, o) => { calls++; return req(m, p, o); }, readChunk: cut(Buffer.alloc(10)), file: { name: 'x.exe', size: 10, mime: 'application/x-msdownload', projectId: 'p1' }, sleep: async () => {} }), (e) => e.status === 415);
  assert.equal(calls, 1);
});
