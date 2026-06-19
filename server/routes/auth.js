import express from 'express';
import rateLimit from 'express-rate-limit';
import { register, login, getMe, forgotPassword, googleLogin } from '../controllers/authController.js';
import { authMiddleware } from '../middleware/index.js';

const router = express.Router();

// [SECURITY]: Brute-Force Protection
// Restrict login/register attempts to 5 per 15 minutes to prevent password guessing.
const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 auth requests per `window`
  message: { success: false, error: 'Too many login attempts from this IP, please try again after 15 minutes' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/register', authRateLimiter, register);
router.post('/login', authRateLimiter, login);
router.post('/google', authRateLimiter, googleLogin);
router.post('/forgot-password', authRateLimiter, forgotPassword);
router.get('/me', authMiddleware, getMe);

export default router;
