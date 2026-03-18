import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Paper, SavedPaper, User } from './models/index.js';

dotenv.config();

async function checkData() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    const userCount = await User.countDocuments();
    const paperCount = await Paper.countDocuments();
    const savedCount = await SavedPaper.countDocuments();

    console.log(`Users: ${userCount}`);
    console.log(`Papers: ${paperCount}`);
    console.log(`Saved Papers: ${savedCount}`);

    if (savedCount > 0) {
      const saved = await SavedPaper.find().limit(5);
      console.log('Sample Saved Papers:', JSON.stringify(saved, null, 2));
    }

    const users = await User.find().limit(5);
    console.log('Sample Users:', JSON.stringify(users.map(u => ({ id: u._id, email: u.email })), null, 2));

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkData();
