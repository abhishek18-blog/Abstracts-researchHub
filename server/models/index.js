import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

const stringId = { type: String, default: () => uuidv4() };

const schemaOptions = {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  toJSON: {
    transform: function (doc, ret) {
      ret.id = ret._id;
      delete ret._id;
      delete ret.__v;
      return ret;
    }
  }
};

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

const userSchema = new mongoose.Schema({
  _id: stringId,
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, default: 'Student' },
  avatar_initials: { type: String },
  avatar_url: { type: String },
  interests: [{ type: String }],
  hasSelectedInterests: { type: Boolean, default: false },
}, schemaOptions);

const User = mongoose.model('User', userSchema);

const paperSchema = new mongoose.Schema({
  _id: stringId,
  title: { type: String, required: true },
  authors: [{ type: String }],
  year: { type: String },
  citations: { type: Number, default: 0 },
  tags: [{ type: String }],
  abstract: { type: String },
  pdf_url: { type: String },
  source_url: { type: String },
  doi: { type: String },
  external_id: { type: String }
}, schemaOptions);

const Paper = mongoose.model('Paper', paperSchema);

const projectSchema = new mongoose.Schema({
  _id: stringId,
  user_id: { type: String, ref: 'User', required: true },
  name: { type: String, required: true },
  description: { type: String },
  color: { type: String },
  papers: [{ type: String, ref: 'Paper' }] // references to paper IDs
}, schemaOptions);

const Project = mongoose.model('Project', projectSchema);

const savedPaperSchema = new mongoose.Schema({
  _id: stringId,
  user_id: { type: String, ref: 'User', required: true },
  paper_id: { type: String, ref: 'Paper', required: true },
  saved_at: { type: Date, default: Date.now }
}, schemaOptionsNoTS);
savedPaperSchema.index({ user_id: 1, paper_id: 1 }, { unique: true });
const SavedPaper = mongoose.model('SavedPaper', savedPaperSchema);

const readingProgressSchema = new mongoose.Schema({
  _id: stringId,
  user_id: { type: String, ref: 'User', required: true },
  paper_id: { type: String, ref: 'Paper', required: true },
  progress: { type: Number, default: 0 },
  last_read_at: { type: Date, default: Date.now }
}, schemaOptionsNoTS);
readingProgressSchema.index({ user_id: 1, paper_id: 1 }, { unique: true });
const ReadingProgress = mongoose.model('ReadingProgress', readingProgressSchema);

const conversationSchema = new mongoose.Schema({
  _id: stringId,
  user_id: { type: String, ref: 'User', required: true },
  title: { type: String }
}, schemaOptions);

const Conversation = mongoose.model('Conversation', conversationSchema);

const messageSchema = new mongoose.Schema({
  _id: stringId,
  conversation_id: { type: String, ref: 'Conversation', required: true },
  role: { type: String, required: true },
  content: { type: String, required: true }
}, schemaOptions);

const Message = mongoose.model('Message', messageSchema);

const uploadSchema = new mongoose.Schema({
  _id: stringId,
  user_id: { type: String, ref: 'User', required: true },
  filename: { type: String, required: true },
  original_name: { type: String, required: true },
  mime_type: { type: String },
  size_bytes: { type: Number },
  paper_id: { type: String, ref: 'Paper' }
}, schemaOptions);

const Upload = mongoose.model('Upload', uploadSchema);

const communitySchema = new mongoose.Schema({
  _id: stringId,
  name: { type: String, required: true },
  description: { type: String },
  subject: { type: String },
  icon: { type: String },
  created_by: { type: String, ref: 'User', required: true },
  is_private: { type: Boolean, default: false },
  allow_invites: { type: Boolean, default: true }
}, schemaOptions);

const Community = mongoose.model('Community', communitySchema);

const communityMemberSchema = new mongoose.Schema({
  _id: stringId,
  community_id: { type: String, ref: 'Community', required: true },
  user_id: { type: String, ref: 'User', required: true },
  role: { type: String, default: 'member' },
  joined_at: { type: Date, default: Date.now }
}, schemaOptionsNoTS);
communityMemberSchema.index({ community_id: 1, user_id: 1 }, { unique: true });
const CommunityMember = mongoose.model('CommunityMember', communityMemberSchema);

const joinRequestSchema = new mongoose.Schema({
  _id: stringId,
  community_id: { type: String, ref: 'Community', required: true },
  user_id: { type: String, ref: 'User', required: true },
  status: { type: String, enum: ['pending', 'accepted', 'rejected'], default: 'pending' }
}, schemaOptions);
joinRequestSchema.index({ community_id: 1, user_id: 1, status: 1 });
const JoinRequest = mongoose.model('JoinRequest', joinRequestSchema);

const communityPostSchema = new mongoose.Schema({
  _id: stringId,
  community_id: { type: String, ref: 'Community', required: true },
  user_id: { type: String, ref: 'User', required: true },
  content: { type: String, required: true },
  paper_id: { type: String, ref: 'Paper' },
  likes: { type: Number, default: 0 }
}, schemaOptions);

const CommunityPost = mongoose.model('CommunityPost', communityPostSchema);

const abstractHighlightSchema = new mongoose.Schema({
  _id: stringId,
  user_id: { type: String, ref: 'User', required: true },
  paper_id: { type: String, ref: 'Paper', required: true },
  text: { type: String, required: true },
  color: { type: String, default: 'yellow' }
}, schemaOptions);

const AbstractHighlight = mongoose.model('AbstractHighlight', abstractHighlightSchema);

export {
  User, Paper, Project, SavedPaper, ReadingProgress,
  Conversation, Message, Upload, Community, CommunityMember, CommunityPost, JoinRequest, AbstractHighlight
};
