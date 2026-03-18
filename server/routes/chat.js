import { Router } from 'express';
import {
  getConversations,
  getMessages,
  createConversation,
  sendMessage,
  deleteConversation,
} from '../controllers/chatController.js';

const router = Router();

router.get('/conversations', getConversations);
router.get('/conversations/:id/messages', getMessages);
router.post('/conversations', createConversation);
router.post('/conversations/:id/messages', sendMessage);
router.delete('/conversations/:id', deleteConversation);

export default router;
