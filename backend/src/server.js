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

// ===============================
// Security
// ===============================
app.use(
  helmet({
    crossOriginResourcePolicy: {
      policy: 'cross-origin',
    },
  })
);

// ===============================
// CORS
// ===============================
const allowedOrigins = [
  'https://rajesh-video-studio-photo-maker.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost',
  'https://localhost',
  'capacitor://localhost',

  ...(process.env.CLIENT_URL || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Mobile apps / server-to-server requests
      if (!origin) {
        return callback(null, true);
      }

      // Known origins
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      // Any Vercel deployment
      if (origin.endsWith('.vercel.app')) {
        console.log('Allowing Vercel origin:', origin);
        return callback(null, true);
      }

      console.log('CORS blocked:', origin);
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

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      // Vercel preview deployment
      if (
        /^https:\/\/rajesh-video-studio-photo-maker-[a-z0-9-]+\.vercel\.app$/i.test(
          origin
        )
      ) {
        return callback(null, true);
      }

      console.log('CORS blocked:', origin);
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

app.use(
  cors({
    origin: (origin, callback) => {
      // Postman / server-to-server requests
      if (!origin) {
        return callback(null, true);
      }

      // Exact allowed origins
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      // Vercel preview deployments
      if (/^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin)) {
        return callback(null, true);
      }

      console.log('CORS blocked:', origin);

      // Don't throw an error here
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

app.use(
  cors({
    origin: (origin, callback) => {
      // Postman / server-to-server requests
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      console.log('CORS blocked:', origin);
      return callback(new Error('Not allowed by CORS'));
    },

    credentials: true,

    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],

    allowedHeaders: [
      'Content-Type',
      'Authorization',
    ],
  })
);

// ===============================
// Health Check
// ===============================
app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

// ===============================
// Body Parser
// ===============================
app.use(
  express.json({
    limit: '5mb',
  })
);

// ===============================
// Uploads
// ===============================
app.use('/uploads', express.static(UPLOAD_DIR));

// ===============================
// Auth
// ===============================
app.use(
  '/api/auth',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
  }),
  authRoutes
);

// ===============================
// Projects
// ===============================
app.use('/api/projects', projectRoutes);

// ===============================
// Media
// ===============================
app.use('/api/media', mediaRoutes);

// ===============================
// Exports
// ===============================
app.use('/api', exportRoutes);

// ===============================
// Error Handler
// ===============================
app.use((err, _req, res, _next) => {
  console.error('SERVER ERROR:', err);

  res.status(500).json({
    error: 'Server error',
  });
});

// ===============================
// Start Server
// ===============================
const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`API running on port ${PORT}`);
});