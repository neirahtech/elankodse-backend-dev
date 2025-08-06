import express from 'express';
import { getPublicPosts, getPublicPostById } from '../controllers/publicPostController.js';

const router = express.Router();

router.get('/posts', getPublicPosts); // This maps to /api/public/posts
router.get('/posts/:id', getPublicPostById); // This maps to /api/public/posts/:id (supports URL slug, postId, or numeric id)

export default router;
