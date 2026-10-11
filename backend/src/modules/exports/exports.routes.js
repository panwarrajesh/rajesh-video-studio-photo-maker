import { Router } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { prisma } from '../../utils/prisma.js';
import { requireAuth } from '../../middleware/auth.js';
import { enqueue, runExport } from './ffmpeg.service.js';

const r = Router();
r.use(requireAuth);

const clip = z.object({
  id: z.string(), mediaId: z.string().nullable().optional(), kind: z.string().optional(),
  track: z.enum(['VIDEO', 'IMAGE', 'AUDIO', 'TEXT', 'OVERLAY', 'EFFECTS']),
  start: z.number().min(0).max(36000), duration: z.number().min(0.05).max(36000), trimIn: z.number().min(0), speed: z.number().min(0.25).max(4),
  props: z.record(z.any()), keyframes: z.record(z.any()).optional(),
});
const Body = z.object({
  settings: z.object({ resolution: z.enum(['480', '720', '1080', '1440', '2160']), ratio: z.enum(['16:9', '9:16', '1:1', '4:5']), fps: z.union([z.literal(24), z.literal(30), z.literal(60)]), format: z.enum(['mp4', 'webm']) }),
  clips: z.array(clip).min(1).max(500),
});

r.post('/projects/:id/export', rateLimit({ windowMs: 60 * 60 * 1000, max: 20 }), async (req, res) => {
  const b = Body.safeParse(req.body);
  if (!b.success) return res.status(400).json({ error: 'Invalid export settings or timeline' });
  const project = await prisma.project.findFirst({ where: { id: req.params.id, userId: req.user.id } });
  if (!project) return res.status(404).json({ error: 'Project not found' });
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  const free = user.plan === 'FREE';
  if (free && Number(b.data.settings.resolution) > 720) return res.status(403).json({ error: 'Free plan exports up to 720p. Upgrade to Pro for 1080p and above.' });
  const job = await prisma.exportJob.create({ data: { projectId: project.id, settings: b.data.settings } });
  enqueue(() => runExport({ jobId: job.id, userId: user.id, clips: b.data.clips, settings: b.data.settings, free }));
  res.status(202).json({ id: job.id });
});
r.get('/exports/:id', async (req, res) => {
  const job = await prisma.exportJob.findFirst({ where: { id: req.params.id, project: { userId: req.user.id } } });
  job ? res.json({ id: job.id, status: job.status, progress: job.progress, outputUrl: job.outputUrl, error: job.error, warnings: job.warnings }) : res.status(404).json({ error: 'Export not found' });
});
export default r;
