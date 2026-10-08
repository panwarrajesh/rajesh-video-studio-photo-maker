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

// ======================================================
// SECURITY
// ======================================================

app.use(
  helmet({
    crossOriginResourcePolicy: {
      policy: 'cross-origin',
    },
  })
);

// ======================================================
// CORS
// ======================================================

const allowedOrigins = [
  // Production Vercel
  'https://rajesh-video-studio-photo-maker.vercel.app',

  // Local development
  'http://localhost:5173',
  'http://localhost:3000',

  // Capacitor / Android
  'http://localhost',
  'https://localhost',
  'capacitor://localhost',

  // Optional custom client URLs from Render environment
  ...(process.env.CLIENT_URL || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Requests without Origin
      // Example: Postman / server-to-server requests
      if (!origin) {
        return callback(null, true);
      }

      // Exact allowed origins
      if (allowedOrigins.includes(origin)) {
        console.log('CORS allowed:', origin);
        return callback(null, true);
      }

      // Allow Vercel preview deployments
      if (
        origin.startsWith(
          'https://rajesh-video-studio-photo-maker-'
        ) &&
        origin.endsWith('.vercel.app')
      ) {
        console.log('CORS allowed Vercel preview:', origin);
        return callback(null, true);
      }

      // Block unknown origins
      console.log('CORS blocked:', origin);

      // IMPORTANT:
      // Do not throw an Error here.
      // Returning false prevents the request from being
      // accepted without crashing the CORS middleware.
      return callback(null, false);
    },

    credentials: true,

    methods: [
      'GET',
      'POST',
      'PUT',
      'PATCH',
      'DELETE',
      'OPTIONS',
    ],

    allowedHeaders: [
      'Content-Type',
      'Authorization',
    ],
  })
);

// ======================================================
// HEALTH CHECK
// ======================================================

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
  });
});

// ======================================================
// BODY PARSER
// ======================================================

app.use(
  express.json({
    limit: '5mb',
  })
);

// ======================================================
// UPLOADS
// ======================================================

app.use('/uploads', express.static(UPLOAD_DIR));

// ======================================================
// AUTH ROUTES
// ======================================================

app.use(
  '/api/auth',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
  }),
  authRoutes
);

// ======================================================
// PROJECT ROUTES
// ======================================================

app.use('/api/projects', projectRoutes);

// ======================================================
// MEDIA ROUTES
// ======================================================

app.use('/api/media', mediaRoutes);

// ======================================================
// EXPORT ROUTES
// ======================================================

app.use('/api', exportRoutes);

// ======================================================
// 404 HANDLER
// ======================================================

app.use((req, res) => {
  res.status(404).json({
    error: 'Route not found',
    path: req.originalUrl,
  });
});

// ======================================================
// ERROR HANDLER
// ======================================================

app.use((err, _req, res, _next) => {
  console.error('SERVER ERROR:', err);

  res.status(500).json({
    error: 'Server error',
  });
});

// ======================================================
// START SERVER
// ======================================================

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`API running on port ${PORT}`);
});