import jwt from 'jsonwebtoken';

// [SECURITY - C2]: Fail loudly if JWT_SECRET is not set.
// Using a fallback secret ('fallback_secret_key') would let anyone forge valid tokens.
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('❌ FATAL: JWT_SECRET environment variable is not set. Server cannot start securely.');
  process.exit(1);
}

// Auth middleware — verifies JWT token
export function authMiddleware(req, res, next) {
  // Allow public access to paper search
  if (req.method === 'GET' && req.originalUrl.startsWith('/api/search/papers')) {
    return next();
  }

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.userId = decoded.id;
      return next();
    } catch (err) {
      return res.status(401).json({ success: false, error: 'Invalid token' });
    }
  }

  // [SECURITY - C3]: Removed x-user-id header fallback.
  // It allowed any caller to impersonate any user without a valid JWT token.
  
  return res.status(401).json({ success: false, error: 'Authentication required' });
}

// Error handling middleware
export function errorHandler(err, req, res, next) {
  console.error('Unhandled error:', err);

  if (err.name === 'MulterError') {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ success: false, error: 'File too large. Maximum size is 50MB.' });
    }
    return res.status(400).json({ success: false, error: err.message });
  }

  if (err.message === 'Only PDF files are allowed' || err.message === 'Only image files are allowed') {
    return res.status(400).json({ success: false, error: err.message });
  }

  // [SECURITY - M2]: Hide internal error details in production.
  // Raw error messages (Mongoose/MongoDB) can reveal schema details to attackers.
  const isDev = process.env.NODE_ENV !== 'production';
  const errorMessage = isDev ? (err.message || 'Internal server error') : 'Internal server error';
  console.error(`ERROR context: ${req.method} ${req.originalUrl}`);
  
  res.status(500).json({ 
    success: false, 
    error: errorMessage,
  });
}

// Request logger middleware
export function requestLogger(req, res, next) {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.originalUrl} [User: ${req.userId || 'Guest'}] → ${res.statusCode} (${duration}ms)`);
  });
  next();
}
