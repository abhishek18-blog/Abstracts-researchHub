import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

import { initializeDatabase } from './database.js';
import { authMiddleware, errorHandler, requestLogger } from './middleware/index.js';

import papersRoutes from './routes/papers.js';
import projectsRoutes from './routes/projects.js';
import chatRoutes from './routes/chat.js';
import userRoutes from './routes/user.js';
import uploadRoutes from './routes/upload.js';
import statsRoutes from './routes/stats.js';
import communityRoutes from './routes/community.js';
import searchRoutes from './routes/search.js';
import authRoutes from './routes/auth.js';
import aiRoutes from './routes/ai.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// ─── Core Middleware ─────────────────────────────────────────────
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:3000',
  process.env.FRONTEND_URL,
  'https://abstracts-research-hub.vercel.app',
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    const isAllowed = allowedOrigins.some(allowed => {
      if (!allowed) return false;
      // Remove trailing slash for comparison
      const normalizedAllowed = allowed.replace(/\/$/, '');
      const normalizedOrigin = origin.replace(/\/$/, '');
      return normalizedAllowed === normalizedOrigin;
    });

    if (isAllowed || process.env.NODE_ENV === 'development') {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger);

// Helper to get full URL for assets
app.use((req, res, next) => {
  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.get('host');
  req.fullUrl = `${protocol}://${host}`;
  next();
});

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Public Auth routes
app.use('/api/auth', authRoutes);

// ─── Health Check ────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Abstracts API is running',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// Auth middleware for all other /api routes
app.use('/api', authMiddleware);

// ─── API Routes ──────────────────────────────────────────────────
app.use('/api/papers', papersRoutes);
app.use('/api/projects', projectsRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/user', userRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/community', communityRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/ai', aiRoutes);

// ─── 404 Handler ─────────────────────────────────────────────────
app.use('/api/*', (req, res) => {
  res.status(404).json({ success: false, error: 'API endpoint not found' });
});

// ─── Error Handler ───────────────────────────────────────────────
app.use(errorHandler);

// ─── Start Server ────────────────────────────────────────────────
// seedDatabase(); // we might not want to seed automatically, wait for migration

app.listen(PORT, '0.0.0.0', () => {
  console.log(`📡 Server listening on port ${PORT}`);

  // Initialize Database asynchronously after server is up
  initializeDatabase().then(() => {
    console.log('✅ MongoDB connected and ready');
  }).catch(err => {
    console.error('❌ MongoDB connection failed:', err);
  });

  console.log(`
╔═══════════════════════════════════════════════════╗
║                                                   ║
║   🚀  Abstracts API Server                        ║
║   📡  Running on http://localhost:${PORT}         ║
║                                                   ║
║   Endpoints:                                      ║
║   ├── POST   /api/auth/register                   ║
║   ├── POST   /api/auth/login                      ║
║   ├── GET    /api/auth/me                         ║
║   ├── GET    /api/health                          ║
║   └── ... many more                               ║
╚═══════════════════════════════════════════════════╝
  `);
});

export default app;
