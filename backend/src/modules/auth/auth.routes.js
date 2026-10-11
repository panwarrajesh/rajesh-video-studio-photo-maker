import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../../utils/prisma.js';
import { requireAuth } from '../../middleware/auth.js';
import { createSessionService, REFRESH_TTL_MS } from './session.service.js';
import { prismaSessionStore } from './session.store.js';

const r = Router();
const sessions = createSessionService(prismaStore());
function prismaStore() { return prismaSessionStore; }

const PROD = process.env.NODE_ENV === 'production';
const COOKIE_MODE = process.env.COOKIE_AUTH === 'true'; // web: refresh token in an HttpOnly cookie instead of the JSON body
const COOKIE = 'rvs_rt';
const cookieOpts = { httpOnly: true, secure: PROD, sameSite: PROD ? 'none' : 'lax', path: '/api/auth', maxAge: REFRESH_TTL_MS };
const readCookie = (req) => (req.headers.cookie || '').split(';').map((s) => s.trim().split('=')).find(([k]) => k === COOKIE)?.[1];
const isMobile = (req) => req.get('x-client') === 'mobile';
const access = (u) => jwt.sign({ id: u.id }, process.env.JWT_SECRET, { expiresIn: '15m' }); // short-lived
const pub = (u) => ({ id: u.id, email: u.email, name: u.name, plan: u.plan });

async function respond(req, res, user, refreshToken, status = 200) {
  const cookieOnly = COOKIE_MODE && !isMobile(req);
  if (COOKIE_MODE) res.cookie(COOKIE, refreshToken, cookieOpts);
  res.status(status).json({ user: pub(user), accessToken: access(user), ...(cookieOnly ? {} : { refreshToken }) });
}

r.post('/register', async (req, res) => {
  const p = z.object({ name: z.string().min(2).max(60), email: z.string().email(), password: z.string().min(8).max(100) }).safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: 'Invalid input (password min 8 chars)' });
  const email = p.data.email.toLowerCase();
  if (await prisma.user.findUnique({ where: { email } })) return res.status(409).json({ error: 'Email already registered' });
  const user = await prisma.user.create({ data: { email, name: p.data.name, passwordHash: await bcrypt.hash(p.data.password, 12) } });
  await respond(req, res, user, await sessions.issue(user.id, req.get('user-agent')), 201);
});
r.post('/login', async (req, res) => {
  const p = z.object({ email: z.string().email(), password: z.string() }).safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: 'Invalid input' });
  const user = await prisma.user.findUnique({ where: { email: p.data.email.toLowerCase() } });
  if (!user || !(await bcrypt.compare(p.data.password, user.passwordHash))) return res.status(401).json({ error: 'Wrong email or password' });
  await respond(req, res, user, await sessions.issue(user.id, req.get('user-agent')));
});
// Only a bad/expired/revoked refresh token answers 401. Server problems answer 5xx, so clients never log the user out by mistake.
r.post('/refresh', async (req, res) => {
  const out = await sessions.rotate(req.body?.refreshToken || readCookie(req), req.get('user-agent'));
  const user = out.ok && (await prisma.user.findUnique({ where: { id: out.userId } }));
  if (!out.ok || !user) { if (COOKIE_MODE) res.clearCookie(COOKIE, { ...cookieOpts, maxAge: undefined }); return res.status(401).json({ error: 'Session expired. Please log in again.' }); }
  await respond(req, res, user, out.token);
});
r.post('/logout', async (req, res) => {
  await sessions.revoke(req.body?.refreshToken || readCookie(req));
  if (COOKIE_MODE) res.clearCookie(COOKIE, { ...cookieOpts, maxAge: undefined });
  res.json({ ok: true });
});
r.get('/me', requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  res.json({ user: pub(user) });
});
export default r;
