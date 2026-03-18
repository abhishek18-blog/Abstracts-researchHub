import { Router } from 'express';
import {
  getAllPapers,
  getPaperById,
  createPaper,
  updatePaper,
  deletePaper,
  toggleSavePaper,
  updateReadingProgress,
} from '../controllers/papersController.js';

const router = Router();

router.get('/', getAllPapers);
router.get('/:id', getPaperById);
router.post('/', createPaper);
router.put('/:id', updatePaper);
router.delete('/:id', deletePaper);
router.post('/:id/save', toggleSavePaper);
router.put('/:id/progress', updateReadingProgress);

export default router;
