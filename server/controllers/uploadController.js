import { Upload } from '../models/index.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const uploadPDF = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    const upload = new Upload({
      user_id: req.userId,
      filename: req.file.filename,
      original_name: req.file.originalname,
      mime_type: req.file.mimetype,
      size_bytes: req.file.size,
      paper_id: null
    });

    await upload.save();

    res.status(201).json({
      success: true,
      data: {
        ...upload.toJSON(),
        url: `${req.fullUrl}/uploads/${req.file.filename}`,
      },
    });
  } catch (error) {
    console.error('Error uploading file:', error);
    res.status(500).json({ success: false, error: 'Failed to upload file' });
  }
};

export const getUploads = async (req, res) => {
  try {
    const uploads = await Upload.find({ user_id: req.userId }).sort({ created_at: -1 });

    const result = uploads.map((u) => ({
      ...u.toJSON(),
      url: `${req.fullUrl}/uploads/${u.filename}`,
    }));

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error fetching uploads:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch uploads' });
  }
};

export const deleteUpload = async (req, res) => {
  try {
    const existing = await Upload.findOne({ _id: req.params.id, user_id: req.userId });
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Upload not found' });
    }

    const filePath = path.join(__dirname, '..', 'uploads', existing.filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    await Upload.deleteOne({ _id: existing._id });
    res.json({ success: true, message: 'Upload deleted and file removed' });
  } catch (error) {
    console.error('Error deleting upload:', error);
    res.status(500).json({ success: false, error: 'Failed to delete upload' });
  }
};
