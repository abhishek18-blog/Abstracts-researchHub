import { Router } from 'express';
import {
  getAllPapers,
  getPaperById,
  createPaper,
  updatePaper,
  deletePaper,
  toggleSavePaper,
  updateReadingProgress,
  getAbstractHighlights,
  addAbstractHighlight,
  removeAbstractHighlight,
} from '../controllers/papersController.js';

const router = Router();

router.get('/', getAllPapers);
router.get('/:id', getPaperById);
router.post('/', createPaper);
router.put('/:id', updatePaper);
router.delete('/:id', deletePaper);
router.post('/:id/save', toggleSavePaper);
router.put('/:id/progress', updateReadingProgress);
router.get('/:id/highlights', getAbstractHighlights);
router.post('/:id/highlights', addAbstractHighlight);
router.delete('/:id/highlights/:highlightId', removeAbstractHighlight);

export default router;
