import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import { getUserProfile, updateUserProfile, uploadAvatar } from '../controllers/userController.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '..', 'uploads');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `avatar-${uuidv4()}${ext}`);
  },
});

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

export default router;
