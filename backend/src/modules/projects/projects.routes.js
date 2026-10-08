import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../utils/prisma.js';
import { requireAuth } from '../../middleware/auth.js';

const r = Router();
r.use(requireAuth);
const TRACKS = ['VIDEO', 'IMAGE', 'AUDIO', 'TEXT', 'OVERLAY', 'EFFECTS'];
const mine = (req) => prisma.project.findFirst({ where: { id: req.params.id, userId: req.user.id }, include: { tracks: { orderBy: { order: 'asc' }, include: { clips: true } } } });

r.get('/', async (req, res) => {
  const q = String(req.query.q || '');
  res.json(await prisma.project.findMany({
    where: { userId: req.user.id, name: { contains: q } },
    orderBy: { updatedAt: 'desc' },
  }));
});
r.post('/', async (req, res) => {
  const p = z.object({ name: z.string().min(1).max(80), width: z.number().int().min(16).max(7680).default(1920), height: z.number().int().min(16).max(4320).default(1080), fps: z.union([z.literal(24), z.literal(30), z.literal(60)]).default(30) }).safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: 'Invalid project settings' });
  const count = await prisma.project.count({ where: { userId: req.user.id } });
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (user.plan === 'FREE' && count >= 5) return res.status(403).json({ error: 'Free plan limit: 5 projects' });
  res.status(201).json(await prisma.project.create({
    data: { ...p.data, userId: req.user.id, tracks: { create: TRACKS.map((type, order) => ({ type, order })) } },
  }));
});
r.get('/:id', async (req, res) => {
  const pr = await mine(req);
  pr ? res.json(pr) : res.status(404).json({ error: 'Project not found' });
});
r.put('/:id', async (req, res) => {
  const p = z.object({ name: z.string().min(1).max(80).optional(), fps: z.number().int().optional(), thumbnailUrl: z.string().max(80000).regex(/^data:image\/jpeg;base64,/).optional() }).safeParse(req.body);
  if (!p.success || !(await mine(req))) return res.status(404).json({ error: 'Not found or invalid' });
  res.json(await prisma.project.update({ where: { id: req.params.id }, data: p.data }));
});
r.post('/:id/duplicate', async (req, res) => {
  const pr = await mine(req);
  if (!pr) return res.status(404).json({ error: 'Project not found' });
  const copy = await prisma.project.create({
    data: { userId: req.user.id, name: `${pr.name} (copy)`, width: pr.width, height: pr.height, fps: pr.fps, duration: pr.duration, tracks: { create: pr.tracks.map(({ type, order }) => ({ type, order })) } },
    include: { tracks: true },
  });
  const tid = Object.fromEntries(copy.tracks.map((t) => [t.type, t.id]));
  const rows = pr.tracks.flatMap((t) => t.clips.map((c) => ({ ...c, id: `${copy.id}_${c.id.slice(pr.id.length + 1)}`, trackId: tid[t.type] })));
  if (rows.length) await prisma.timelineClip.createMany({ data: rows });
  res.status(201).json(copy);
});

const ClipSchema = z.object({
  id: z.string().min(1).max(64), mediaId: z.string().nullable().optional(), kind: z.string().max(20).optional(),
  track: z.enum(TRACKS), start: z.number().min(0).max(36000), duration: z.number().min(0.05).max(36000),
  trimIn: z.number().min(0), speed: z.number().min(0.25).max(4), srcLen: z.number().min(0).max(1e6),
  props: z.record(z.any()), keyframes: z.record(z.any()).optional(),
});
r.put('/:id/timeline', async (req, res) => {
  const b = z.object({ clips: z.array(ClipSchema).max(500), tracks: z.record(z.object({ locked: z.boolean(), hidden: z.boolean(), muted: z.boolean() })).optional(), markers: z.array(z.number().min(0).max(36000)).max(200).optional() }).safeParse(req.body);
  if (!b.success) return res.status(400).json({ error: 'Invalid timeline' });
  const pr = await mine(req);
  if (!pr) return res.status(404).json({ error: 'Project not found' });
  const trackId = Object.fromEntries(pr.tracks.map((t) => [t.type, t.id]));
  const ids = [...new Set(b.data.clips.map((c) => c.mediaId).filter(Boolean))];
  const owned = new Set((await prisma.projectMedia.findMany({ where: { id: { in: ids }, userId: req.user.id }, select: { id: true } })).map((m) => m.id));
  const duration = Math.max(0, ...b.data.clips.map((c) => c.start + c.duration));
  await prisma.$transaction([
    prisma.timelineClip.deleteMany({ where: { track: { projectId: pr.id } } }),
    prisma.timelineClip.createMany({ data: b.data.clips.map((c) => ({
      id: `${pr.id}_${c.id}`, trackId: trackId[c.track], mediaId: owned.has(c.mediaId) ? c.mediaId : null, kind: c.kind ?? null,
      start: c.start, duration: c.duration, trimIn: c.trimIn, speed: c.speed, srcLen: c.srcLen, props: c.props, keyframes: c.keyframes ?? {},
    })) }),
    ...pr.tracks.filter((t) => b.data.tracks?.[t.type]).map((t) => prisma.timelineTrack.update({ where: { id: t.id }, data: b.data.tracks[t.type] })),
    prisma.project.update({ where: { id: pr.id }, data: { duration, ...(b.data.markers ? { markers: b.data.markers } : {}) } }),
  ]);
  res.json({ ok: true, savedAt: new Date().toISOString() });
});

r.delete('/:id', async (req, res) => {
  if (!(await mine(req))) return res.status(404).json({ error: 'Project not found' });
  await prisma.project.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
});
export default r;
