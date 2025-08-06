import express from 'express';
import { fetchAndCacheBloggerData, fixCoverImages } from '../controllers/utilityController.js';

const router = express.Router();

router.post('/refresh', fetchAndCacheBloggerData);
router.post('/fix-cover-images', fixCoverImages);

export default router; 