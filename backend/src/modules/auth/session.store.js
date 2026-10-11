import { prisma } from '../../utils/prisma.js';

export const prismaSessionStore = {
  create: (data) => prisma.refreshToken.create({ data }),
  find: (tokenHash) => prisma.refreshToken.findUnique({ where: { tokenHash } }),
  revoke: (id, at, reason) => prisma.refreshToken.update({ where: { id }, data: { revokedAt: at, revokeReason: reason } }),
  revokeAll: (userId, at, reason) => prisma.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: at, revokeReason: reason } }),
};
