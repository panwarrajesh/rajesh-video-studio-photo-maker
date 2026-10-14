import { prisma } from '../../utils/prisma.js';
import { createHealthRouter } from './health.routes.js';
export default createHealthRouter({ db: () => prisma.$queryRaw`SELECT 1`, tokenTable: () => prisma.refreshToken.count() });
