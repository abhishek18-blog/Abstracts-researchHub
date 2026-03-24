import admin from 'firebase-admin';
import dotenv from 'dotenv';
dotenv.config();

try {
  if (!admin.apps.length) {
    if (process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          // Handle both literal \n (from single line pasting) or real newlines (from multiline or dotenv parsing)
          // Also strip any wrapping quotes that sometimes carry over
          privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n').replace(/^"|"$/g, ''),
        })
      });
      console.log('Firebase Admin Initialized successfully.');
    } else {
      console.warn('Firebase Admin details missing from .env. Running without Firebase Admin. (User must configure Firebase later).');
    }
  }
} catch (error) {
  console.error('Firebase Admin Initialization Error:', error.message);
}

export default admin;
