import { Router } from 'express';
import { summarizePDF, suggestPapers } from '../controllers/aiController.js';

const router = Router();

router.post('/summarize-pdf', summarizePDF);
router.post('/suggest-papers', suggestPapers);

export default router;
