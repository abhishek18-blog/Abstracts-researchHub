import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key';

// Auth middleware — verifies JWT token
export function authMiddleware(req, res, next) {
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

  // Fallback for demo or development purposes if no bearer token is present
  const userId = req.headers['x-user-id'];
  if (userId) {
    req.userId = userId;
    return next();
  }
  
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

  if (err.message === 'Only PDF files are allowed') {
    return res.status(400).json({ success: false, error: err.message });
  }

  res.status(500).json({ success: false, error: 'Internal server error' });
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
