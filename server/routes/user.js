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

// ============================================================================
// [SECURITY - HIGH-04]: Strict Multer File Filter (SVG Blocked)
// ============================================================================
// PROBLEM: The previous filter allowed SVG files either via mimetype 'image/svg+xml'
//   (covered by `mimetype.startsWith('image/')`) or by filename extension (.svg).
//   SVG is XML that can contain embedded JavaScript — if rendered inline in HTML,
//   it triggers stored XSS. Even as an <img src=...>, some browsers execute scripts.
//
// SOLUTION: Explicitly allowlist only safe, raster image MIME types.
//   SVG, TIFF, BMP, ICO, and any other formats are now rejected at the multer layer.
//   The controller (userController.js) also validates the MIME type as a second layer.
// ============================================================================
const ALLOWED_AVATAR_MIMETYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

const fileFilter = (req, file, cb) => {
  if (ALLOWED_AVATAR_MIMETYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    console.warn(`[HIGH-04] Blocked upload: mimetype="${file.mimetype}" filename="${file.originalname}"`);
    cb(new Error('Only JPEG, PNG, WebP, and GIF images are allowed'), false);
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
