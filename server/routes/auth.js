import express from 'express';
import { register, login, getMe, forgotPassword, googleLogin } from '../controllers/authController.js';
import { authMiddleware } from '../middleware/index.js';

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.post('/google', googleLogin);
router.post('/forgot-password', forgotPassword);
router.get('/me', authMiddleware, getMe);

export default router;
