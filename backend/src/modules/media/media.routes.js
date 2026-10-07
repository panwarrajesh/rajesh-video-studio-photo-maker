import { Router } from 'express';
import multer from 'multer';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs/promises';
import { prisma } from '../../utils/prisma.js';
import { requireAuth } from '../../middleware/auth.js';

import { UPLOAD_DIR, saveFile, removeFile } from '../../services/storage.js';
export { UPLOAD_DIR };

const ALLOWED = {
  'video/mp4': ['.mp4', 'VIDEO'], 'video/webm': ['.webm', 'VIDEO'], 'video/quicktime': ['.mov', 'VIDEO'],
  'audio/mpeg': ['.mp3', 'AUDIO'], 'audio/wav': ['.wav', 'AUDIO'], 'audio/x-wav': ['.wav', 'AUDIO'],
  'image/png': ['.png', 'IMAGE'], 'image/jpeg': ['.jpg', 'IMAGE'], 'image/webp': ['.webp', 'IMAGE'],
};
const upload = multer({
  storage: multer.diskStorage({ destination: UPLOAD_DIR, filename: (_q, f, cb) => cb(null, crypto.randomUUID() + ALLOWED[f.mimetype][0]) }),
  limits: { fileSize: 500 * 1024 * 1024 },
  fileFilter: (_q, f, cb) => (ALLOWED[f.mimetype] ? cb(null, true) : cb(new Error('Unsupported file type'))),
});

const r = Router();
r.use(requireAuth);

r.get('/', async (req, res) => {
  const where = { userId: req.user.id };
  if (req.query.projectId) where.projectId = String(req.query.projectId);
  res.json(await prisma.projectMedia.findMany({ where, orderBy: { id: 'desc' } }));
});
r.post('/upload', (req, res) => upload.single('file')(req, res, async (err) => {
  if (err) return res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'File too large (max 500MB)' : err.message });
  if (!req.file) return res.status(400).json({ error: 'No file received' });
  const { projectId } = req.body;
  if (projectId && !(await prisma.project.findFirst({ where: { id: projectId, userId: req.user.id } }))) {
    await fs.unlink(req.file.path).catch(() => {});
    return res.status(404).json({ error: 'Project not found' });
  }
  let url;
  try { url = await saveFile(req.file.path, `media/${req.file.filename}`, req.file.mimetype); }
  catch { await fs.unlink(req.file.path).catch(() => {}); return res.status(502).json({ error: 'Storage failure. Please try again.' }); }
  const d = Number(req.body.duration);
  res.status(201).json(await prisma.projectMedia.create({ data: {
    userId: req.user.id, projectId: projectId || null, name: req.file.originalname.slice(0, 120),
    type: ALLOWED[req.file.mimetype][1], url, size: req.file.size,
    duration: Number.isFinite(d) && d > 0 && d < 86400 ? d : null,
  } }));
}));
r.put('/:id', async (req, res) => {
  const name = String(req.body.name || '').trim().slice(0, 120);
  const m = await prisma.projectMedia.findFirst({ where: { id: req.params.id, userId: req.user.id } });
  if (!m || !name) return res.status(400).json({ error: 'Invalid request' });
  res.json(await prisma.projectMedia.update({ where: { id: m.id }, data: { name } }));
});
r.delete('/:id', async (req, res) => {
  const m = await prisma.projectMedia.findFirst({ where: { id: req.params.id, userId: req.user.id } });
  if (!m) return res.status(404).json({ error: 'Media not found' });
  await removeFile(m.url).catch(() => {});
  await prisma.projectMedia.delete({ where: { id: m.id } });
  res.json({ ok: true });
});
export default r;
