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
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key';


// ─────────────────────────────────────────────
// 📝 REGISTER — Create a new account
// ─────────────────────────────────────────────
// POST /api/auth/register
// Body: { name, email, password, role, avatar_initials }
export const register = async (req, res) => {
  try {
    // Step 1: Extract the fields the user sent from the request body
    const { name, email, password, role, avatar_initials } = req.body;
    
    // Step 2: Check if an account with this email already exists
    // We don't want two users with the same email
    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ success: false, error: 'User already exists' });
    }

    // Step 3: Hash the password before saving it
    // bcrypt.hash() scrambles the password. The "10" is the "salt rounds"
    // — higher = more secure but slower. 10 is the industry standard.
    // We NEVER store plain-text passwords in the database.
    const hashedPassword = await bcrypt.hash(password, 10);

    // Step 4: Create the new user document in MongoDB
    const user = new User({
      name, email,
      password: hashedPassword,
      role: role || 'Student', // default to Student if no role given
      // Generate initials from the name (e.g. "Abhishek Kumar" → "AB")
      avatar_initials: avatar_initials || (name ? name.substring(0, 2).toUpperCase() : 'U')
    });
    
    // Step 5: Save the user to the database
    await user.save();

    // Step 6: Generate a JWT token so the user is immediately logged in after registering.
    // { id: user._id } is the "payload" stored inside the token.
    // The token expires in 7 days — after that, the user must log in again.
    const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '7d' });

    // Step 7: Send back the token + user data to the frontend
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
    
    // Step 1: Find the user by email in our MongoDB database
    const user = await User.findOne({ email });
    if (!user) {
      // Don't reveal if the email exists or not — say "Invalid credentials" for security
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    // Step 2: Compare the entered password against the hashed one in DB
    // bcrypt.compare() hashes the input and checks if it matches the stored hash
    let isMatch = await bcrypt.compare(password, user.password);

    // Step 3: Firebase Password Fallback
    // Some users originally signed up via Firebase Auth (not our backend).
    // Their passwords may be stored in Firebase but not in our DB yet.
    // So if bcrypt check fails, we try verifying against Firebase's REST API.
    const firebaseApiKey = process.env.VITE_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY || "AIzaSyAqkzkEdNwJamIWv3UM0bw9zGD4wRqI3hc";

    if (!isMatch && firebaseApiKey) {
      try {
        // Call Firebase's sign-in endpoint to check the password
        const fireRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${firebaseApiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, returnSecureToken: true })
        });
        if (fireRes.ok) {
          // Firebase confirmed the password is correct!
          isMatch = true;
          // Now sync the password hash into our MongoDB so future logins are faster
          user.password = await bcrypt.hash(password, 10);
          await user.save();
        }
      } catch (e) {
        // If Firebase is down or returns an error, just continue — don't crash
      }
    }

    // Step 4: If neither our DB nor Firebase matched the password, reject the login
    if (!isMatch) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    // Step 5: Generate a JWT and return it to the frontend
    const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ success: true, token, user });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, error: 'Login failed' });
  }
};


// ─────────────────────────────────────────────
// 👤 GET ME — Fetch currently logged-in user
// ─────────────────────────────────────────────
// GET /api/auth/me  (protected — requires JWT in header)
// The authMiddleware already verified the token and put req.userId on the request.
export const getMe = async (req, res) => {
  try {
    // req.userId was set by the authMiddleware after verifying the JWT
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
// POST /api/auth/forgot-password
// Body: { email }
// Note: The actual email sending is handled by Firebase on the frontend.
// This endpoint just ensures the user exists in Firebase so they can receive it.
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    // Step 1: Verify the email exists in our own database first
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found in our records' });
    }

    // Step 2: Check if this user exists in Firebase (they may only exist in MongoDB)
    if (admin && admin.apps.length) {
      try {
        await admin.auth().getUserByEmail(email);
        // If no error thrown, user exists in Firebase — nothing extra needed
      } catch (err) {
        if (err.code === 'auth/user-not-found') {
          // User is in our DB but not in Firebase — create a placeholder Firebase account
          // so Firebase can send them a password reset email
          await admin.auth().createUser({ email, displayName: user.name });
        } else {
          console.error("Firebase admin error:", err);
        }
      }
    }

    // Step 3: Tell the frontend it's ready to trigger Firebase's sendPasswordResetEmail()
    res.json({ success: true, message: 'Ready for Firebase reset' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ success: false, error: 'Failed to process forgot password' });
  }
};


// ─────────────────────────────────────────────
// 🔵 GOOGLE LOGIN — Sign in via Google OAuth
// ─────────────────────────────────────────────
// POST /api/auth/google
// Body: { token }  ← this is a Firebase ID Token from the frontend after Google sign-in
//
// FLOW:
//  1. User clicks "Sign in with Google" on frontend
//  2. Firebase SDK handles the Google popup/redirect and returns an ID token
//  3. Frontend sends that ID token to this endpoint
//  4. We verify it using Firebase Admin SDK (server-side)
//  5. We find or create the user in our MongoDB
//  6. We issue our own JWT so the rest of our API works the same way
export const googleLogin = async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ success: false, error: 'Google Token required' });
    }

    // Make sure Firebase Admin is initialised (requires credentials in .env)
    if (!admin.apps.length) {
      return res.status(500).json({ success: false, error: 'Firebase Admin not initialized on server. Add credentials to .env' });
    }

    // Step 1: Verify the Google/Firebase ID token using Firebase Admin SDK.
    // This confirms the token is genuine and was issued by Firebase.
    const decodedToken = await admin.auth().verifyIdToken(token);
    const { email, name, picture } = decodedToken; // extract user info from the verified token

    // Step 2: Check if a user with this email already exists in our MongoDB
    let user = await User.findOne({ email });
    if (!user) {
      // First-time Google login — create their account in our database
      // No password needed since they'll always use Google to log in
      user = new User({
        name: name || 'Google User',
        email,
        password: '', // Blank password placeholder — can be set later via addPassword endpoint
        role: 'Student',
        avatar_initials: name ? name.substring(0, 2).toUpperCase() : 'U',
        avatar_url: picture || '' // use their Google profile picture
      });
      await user.save();
    }

    // Step 3: Issue our own JWT token so the rest of the API works normally
    // From this point on, the user's session is managed by our JWT, not Firebase
    const jwtToken = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ success: true, token: jwtToken, user });

  } catch (error) {
    console.error('Google login error:', error);
    // If token verification fails (expired, tampered), send a 401 Unauthorized
    res.status(401).json({ success: false, error: 'Failed to verify Google Token' });
  }
};
