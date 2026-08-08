import mongoose from 'mongoose';
import { CommunityPost } from './server/models/index.js';

mongoose.connect('mongodb://localhost:27017/research_hub');
setTimeout(async () => {
  const posts = await CommunityPost.find().sort({created_at: -1}).limit(5);
  console.log(JSON.stringify(posts, null, 2));
  process.exit();
}, 1000);
