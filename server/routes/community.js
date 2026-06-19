import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
  getAllCommunities,
  getCommunityById,
  createCommunity,
  joinCommunity,
  leaveCommunity,
  createPost,
  deletePost,
  getJoinRequests,
  handleJoinRequest,
  deleteCommunity,
  addMember,
  removeMember
} from '../controllers/communityController.js';
import { authMiddleware } from '../middleware/index.js';

const router = Router();

// [SECURITY]: Rate Limiting (Spam & DoS Prevention)
// We use 'express-rate-limit' to restrict how many posts a single IP address can make within a specific timeframe.
// This prevents malicious actors or bots from flooding the community chat with spam or causing a Denial of Service (DoS).
const postRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // Timeframe: 1 minute window
  max: 5, // Maximum allowed: Limit each IP to 5 posts per minute
  message: { success: false, error: 'Too many posts created from this IP, please try again after a minute' },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers to the client
  legacyHeaders: false, // Disable the deprecated `X-RateLimit-*` headers
});

router.get('/', authMiddleware, getAllCommunities);
router.get('/:id', authMiddleware, getCommunityById);
router.post('/', authMiddleware, createCommunity);
router.post('/:id/join', authMiddleware, joinCommunity);
router.delete('/:id/leave', authMiddleware, leaveCommunity);
router.post('/:id/posts', authMiddleware, postRateLimiter, createPost);
router.delete('/:id/posts/:postId', authMiddleware, deletePost);

// Join request management
router.get('/:id/requests', authMiddleware, getJoinRequests);
router.put('/requests/:requestId', authMiddleware, handleJoinRequest);

// Admin community management
router.delete('/:id', authMiddleware, deleteCommunity);
router.post('/:id/members', authMiddleware, addMember);
router.delete('/:id/members/:userId', authMiddleware, removeMember);

export default router;
