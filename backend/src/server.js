import 'dotenv/config';
import 'express-async-errors'; // an error inside an async route becomes a clean 500 answer instead of crashing the whole server
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import authRoutes from './modules/auth/auth.routes.js';
import projectRoutes from './modules/projects/projects.routes.js';
import mediaRoutes, { UPLOAD_DIR } from './modules/media/media.routes.js';
import exportRoutes from './modules/exports/exports.routes.js';
import captionsRoutes from './modules/captions/captions.routes.js';
import healthDeep from './modules/health/index.js';
import fs from 'fs/promises';
import path from 'path';

const app = express();

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

// ===============================
// CORS
// ===============================
const allowedOrigins = [
  'https://rajesh-video-studio-photo-maker.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000',
  // Android app (Capacitor WebView) - without these every request from the APK is blocked
  'http://localhost',
  'https://localhost',     
  'capacitor://localhost',
  'ionic://localhost',
  // extra origins from the CLIENT_URL env variable (comma separated)
  ...(process.env.CLIENT_URL || '').split(',').map((s) => s.trim()).filter(Boolean),
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (
        !origin ||
        allowedOrigins.includes(origin) ||
        /\.vercel\.app$/.test(origin) ||
        /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)(:\d+)?$/.test(origin)
      ) return callback(null, true); // allow localhost and all local network mobile devices
      console.log('CORS blocked:', origin);
      return callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api/health', rateLimit({ windowMs: 60 * 1000, max: 30 }), healthDeep);
app.use(express.json({ limit: '5mb' }));
app.use('/uploads', express.static(UPLOAD_DIR));
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }), authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/media', mediaRoutes);
app.use('/api', exportRoutes);
app.use('/api/captions', captionsRoutes);

app.use((err, _req, res, _next) => {
  console.error('SERVER ERROR:', err);
  res.status(500).json({ error: 'Server error' });
});

// Periodic sweep: clean up finished exports older than 2 hours so disk storage never fills up
setInterval(async () => {
  try {
    const expDir = path.join(UPLOAD_DIR, 'exports');
    const files = await fs.readdir(expDir).catch(() => []);
    const now = Date.now();
    for (const f of files) {
      const fp = path.join(expDir, f);
      const st = await fs.stat(fp).catch(() => null);
      if (st && now - st.mtimeMs > 2 * 3600 * 1000) {
        await fs.unlink(fp).catch(() => {});
      }
    }
  } catch {}
}, 30 * 60 * 1000).unref();

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`API running on port ${PORT}`));
