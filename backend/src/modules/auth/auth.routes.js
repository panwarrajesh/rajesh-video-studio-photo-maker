import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../../utils/prisma.js';
import { requireAuth } from '../../middleware/auth.js';

const r = Router();
const tokens = (u) => ({
  accessToken: jwt.sign({ id: u.id }, process.env.JWT_SECRET, { expiresIn: '15m' }),
  refreshToken: jwt.sign({ id: u.id }, process.env.JWT_REFRESH_SECRET, { expiresIn: '7d' }),
});
const pub = (u) => ({ id: u.id, email: u.email, name: u.name, plan: u.plan });

r.post('/register', async (req, res) => {
  const p = z.object({ name: z.string().min(2).max(60), email: z.string().email(), password: z.string().min(8).max(100) }).safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: 'Invalid input (password min 8 chars)' });
  const email = p.data.email.toLowerCase();
  if (await prisma.user.findUnique({ where: { email } })) return res.status(409).json({ error: 'Email already registered' });
  const user = await prisma.user.create({ data: { email, name: p.data.name, passwordHash: await bcrypt.hash(p.data.password, 12) } });
  res.status(201).json({ user: pub(user), ...tokens(user) });
});
r.post('/login', async (req, res) => {
  const p = z.object({ email: z.string().email(), password: z.string() }).safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: 'Invalid input' });
  const user = await prisma.user.findUnique({ where: { email: p.data.email.toLowerCase() } });
  if (!user || !(await bcrypt.compare(p.data.password, user.passwordHash))) return res.status(401).json({ error: 'Wrong email or password' });
  res.json({ user: pub(user), ...tokens(user) });
});
r.post('/refresh', async (req, res) => {
  try {
    const { id } = jwt.verify(req.body.refreshToken, process.env.JWT_REFRESH_SECRET);
    res.json(tokens({ id }));
  } catch { res.status(401).json({ error: 'Session expired' }); }
});
r.post('/logout', (_req, res) => res.json({ ok: true }));
r.get('/me', requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  res.json({ user: pub(user) });
});
export default r;
