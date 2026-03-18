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
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:3000'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger);

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Public Auth routes
app.use('/api/auth', authRoutes);

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

// ─── Health Check ────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Abstracts API is running',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// ─── 404 Handler ─────────────────────────────────────────────────
app.use('/api/*', (req, res) => {
  res.status(404).json({ success: false, error: 'API endpoint not found' });
});

// ─── Error Handler ───────────────────────────────────────────────
app.use(errorHandler);

// ─── Start Server ────────────────────────────────────────────────
// seedDatabase(); // we might not want to seed automatically, wait for migration

await initializeDatabase();

app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════╗
║                                                   ║
║   🚀  Abstracts API Server                        ║
║   📡  Running on http://localhost:${PORT}            ║
║                                                   ║
║   Endpoints:                                      ║
║   ├── POST   /api/auth/register                   ║
║   ├── POST   /api/auth/login                      ║
║   ├── GET    /api/auth/me                         ║
║   ├── GET    /api/health                          ║
║   ├── GET    /api/papers                          ║
║   ├── GET    /api/papers/:id                      ║
║   ├── POST   /api/papers                          ║
║   ├── PUT    /api/papers/:id                      ║
║   ├── DELETE /api/papers/:id                      ║
║   ├── POST   /api/papers/:id/save                 ║
║   ├── PUT    /api/papers/:id/progress             ║
║   ├── GET    /api/projects                        ║
║   ├── GET    /api/projects/:id                    ║
║   ├── POST   /api/projects                        ║
║   ├── PUT    /api/projects/:id                    ║
║   ├── DELETE /api/projects/:id                    ║
║   ├── POST   /api/projects/:id/papers             ║
║   ├── DELETE /api/projects/:id/papers/:paperId    ║
║   ├── GET    /api/chat/conversations              ║
║   ├── GET    /api/chat/conversations/:id/messages ║
║   ├── POST   /api/chat/conversations              ║
║   ├── POST   /api/chat/conversations/:id/messages ║
║   ├── DELETE /api/chat/conversations/:id          ║
║   ├── GET    /api/user                            ║
║   ├── PUT    /api/user                            ║
║   ├── POST   /api/upload                          ║
║   ├── GET    /api/upload                          ║
║   └── DELETE /api/upload/:id                      ║
║                                                   ║
╚═══════════════════════════════════════════════════╝
  `);
});

export default app;
