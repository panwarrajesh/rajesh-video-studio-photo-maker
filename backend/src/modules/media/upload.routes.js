import express, { Router } from 'express';
import { z } from 'zod';
import path from 'path';
import fs from 'fs/promises';
import crypto from 'crypto';
import { CHUNK_SIZE, ALLOWED } from './chunked.service.js';

// Dependencies are injected so the whole protocol can be tested without a database.
export function createUploadRouter({ store, ownsProject, createMedia, saveFile, probeDuration, uploadDir }) {
  const r = Router();
  const Body = z.object({ name: z.string().min(1).max(200), size: z.number().int().min(1).max(500 * 1024 * 1024), mime: z.string(), projectId: z.string().nullish(), duration: z.number().positive().max(86400).nullish() });

  r.post('/', async (req, res) => { // 1. start (or restart) an upload
    const b = Body.safeParse(req.body);
    if (!b.success) return res.status(400).json({ error: 'Invalid upload request' });
    if (!ALLOWED[b.data.mime]) return res.status(415).json({ error: 'Unsupported file type' });
    if (b.data.projectId && !(await ownsProject(req.user.id, b.data.projectId))) return res.status(404).json({ error: 'Project not found' });
    const s = await store.create({ userId: req.user.id, ...b.data });
    res.status(201).json({ uploadId: s.id, chunkSize: s.chunkSize, received: 0 });
  });
  r.get('/:id', async (req, res) => { // how many bytes does the server have? (used to resume)
    const m = await store.load(req.params.id, req.user.id);
    if (!m) return res.status(404).json({ error: 'Upload not found' });
    res.json({ uploadId: m.id, received: m.received, size: m.size, chunkSize: store.chunkSize ?? CHUNK_SIZE, done: !!m.result });
  });
  r.patch('/:id', express.raw({ type: 'application/octet-stream', limit: '6mb' }), async (req, res) => { // 2. send one chunk
    const offset = Number(req.get('upload-offset'));
    if (!Number.isInteger(offset) || offset < 0 || !Buffer.isBuffer(req.body)) return res.status(400).json({ error: 'Missing Upload-Offset header or body' });
    const out = await store.append(req.params.id, req.user.id, offset, req.body);
    if (out.status) return res.status(out.status).json({ error: out.error, received: out.received });
    res.json({ received: out.received });
  });
  r.post('/:id/complete', async (req, res) => { // 3. finish: verify, measure, store, create the media record
    const f = await store.finalize(req.params.id, req.user.id);
    if (f.status) return res.status(f.status).json({ error: f.error, received: f.received });
    if (f.result) return res.json(f.result);
    const final = path.join(uploadDir, `${crypto.randomUUID()}${f.ext}`);
    await fs.rename(f.path, final);
    const probed = f.type === 'IMAGE' ? null : await probeDuration(final);
    let url;
    try { url = await saveFile(final, `media/${path.basename(final)}`, f.mime); }
    catch { await fs.rename(final, f.path).catch(() => {}); return res.status(502).json({ error: 'Storage failure. Please try again.' }); } // the bytes stay, the client can just retry "complete"
    const media = await createMedia({ userId: req.user.id, projectId: f.meta.projectId, name: f.meta.name.slice(0, 120), type: f.type, url, size: f.meta.size, duration: probed ?? f.meta.duration ?? null });
    await store.markDone(req.params.id, media);
    res.status(201).json(media);
  });
  r.delete('/:id', async (req, res) => {
    if (await store.load(req.params.id, req.user.id)) await store.discard(req.params.id);
    res.json({ ok: true });
  });
  return r;
}
