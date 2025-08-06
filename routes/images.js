import express from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import {
  uploadImage,
  getAllImages,
  getImageById,
  getActiveImageByType,
  updateImage,
  deleteImage,
  setActiveImage
} from '../controllers/imageController.js';
import auth from '../middleware/auth.js';
import requireAuthor from '../middleware/author.js';

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadsDir = path.join(__dirname, '../uploads/temp');
    // Create temp directory if it doesn't exist
    try {
      fs.mkdirSync(uploadsDir, { recursive: true });
      cb(null, uploadsDir);
    } catch (error) {
      cb(error);
    }
  },
  filename: function (req, file, cb) {
    // Generate unique filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  // Accept only image files
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
}).single('image');

// Error handling middleware for multer
const handleUpload = (req, res, next) => {
  upload(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      // A Multer error occurred when uploading
      console.error('Multer error:', err);
      return res.status(400).json({ error: 'File upload error', details: err.message });
    } else if (err) {
      // An unknown error occurred
      console.error('Unknown upload error:', err);
      return res.status(500).json({ error: 'Upload failed', details: err.message });
    }
    // Everything went fine
    next();
  });
};

// Public routes (no auth required)
router.get('/active/:type', getActiveImageByType);

// Protected routes (auth required)
router.get('/', auth, requireAuthor, getAllImages);
router.get('/:id', auth, requireAuthor, getImageById);

// Admin routes (auth + author required)
router.post('/', auth, requireAuthor, handleUpload, uploadImage);
router.put('/:id', auth, requireAuthor, updateImage);
router.delete('/:id', auth, requireAuthor, deleteImage);
router.post('/:id/activate', auth, requireAuthor, setActiveImage);

export default router; 