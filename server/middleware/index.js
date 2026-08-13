import jwt from 'jsonwebtoken';

// [SECURITY - C2]: Fail loudly if JWT_SECRET is not set.
// Using a fallback secret ('fallback_secret_key') would let anyone forge valid tokens.
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('❌ FATAL: JWT_SECRET environment variable is not set. Server cannot start securely.');
  process.exit(1);
}

// ============================================================================
// [SECURITY - MED-01]: JWT Authentication Middleware (Header & Cookie Parsing)
// ============================================================================
// To protect against XSS token theft (where malicious scripts read localStorage),
// the server now checks both:
// 1. Authorization: Bearer <token> header (standard API clients / mobile)
// 2. HttpOnly Cookie (`token=...`) sent automatically by browsers.
//
// Because HttpOnly cookies cannot be read via `document.cookie` in JavaScript,
// even if an attacker executes XSS on the page, they cannot extract the JWT token.
// ============================================================================
export function authMiddleware(req, res, next) {
  // Allow public access to paper search
  if (req.method === 'GET' && req.originalUrl.startsWith('/api/search/papers')) {
    return next();
  }

  let token = null;

  // Option A: Extract token from Authorization header (Bearer token format)
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } 
  // Option B: Extract token from HttpOnly Cookie (XSS Protection)
  else if (req.headers.cookie) {
    const parsedCookies = req.headers.cookie.split(';').reduce((acc, pair) => {
      const [key, val] = pair.trim().split('=');
      if (key && val) acc[key] = decodeURIComponent(val);
      return acc;
    }, {});
    token = parsedCookies.token;
  }

  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.userId = decoded.id;
      return next();
    } catch (err) {
      return res.status(401).json({ success: false, error: 'Invalid or expired token' });
    }
  }

  // [SECURITY - C3]: Removed x-user-id header fallback.
  // It allowed any caller to impersonate any user without a valid JWT token.
  return res.status(401).json({ success: false, error: 'Authentication required' });
}

// ============================================================================
// [SECURITY - MED-02]: CSRF (Cross-Site Request Forgery) Protection Middleware
// ============================================================================
// WHAT IS CSRF?
// Cross-Site Request Forgery happens when a malicious site (e.g. `evil-website.com`)
// triggers state-mutating requests (POST/PUT/DELETE) to your API on behalf of a logged-in user.
//
// HOW THIS MIDDLEWARE DEFENDS AGAINST CSRF:
// 1. Safe HTTP methods (GET, HEAD, OPTIONS) do not mutate data, so they pass through.
// 2. For state-mutating methods (POST, PUT, DELETE, PATCH), browsers automatically send
//    the `Origin` or `Referer` header indicating where the request originated.
// 3. We verify that the request Origin matches our trusted domain list.
//    If `evil-website.com` sends a request, its Origin header will be `http://evil-website.com`,
//    which fails this validation and is rejected with a 403 Forbidden.
// ============================================================================
const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:3001',
  'https://abstracts-research-hub.vercel.app',
  'https://abstracts-researchhub.onrender.com'
];

export function csrfProtection(req, res, next) {
  // Safe methods (read-only) do not mutate state and do not require CSRF validation
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  const origin = req.headers.origin;
  const referer = req.headers.referer;

  // Browser-initiated cross-site requests will ALWAYS include an Origin header.
  if (origin) {
    const isAllowed = ALLOWED_ORIGINS.some(allowed => origin.startsWith(allowed));
    if (!isAllowed) {
      console.warn(`🚨 [CSRF BLOCKED]: Request from unauthorized origin: ${origin}`);
      return res.status(403).json({ success: false, error: 'CSRF validation failed: Unauthorized Origin' });
    }
  } else if (referer) {
    const isAllowed = ALLOWED_ORIGINS.some(allowed => referer.startsWith(allowed));
    if (!isAllowed) {
      console.warn(`🚨 [CSRF BLOCKED]: Request from unauthorized referer: ${referer}`);
      return res.status(403).json({ success: false, error: 'CSRF validation failed: Unauthorized Referer' });
    }
  }

  next();
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
