import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import {
  User, Paper, Project, SavedPaper, ReadingProgress,
  Conversation, Message, Upload, Community, CommunityMember, CommunityPost
} from './models/index.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, 'data', 'db.json');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/abstracts';

async function migrate() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected.');

    if (!fs.existsSync(DB_PATH)) {
      console.log('⚠️ db.json not found, nothing to migrate.');
      process.exit(0);
    }

    const raw = fs.readFileSync(DB_PATH, 'utf-8');
    const data = JSON.parse(raw);

    console.log('🧹 Clearing existing collections...');
    await User.deleteMany({});
    await Paper.deleteMany({});
    await Project.deleteMany({});
    await SavedPaper.deleteMany({});
    await ReadingProgress.deleteMany({});
    await Conversation.deleteMany({});
    await Message.deleteMany({});
    await Upload.deleteMany({});
    await Community.deleteMany({});
    await CommunityMember.deleteMany({});
    await CommunityPost.deleteMany({});

    console.log('📥 Importing Users...');
    for (const u of (data.users || [])) {
      const hashedPassword = await bcrypt.hash('password123', 10);
      await User.create({
        _id: u.id,
        name: u.name,
        email: u.email,
        password: hashedPassword,
        role: u.role,
        avatar_initials: u.avatar_initials,
      });
    }

    console.log('📥 Importing Papers...');
    for (const p of (data.papers || [])) {
      await Paper.create({
        _id: p.id,
        title: p.title,
        authors: p.authors || [],
        year: p.year,
        citations: p.citations,
        tags: p.tags || [],
        abstract: p.abstract,
        pdf_url: p.pdf_url,
        source_url: p.source_url,
        doi: p.doi,
        external_id: p.external_id
      });
    }

    console.log('📥 Importing Projects & Project Papers...');
    for (const p of (data.projects || [])) {
      // Find papers for this project
      const pPapers = (data.project_papers || []).filter(pp => pp.project_id === p.id).map(pp => pp.paper_id);
      await Project.create({
        _id: p.id,
        user_id: p.user_id,
        name: p.name,
        description: p.description,
        color: p.color,
        papers: pPapers
      });
    }

    console.log('📥 Importing Saved Papers...');
    for (const sp of (data.saved_papers || [])) {
      await SavedPaper.create({
        user_id: sp.user_id,
        paper_id: sp.paper_id,
        saved_at: sp.saved_at
      });
    }

    console.log('📥 Importing Reading Progress...');
    for (const rp of (data.reading_progress || [])) {
      await ReadingProgress.create({
        user_id: rp.user_id,
        paper_id: rp.paper_id,
        progress: rp.progress,
        last_read_at: rp.last_read_at
      });
    }

    console.log('📥 Importing Conversations...');
    for (const c of (data.conversations || [])) {
      await Conversation.create({
        _id: c.id,
        user_id: c.user_id,
        title: c.title,
        created_at: c.created_at,
        updated_at: c.updated_at
      });
    }

    console.log('📥 Importing Messages...');
    for (const m of (data.messages || [])) {
      await Message.create({
        _id: m.id,
        conversation_id: m.conversation_id,
        role: m.role,
        content: m.content,
        created_at: m.created_at
      });
    }

    console.log('📥 Importing Uploads...');
    for (const u of (data.uploads || [])) {
      await Upload.create({
        _id: u.id,
        user_id: u.user_id,
        filename: u.filename,
        original_name: u.original_name,
        mime_type: u.mime_type,
        size_bytes: u.size_bytes,
        paper_id: u.paper_id
      });
    }

    console.log('📥 Importing Communities...');
    for (const c of (data.communities || [])) {
      await Community.create({
        _id: c.id,
        name: c.name,
        description: c.description,
        subject: c.subject,
        icon: c.icon,
        created_by: c.created_by,
        created_at: c.created_at,
        updated_at: c.updated_at
      });
    }

    console.log('📥 Importing Community Members...');
    for (const cm of (data.community_members || [])) {
      await CommunityMember.create({
        community_id: cm.community_id,
        user_id: cm.user_id,
        role: cm.role,
        joined_at: cm.joined_at
      });
    }

    console.log('📥 Importing Community Posts...');
    for (const cp of (data.community_posts || [])) {
      await CommunityPost.create({
        _id: cp.id,
        community_id: cp.community_id,
        user_id: cp.user_id,
        content: cp.content,
        paper_id: cp.paper_id,
        likes: cp.likes,
        created_at: cp.created_at
      });
    }

    console.log('🎉 Migration fully completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

migrate();
