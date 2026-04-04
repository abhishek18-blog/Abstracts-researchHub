import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { User } from '../models/index.js';
import admin from '../firebaseAdmin.js';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key';

export const register = async (req, res) => {
  try {
    const { name, email, password, role, avatar_initials } = req.body;
    
    // Check existing
    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ success: false, error: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({
      name, email,
      password: hashedPassword,
      role: role || 'Student',
      avatar_initials: avatar_initials || (name ? name.substring(0, 2).toUpperCase() : 'U')
    });
    
    await user.save();

    const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ success: true, token, user });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ success: false, error: 'Registration failed' });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    let isMatch = await bcrypt.compare(password, user.password);

    const firebaseApiKey = process.env.VITE_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY || "AIzaSyAqkzkEdNwJamIWv3UM0bw9zGD4wRqI3hc";

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
          await user.save();
        }
      } catch (e) {
        // ignore fallback errors
      }
    }

    if (!isMatch) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ success: true, token, user });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, error: 'Login failed' });
  }
};

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
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found in our records' });
    }

    if (admin && admin.apps.length) {
      try {
        await admin.auth().getUserByEmail(email);
      } catch (err) {
        if (err.code === 'auth/user-not-found') {
          // Create a placeholder Firebase user so they can receive reset emails
          await admin.auth().createUser({ email, displayName: user.name });
        } else {
          console.error("Firebase admin error:", err);
        }
      }
    }

    res.json({ success: true, message: 'Ready for Firebase reset' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ success: false, error: 'Failed to process forgot password' });
  }
};

export const googleLogin = async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ success: false, error: 'Google Token required' });
    }

    if (!admin.apps.length) {
      return res.status(500).json({ success: false, error: 'Firebase Admin not initialized on server. Add credentials to .env' });
    }

    // Verify token with Firebase Admin
    const decodedToken = await admin.auth().verifyIdToken(token);
    const { email, name, picture } = decodedToken;

    let user = await User.findOne({ email });
    if (!user) {
      // Create a user without a password hash since they registered via Google.
      user = new User({
        name: name || 'Google User',
        email,
        password: '', // Blank password placeholder. Can be updated later by User.
        role: 'Student',
        avatar_initials: name ? name.substring(0, 2).toUpperCase() : 'U',
        avatar_url: picture || ''
      });
      await user.save();
    }

    const jwtToken = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ success: true, token: jwtToken, user });

  } catch (error) {
    console.error('Google login error:', error);
    res.status(401).json({ success: false, error: 'Failed to verify Google Token' });
  }
};
