import jwt from 'jsonwebtoken';
import { prisma } from '../utils/prisma.js';

let defaultUser = null;
async function getDefaultUser() {
  if (defaultUser) return defaultUser;
  try {
    defaultUser = await prisma.user.findFirst({ orderBy: { createdAt: 'asc' } });
    if (!defaultUser) {
      defaultUser = await prisma.user.create({
        data: {
          email: 'rajesh@studio.local',
          name: 'Rajesh',
          passwordHash: 'no_login_required',
          plan: 'PRO',
        },
      });
    }
  } catch (err) {
    console.error('Error fetching default user:', err);
    return { id: 'default-user', email: 'rajesh@studio.local', name: 'Rajesh', plan: 'PRO' };
  }
  return defaultUser;
}

export const requireAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();

  if (token) {
    try {
      req.user = jwt.verify(token, process.env.JWT_SECRET);
      return next();
    } catch {
      // Fallback to default user if token invalid
    }
  }

  // No-login mode: automatically attach the studio user
  try {
    const user = await getDefaultUser();
    req.user = { id: user.id, email: user.email, name: user.name, plan: user.plan || 'PRO' };
    next();
  } catch (err) {
    res.status(500).json({ error: 'Auth context failed' });
  }
};
