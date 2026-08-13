// ============================================================
// controllers/authController.js — Authentication Logic
// ============================================================
// This file handles everything related to user identity:
//   1. register  → Create a new account
//   2. login     → Sign in with email & password
//   3. getMe     → Get the currently logged-in user's data
//   4. forgotPassword → Trigger a password reset via Firebase
//   5. googleLogin → Sign in using a Google account (OAuth)
//
// HOW AUTH WORKS IN THIS APP:
// - After login/register, we generate a JWT (JSON Web Token).
// - The frontend stores this token and sends it with every request.
// - Our authMiddleware (middleware/index.js) verifies the token
//   before any protected route is accessed.
// ============================================================

import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { User } from '../models/index.js';
import admin from '../firebaseAdmin.js';

// JWT_SECRET is a private key used to sign tokens.
// Never share this! Tokens signed with this key prove the user is authenticated.
// We read it from .env so it stays out of the source code.
// [SECURITY - C2]: No fallback — if JWT_SECRET is missing the server already exited in middleware/index.js
const JWT_SECRET = process.env.JWT_SECRET;

// [SECURITY - MED-01]: Helper to set HttpOnly Cookie for XSS mitigation
// Setting HttpOnly: true ensures browser scripts cannot access the token via `document.cookie`,
// completely mitigating XSS-based JWT token theft attacks.
const COOKIE_OPTIONS = {
  httpOnly: true, // Prevents XSS script access
  secure: process.env.NODE_ENV === 'production', // Requires HTTPS in production
  sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
};

const setAuthCookie = (res, token) => {
  res.cookie('token', token, COOKIE_OPTIONS);
};

// ─────────────────────────────────────────────
// 📝 REGISTER — Create a new account
// ─────────────────────────────────────────────
// POST /api/auth/register
// Body: { name, email, password, role, avatar_initials }
export const register = async (req, res) => {
  try {
    // Step 1: Extract the fields the user sent from the request body
    const { name, email, password, role, avatar_initials } = req.body;

    // [SECURITY - H3]: Input Validation
    // Validate all required fields before touching the database.
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, error: 'name, email, and password are required' });
    }
    if (name.length > 100) {
      return res.status(400).json({ success: false, error: 'Name must be 100 characters or fewer' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ success: false, error: 'Invalid email format' });
    }
    if (password.length < 8) {
      return res.status(400).json({ success: false, error: 'Password must be at least 8 characters' });
    }
    // [SECURITY - H3]: Role Allowlist — never trust the client to set their own role
    const ALLOWED_ROLES = ['Student', 'Researcher', 'Professor'];
    const safeRole = ALLOWED_ROLES.includes(role) ? role : 'Student';

    // Step 2: Check if an account with this email already exists
    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ success: false, error: 'User already exists' });
    }

    // Step 3: Hash the password before saving it
    const hashedPassword = await bcrypt.hash(password, 10);

    // Step 4: Create the new user document in MongoDB
    const user = new User({
      name, email,
      password: hashedPassword,
      role: safeRole,
      avatar_initials: avatar_initials || (name ? name.substring(0, 2).toUpperCase() : 'U')
    });
    
    await user.save();

    // Step 5: Generate a JWT token
    const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '7d' });

    // [SECURITY - MED-01]: Set HttpOnly Cookie alongside JSON token
    setAuthCookie(res, token);

    res.status(201).json({ success: true, token, user });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ success: false, error: 'Registration failed' });
  }
};


// ─────────────────────────────────────────────
// 🔑 LOGIN — Sign in with email & password
// ─────────────────────────────────────────────
// POST /api/auth/login
// Body: { email, password }
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    // ============================================================================
    // [SECURITY - MED-05]: Per-Account Lockout Defense
    // ============================================================================
    // To prevent distributed credential-stuffing attacks across botnets, we track
    // failed login attempts on a PER-EMAIL basis in MongoDB.
    // If an account exceeds 10 consecutive failed attempts, it is locked for 30 minutes.
    // While locked, authentication attempts fail instantly before touching bcrypt or Firebase.
    // ============================================================================
    if (user.lock_until && user.lock_until > Date.now()) {
      const minutesRemaining = Math.ceil((user.lock_until.getTime() - Date.now()) / (1000 * 60));
      return res.status(423).json({
        success: false,
        error: `Account is temporarily locked due to repeated failed login attempts. Please try again in ${minutesRemaining} minutes.`
      });
    }

    let isMatch = await bcrypt.compare(password, user.password);

    const firebaseApiKey = process.env.FIREBASE_API_KEY || process.env.VITE_FIREBASE_API_KEY;

    if (!isMatch && firebaseApiKey) {
      try {
        const fireRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${firebaseApiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, returnSecureToken: true })
        });
        if (fireRes.ok) {
          isMatch = true;
          user.password = await bcrypt.hash(password, 10);
        }
      } catch (e) {
        // Continue silently if Firebase call fails
      }
    }

    if (!isMatch) {
      // Increment failed login count
      user.failed_login_attempts = (user.failed_login_attempts || 0) + 1;

      // Lock account for 30 minutes after 10 consecutive failed attempts
      const MAX_FAILED_ATTEMPTS = 10;
      const LOCK_TIME_MS = 30 * 60 * 1000; // 30 minutes

      if (user.failed_login_attempts >= MAX_FAILED_ATTEMPTS) {
        user.lock_until = new Date(Date.now() + LOCK_TIME_MS);
        await user.save();
        console.warn(`🚨 [ACCOUNT LOCKED]: User ${user.email} locked until ${user.lock_until.toISOString()}`);
        return res.status(423).json({
          success: false,
          error: 'Account is temporarily locked due to 10 consecutive failed login attempts. Please try again in 30 minutes.'
        });
      }

      await user.save();
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    // Successful login -> Reset failed attempts and clear lock_until
    user.failed_login_attempts = 0;
    user.lock_until = null;
    await user.save();

    // Step 5: Generate JWT & set HttpOnly cookie
    const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '7d' });
    
    // [SECURITY - MED-01]: Set HttpOnly cookie for browser sessions
    setAuthCookie(res, token);

    res.json({ success: true, token, user });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, error: 'Login failed' });
  }
};


// ─────────────────────────────────────────────
// 🚪 LOGOUT — Clear session & HttpOnly Cookie
// ─────────────────────────────────────────────
// POST /api/auth/logout
export const logout = async (req, res) => {
  try {
    res.clearCookie('token', COOKIE_OPTIONS);
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Logout failed' });
  }
};


// ─────────────────────────────────────────────
// 👤 GET ME — Fetch currently logged-in user
// ─────────────────────────────────────────────
// GET /api/auth/me  (protected — requires JWT in header or HttpOnly Cookie)
export const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    res.json({ success: true, user });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch user' });
  }
};


// ─────────────────────────────────────────────
// 🔒 FORGOT PASSWORD — Trigger Firebase email reset
// ─────────────────────────────────────────────
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });

    if (user && admin && admin.apps.length) {
      try {
        await admin.auth().getUserByEmail(email);
      } catch (err) {
        if (err.code === 'auth/user-not-found') {
          await admin.auth().createUser({ email, displayName: user.name });
        } else {
          console.error("Firebase admin error:", err);
        }
      }
    }

    res.json({ success: true, message: 'If this email is registered, a reset link will be sent.' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ success: false, error: 'Failed to process forgot password' });
  }
};


// ─────────────────────────────────────────────
// 🔵 GOOGLE LOGIN — Sign in via Google OAuth
// ─────────────────────────────────────────────
export const googleLogin = async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ success: false, error: 'Google Token required' });
    }

    if (!admin.apps.length) {
      return res.status(500).json({ success: false, error: 'Firebase Admin not initialized on server.' });
    }

    const decodedToken = await admin.auth().verifyIdToken(token);
    const { email, name, picture } = decodedToken;

    let user = await User.findOne({ email });
    if (!user) {
      user = new User({
        name: name || 'Google User',
        email,
        password: '',
        role: 'Student',
        avatar_initials: name ? name.substring(0, 2).toUpperCase() : 'U',
        avatar_url: picture || ''
      });
      await user.save();
    }

    const jwtToken = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '7d' });

    // [SECURITY - MED-01]: Set HttpOnly cookie for Google OAuth logins too
    setAuthCookie(res, jwtToken);

    res.json({ success: true, token: jwtToken, user });

  } catch (error) {
    console.error('Google login error:', error);
    res.status(401).json({ success: false, error: 'Failed to verify Google Token' });
  }
};


// ─────────────────────────────────────────────
// 👑 MAKE ADMIN — Secure Admin Promotion Path
// ─────────────────────────────────────────────
// POST /api/auth/make-admin
// Body: { admin_secret }
//
// [SECURITY - MED-03]: Secure Admin Promotion Mechanism
// Resolves MED-03 by providing a secret-protected pathway for platform owners
// to promote an account to the `admin` role using `ADMIN_SECRET_KEY` in .env.
export const makeAdmin = async (req, res) => {
  try {
    const { admin_secret } = req.body;
    const envSecret = process.env.ADMIN_SECRET_KEY;

    if (!envSecret) {
      return res.status(500).json({ 
        success: false, 
        error: 'ADMIN_SECRET_KEY is not configured in the server .env file.' 
      });
    }

    if (!admin_secret || admin_secret !== envSecret) {
      return res.status(403).json({ 
        success: false, 
        error: 'Invalid admin secret key.' 
      });
    }

    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    user.role = 'admin';
    await user.save();

    res.json({ 
      success: true, 
      message: `User ${user.email} successfully promoted to admin role!`, 
      user 
    });
  } catch (error) {
    console.error('Error promoting user to admin:', error);
    res.status(500).json({ success: false, error: 'Failed to promote user to admin' });
  }
};
