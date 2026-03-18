import { Router } from 'express';
import {
  getAllProjects,
  getProjectById,
  createProject,
  updateProject,
  deleteProject,
  addPaperToProject,
  removePaperFromProject,
} from '../controllers/projectsController.js';

const router = Router();

router.get('/', getAllProjects);
router.get('/:id', getProjectById);
router.post('/', createProject);
router.put('/:id', updateProject);
router.delete('/:id', deleteProject);
router.post('/:id/papers', addPaperToProject);
router.delete('/:id/papers/:paperId', removePaperFromProject);

export default router;
