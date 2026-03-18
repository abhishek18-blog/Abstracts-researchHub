import { Router } from 'express';
import { searchExternalPapers, importExternalPaper } from '../controllers/searchController.js';

const router = Router();

router.get('/papers', searchExternalPapers);
router.post('/papers/import', importExternalPaper);

export default router;
