import { Router } from 'express';
import {
  getAllCommunities,
  getCommunityById,
  createCommunity,
  joinCommunity,
  leaveCommunity,
  createPost,
  deletePost,
  getJoinRequests,
  handleJoinRequest
} from '../controllers/communityController.js';
import { authMiddleware } from '../middleware/index.js';

const router = Router();

router.get('/', authMiddleware, getAllCommunities);
router.get('/:id', authMiddleware, getCommunityById);
router.post('/', authMiddleware, createCommunity);
router.post('/:id/join', authMiddleware, joinCommunity);
router.delete('/:id/leave', authMiddleware, leaveCommunity);
router.post('/:id/posts', authMiddleware, createPost);
router.delete('/:id/posts/:postId', authMiddleware, deletePost);

// Join request management
router.get('/:id/requests', authMiddleware, getJoinRequests);
router.put('/requests/:requestId', authMiddleware, handleJoinRequest);

export default router;
