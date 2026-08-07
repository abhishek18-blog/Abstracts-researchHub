// ============================================================
// models/index.js — Database Schemas (MongoDB)
// ============================================================
// Think of a "Schema" like a form template.
// It defines what fields/data each document (row) in MongoDB must have.
// mongoose.model() turns that template into a real database collection.
// ============================================================

import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

// Instead of MongoDB's default numeric _id, we use a human-readable UUID string.
// e.g. "a3f2c1d0-..." instead of ObjectId("507f1...")
const stringId = { type: String, default: () => uuidv4() };

// schemaOptions: shared config for most models.
// - timestamps: automatically adds created_at and updated_at fields
// - toJSON.transform: cleans up the output sent to the frontend
//   (renames _id to id, removes __v which is an internal MongoDB version field)
const schemaOptions = {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  toJSON: {
    transform: function (doc, ret) {
      ret.id = ret._id;      // rename _id → id (cleaner for frontend)
      delete ret._id;        // remove the original _id
      delete ret.__v;        // remove MongoDB's internal version key
      return ret;
    }
  }
};

// Same as above but WITHOUT timestamps (used for join/linking tables
// like SavedPaper, ReadingProgress, CommunityMember — they don't need timestamps)
const schemaOptionsNoTS = {
  toJSON: {
    transform: function (doc, ret) {
      ret.id = ret._id;
      delete ret._id;
      delete ret.__v;
      return ret;
    }
  }
};

// ─────────────────────────────────────────────
// 👤 USER — Stores registered user accounts
// ─────────────────────────────────────────────
// Every person who signs up gets one document here.
// Supports both email/password auth and Google OAuth.
const userSchema = new mongoose.Schema({
  _id: stringId,                                       // unique ID for the user
  name: { type: String, required: true },              // full name (required)
  email: { type: String, required: true, unique: true }, // must be unique — no two accounts with same email
  password: { type: String, required: true },          // hashed password (never stored as plain text)
  role: { type: String, default: 'Student' },          // user role: 'Student' or 'Researcher'
  avatar_initials: { type: String },                   // e.g. "AB" — shown as avatar fallback
  avatar_url: { type: String },                        // profile picture URL (from Google or upload)
  interests: [{ type: String }],                       // list of research topics the user picked
  hasSelectedInterests: { type: Boolean, default: false }, // tracks if user completed the onboarding step
}, schemaOptions);

const User = mongoose.model('User', userSchema);

// ─────────────────────────────────────────────
// 📄 PAPER — Stores research paper metadata
// ─────────────────────────────────────────────
// When a user searches and saves a paper from Semantic Scholar,
// we store its details here so we don't have to re-fetch from the API.
const paperSchema = new mongoose.Schema({
  _id: stringId,
  title: { type: String, required: true },     // paper title
  authors: [{ type: String }],                 // list of author names
  year: { type: String },                      // publication year
  citations: { type: Number, default: 0 },     // number of times this paper was cited
  tags: [{ type: String }],                    // topic/keyword tags
  abstract: { type: String },                  // the paper's summary/abstract text
  pdf_url: { type: String },                   // direct link to PDF (if available)
  source_url: { type: String },               // link to paper on Semantic Scholar
  doi: { type: String },                       // Digital Object Identifier (unique paper ID)
  external_id: { type: String }               // Semantic Scholar's internal paper ID
}, schemaOptions);

const Paper = mongoose.model('Paper', paperSchema);

// ─────────────────────────────────────────────
// 📁 PROJECT — Research workspaces per user
// ─────────────────────────────────────────────
// Users can create named "projects" to organise papers into groups.
// e.g. "My ML Research", "Thesis Papers", "Week 3 Reading"
const projectSchema = new mongoose.Schema({
  _id: stringId,
  user_id: { type: String, ref: 'User', required: true }, // which user owns this project
  name: { type: String, required: true },                  // project name
  description: { type: String },                           // optional description
  color: { type: String },                                 // UI colour for the project card
  papers: [{ type: String, ref: 'Paper' }]                // list of paper IDs added to this project
}, schemaOptions);

const Project = mongoose.model('Project', projectSchema);

// ─────────────────────────────────────────────
// 🔖 SAVED PAPER — Bookmarks (user ↔ paper link)
// ─────────────────────────────────────────────
// When a user clicks "Save" on a paper, we create one record here.
// The compound index prevents duplicate saves of the same paper.
const savedPaperSchema = new mongoose.Schema({
  _id: stringId,
  user_id: { type: String, ref: 'User', required: true },  // who saved it
  paper_id: { type: String, ref: 'Paper', required: true }, // which paper was saved
  saved_at: { type: Date, default: Date.now }               // when it was saved
}, schemaOptionsNoTS);
// Ensure the same user can't save the same paper twice
savedPaperSchema.index({ user_id: 1, paper_id: 1 }, { unique: true });
const SavedPaper = mongoose.model('SavedPaper', savedPaperSchema);

// ─────────────────────────────────────────────
// 📊 READING PROGRESS — Tracks how far a user read a paper
// ─────────────────────────────────────────────
// Stores a 0–100 progress value per user per paper.
// e.g. user read 60% of this paper → progress: 60
const readingProgressSchema = new mongoose.Schema({
  _id: stringId,
  user_id: { type: String, ref: 'User', required: true },
  paper_id: { type: String, ref: 'Paper', required: true },
  progress: { type: Number, default: 0 },          // 0 to 100 (percentage read)
  last_read_at: { type: Date, default: Date.now }  // when user last opened the paper
}, schemaOptionsNoTS);
// One progress record per user per paper
readingProgressSchema.index({ user_id: 1, paper_id: 1 }, { unique: true });
const ReadingProgress = mongoose.model('ReadingProgress', readingProgressSchema);

// ─────────────────────────────────────────────
// 💬 CONVERSATION — AI Chat sessions
// ─────────────────────────────────────────────
// Each AI chat session is a "conversation". It holds a list of messages.
// Think of it like a chat thread in WhatsApp.
const conversationSchema = new mongoose.Schema({
  _id: stringId,
  user_id: { type: String, ref: 'User', required: true }, // which user started the conversation
  title: { type: String }                                  // optional title for the chat (e.g. "Summarise this paper")
}, schemaOptions);

const Conversation = mongoose.model('Conversation', conversationSchema);

// ─────────────────────────────────────────────
// 💬 MESSAGE — Individual chat messages inside a conversation
// ─────────────────────────────────────────────
// Each message belongs to a conversation.
// role is either "user" (what the human typed) or "assistant" (what AI replied)
const messageSchema = new mongoose.Schema({
  _id: stringId,
  conversation_id: { type: String, ref: 'Conversation', required: true }, // which chat session this belongs to
  role: { type: String, required: true },    // "user" or "assistant"
  content: { type: String, required: true }  // the actual message text
}, schemaOptions);

const Message = mongoose.model('Message', messageSchema);

// ─────────────────────────────────────────────
// 📎 UPLOAD — PDF files uploaded by users
// ─────────────────────────────────────────────
// When users upload their own PDF files, we store metadata here.
// The actual file content is stored separately (e.g. in memory/cloud).
const uploadSchema = new mongoose.Schema({
  _id: stringId,
  user_id: { type: String, ref: 'User', required: true },  // who uploaded it
  filename: { type: String, required: true },               // the stored filename (could be renamed)
  original_name: { type: String, required: true },          // original file name from user's device
  mime_type: { type: String },                              // file type e.g. "application/pdf"
  size_bytes: { type: Number },                             // file size in bytes
  paper_id: { type: String, ref: 'Paper' }                 // optionally linked to an existing paper
}, schemaOptions);

const Upload = mongoose.model('Upload', uploadSchema);

// ─────────────────────────────────────────────
// 👥 COMMUNITY — Research discussion groups
// ─────────────────────────────────────────────
// Users can create communities around specific research topics.
// Similar to a subreddit or Discord server for researchers.
const communitySchema = new mongoose.Schema({
  _id: stringId,
  name: { type: String, required: true },              // community name e.g. "AI Safety Researchers"
  description: { type: String },                       // what this community is about
  subject: { type: String },                           // research subject/area
  icon: { type: String },                              // emoji or icon for the community
  created_by: { type: String, ref: 'User', required: true }, // user who created it
  is_private: { type: Boolean, default: false },       // if true, requires approval to join
  allow_invites: { type: Boolean, default: true },     // if true, members can invite others
  cover_photo: { type: String },                       // Custom cover photo (Base64 or URL)
  link: { type: String },                              // Custom community link
  guidelines_link: { type: String }                    // Custom guidelines link
}, schemaOptions);

const Community = mongoose.model('Community', communitySchema);

// ─────────────────────────────────────────────
// 🤝 COMMUNITY MEMBER — Tracks who is in which community
// ─────────────────────────────────────────────
// A "join table" linking users to communities.
// One record = one user in one community.
const communityMemberSchema = new mongoose.Schema({
  _id: stringId,
  community_id: { type: String, ref: 'Community', required: true }, // which community
  user_id: { type: String, ref: 'User', required: true },           // which user
  role: { type: String, default: 'member' },  // 'member' or 'admin'
  joined_at: { type: Date, default: Date.now } // when they joined
}, schemaOptionsNoTS);
// A user can only be a member of a community once
communityMemberSchema.index({ community_id: 1, user_id: 1 }, { unique: true });
const CommunityMember = mongoose.model('CommunityMember', communityMemberSchema);

// ─────────────────────────────────────────────
// 🙋 JOIN REQUEST — Requests to join private communities
// ─────────────────────────────────────────────
// When a community is private, users must request to join.
// An admin can then accept or reject the request.
const joinRequestSchema = new mongoose.Schema({
  _id: stringId,
  community_id: { type: String, ref: 'Community', required: true },
  user_id: { type: String, ref: 'User', required: true },
  status: { type: String, enum: ['pending', 'accepted', 'rejected'], default: 'pending' }
  // enum means only these 3 values are allowed — acts like a dropdown validator
}, schemaOptions);
joinRequestSchema.index({ community_id: 1, user_id: 1, status: 1 });
const JoinRequest = mongoose.model('JoinRequest', joinRequestSchema);

// ─────────────────────────────────────────────
// 📝 COMMUNITY POST — Posts/messages inside a community
// ─────────────────────────────────────────────
// Members can post text updates or share research papers in a community.
const communityPostSchema = new mongoose.Schema({
  _id: stringId,
  community_id: { type: String, ref: 'Community', required: true }, // which community this post is in
  user_id: { type: String, ref: 'User', required: true },           // who posted it
  content: { type: String, required: true },                        // the post text
  paper_ids: [{ type: String, ref: 'Paper' }],                        // optionally linked research papers
  likes: { type: Number, default: 0 }                              // like counter
}, schemaOptions);

const CommunityPost = mongoose.model('CommunityPost', communityPostSchema);

// ─────────────────────────────────────────────
// 🖍 ABSTRACT HIGHLIGHT — Text highlights inside abstracts
// ─────────────────────────────────────────────
// Users can highlight specific parts of a paper's abstract (like a highlighter pen).
// Each highlight stores the selected text, its colour, and which paper it belongs to.
const abstractHighlightSchema = new mongoose.Schema({
  _id: stringId,
  user_id: { type: String, ref: 'User', required: true },  // who made the highlight
  paper_id: { type: String, ref: 'Paper', required: true }, // which paper's abstract was highlighted
  text: { type: String, required: true },                   // the highlighted text
  color: { type: String, default: 'yellow' }               // highlight colour (default: yellow)
}, schemaOptions);

const AbstractHighlight = mongoose.model('AbstractHighlight', abstractHighlightSchema);

// ─────────────────────────────────────────────
// 📦 EXPORTS — Make all models available to other files
// ─────────────────────────────────────────────
// Any controller that needs to query the database imports from here.
// e.g. import { User, Paper } from '../models/index.js'
export {
  User, Paper, Project, SavedPaper, ReadingProgress,
  Conversation, Message, Upload, Community, CommunityMember, CommunityPost, JoinRequest, AbstractHighlight
};
