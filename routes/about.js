import express from 'express';
import { getAboutContent, updateAboutContent, createAboutContent } from '../controllers/aboutController.js';
import auth from '../middleware/auth.js';

const router = express.Router();

// GET /api/about - Get about content (public)
router.get('/', getAboutContent);

// POST /api/about - Create new about content (authenticated)
router.post('/', auth, createAboutContent);

// PUT /api/about - Update about content (authenticated)
router.put('/', auth, updateAboutContent);

export default router;
