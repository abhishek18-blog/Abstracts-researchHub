import express from 'express';
import rateLimit from 'express-rate-limit';
import { register, login, logout, getMe, forgotPassword, googleLogin, makeAdmin } from '../controllers/authController.js';
import { authMiddleware } from '../middleware/index.js';
import { googleMobileLogin } from '../controllers/mobileAuthController.js';

const router = express.Router();

// ============================================================================
// [SECURITY - MED-05]: IP Rate Limiter (Brute-Force & Credential-Stuffing Defense)
// ============================================================================
// Restricts login/register attempts to 5 requests per 15 minutes per IP.
// `skipFailedRequests: false` ensures failed attempts count toward rate limit.
// Per-account lockout logic is handled inside `login` controller in authController.js.
// ============================================================================
const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 auth requests per `window`
  skipFailedRequests: false, // Ensure failed attempts are counted against the limit
  message: { success: false, error: 'Too many login attempts from this IP, please try again after 15 minutes' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/register', authRateLimiter, register);
router.post('/login', authRateLimiter, login);
router.post('/logout', logout);
router.post('/google', authRateLimiter, googleLogin);
router.post('/google-mobile', googleMobileLogin);
router.post('/forgot-password', authRateLimiter, forgotPassword);
router.post('/make-admin', authMiddleware, makeAdmin);
router.get('/me', authMiddleware, getMe);

export default router;
