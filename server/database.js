import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/abstracts';

export async function initializeDatabase() {
  try {
    if (!process.env.MONGO_URI) {
      console.warn('⚠️ No MONGO_URI found in .env, falling back to local MongoDB (if any).');
    }
    await mongoose.connect(MONGO_URI);
    console.log('✅ MongoDB connected at', typeof MONGO_URI === 'string' ? MONGO_URI.replace(/:([^:@]{3,})@/, ':***@') : '');
  } catch (err) {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  }
}
