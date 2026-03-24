import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import { getUserProfile, updateUserProfile, uploadAvatar, addPassword, deleteAccount } from '../controllers/userController.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/') ||
    file.originalname.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)) {
    cb(null, true);
  } else {
    console.warn(`Upload Avatar: Rejected file with mimetype "${file.mimetype}" and name "${file.originalname}"`);
    cb(new Error('Only image files are allowed'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
});

const router = Router();

router.get('/', getUserProfile);
router.put('/', updateUserProfile);
router.post('/avatar', upload.single('avatar'), uploadAvatar);
router.post('/password', addPassword);
router.delete('/account', deleteAccount);

export default router;
