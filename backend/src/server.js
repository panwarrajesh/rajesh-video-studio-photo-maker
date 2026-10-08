import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

import authRoutes from './modules/auth/auth.routes.js';
import projectRoutes from './modules/projects/projects.routes.js';
import mediaRoutes, { UPLOAD_DIR } from './modules/media/media.routes.js';
import exportRoutes from './modules/exports/exports.routes.js';

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
      if (!origin || allowedOrigins.includes(origin)) return callback(null, true); // no origin = Postman / server-to-server
      console.log('CORS blocked:', origin);
      return callback(null, false); // browser blocks it; the server does not crash with a 500
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use(express.json({ limit: '5mb' }));
app.use('/uploads', express.static(UPLOAD_DIR));
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }), authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/media', mediaRoutes);
app.use('/api', exportRoutes);

app.use((err, _req, res, _next) => {
  console.error('SERVER ERROR:', err);
  res.status(500).json({ error: 'Server error' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`API running on port ${PORT}`));
