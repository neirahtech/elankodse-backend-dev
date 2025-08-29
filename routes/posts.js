import express from 'express';
import { getAllPosts, getPublishedPosts, getPostById, getPostCount, getCategories, clearCacheEndpoint, clearPostsCache } from '../controllers/postController.js';
import { getUserIdentifier, hasUserLiked, getUserIdentificationDebug } from '../utils/userIdentification.js';
import Post from '../models/Post.js';
import auth from '../middleware/auth.js';
import optionalAuth from '../middleware/optionalAuth.js';
import requireAuthor from '../middleware/author.js';
import { sequelize } from '../config/db.js';
import { Op } from 'sequelize';
import config from '../config/environment.js';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = express.Router();

// Configure multer for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '..', 'uploads', 'images');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

// Helper function to clean HTML tags
const cleanHtmlTags = (text) => {
  if (!text) return '';
  return text.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
};

// Image upload endpoint with automatic resizing and optimization
router.post('/upload-image', auth, requireAuthor, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }
    
    const originalPath = req.file.path;
    const originalFilename = req.file.filename;
    const fileExt = path.extname(originalFilename);
    const baseName = path.basename(originalFilename, fileExt);
    
    // Create optimized versions
    const optimizedFilename = `${baseName}${fileExt}`;
    const optimizedPath = path.join(path.dirname(originalPath), optimizedFilename);
    
    try {
      // Get image metadata
      const metadata = await sharp(originalPath).metadata();
      console.log('📐 Original image metadata:', {
        width: metadata.width,
        height: metadata.height,
        format: metadata.format,
        size: Math.round(metadata.size / 1024) + 'KB'
      });
      
      // Determine optimal resize dimensions
      const maxWidth = 1920;
      const maxHeight = 1080;
      let resizeOptions = {};
      
      if (metadata.width > maxWidth || metadata.height > maxHeight) {
        resizeOptions = {
          width: maxWidth,
          height: maxHeight,
          fit: 'inside',
          withoutEnlargement: true
        };
      }
      
      // Process and optimize the image
      await sharp(originalPath)
        .resize(resizeOptions.width ? resizeOptions : undefined)
        .jpeg({ quality: 85, progressive: true }) // Convert to JPEG with good quality
        .png({ compressionLevel: 8 }) // Optimize PNG
        .webp({ quality: 85 }) // Support WebP if needed
        .toFile(optimizedPath);
      
      // Get optimized image metadata
      const optimizedMetadata = await sharp(optimizedPath).metadata();
      console.log('✨ Optimized image metadata:', {
        width: optimizedMetadata.width,
        height: optimizedMetadata.height,
        format: optimizedMetadata.format,
        size: Math.round(optimizedMetadata.size / 1024) + 'KB',
        compression: Math.round((1 - optimizedMetadata.size / metadata.size) * 100) + '%'
      });
      
      // Delete original file if different from optimized
      if (originalPath !== optimizedPath) {
        fs.unlinkSync(originalPath);
      }
      
    } catch (imageError) {
      console.warn('⚠️ Image optimization failed, using original:', imageError.message);
      // If optimization fails, use original file
    }
    
    // For image uploads, always return just the relative path
    // This allows the frontend URL transformation to work correctly
    const relativePath = `/uploads/images/${optimizedFilename}`;
    
    // Debug logging for URL generation
    console.log('🖼️ Image Upload URL Generation Debug:', {
      NODE_ENV: process.env.NODE_ENV,
      PRODUCTION_URL: process.env.PRODUCTION_URL,
      filename: optimizedFilename,
      relativePath: relativePath,
      note: 'Returning relative path for frontend URL transformation'
    });
    
    res.json({ 
      success: true, 
      imageUrl: relativePath, // Return relative path instead of full URL
      filename: optimizedFilename,
      optimized: true,
      uploadPath: path.join(__dirname, '..', 'uploads', 'images', optimizedFilename) // Debug info
    });
  } catch (error) {
    console.error('Error uploading image:', error);
    res.status(500).json({ error: 'Failed to upload image' });
  }
});

router.get('/', optionalAuth, getAllPosts);
router.get('/published', optionalAuth, getPublishedPosts);
router.get('/count', getPostCount);
router.get('/categories', getCategories);
router.get('/categories/search', getCategories); // Alias for search functionality
// Get post by ID or slug
router.get('/:identifier', optionalAuth, getPostById);

// Create post (author only)
router.post('/', auth, requireAuthor, async (req, res) => {
  try {
    const { 
      title, 
      subtitle, 
      content, 
      category, 
      coverImage, 
      tags, 
      status, 
      publishDate,
      excerpt: providedExcerpt,
      urlSlug,
      additionalImages 
    } = req.body;
    
    if (!title || !content) {
      return res.status(400).json({ error: 'Title and content are required' });
    }
    
    // Generate excerpt from content if not provided
    const cleanContent = cleanHtmlTags(content);
    const finalExcerpt = providedExcerpt || 
      (cleanContent.slice(0, 300) + (cleanContent.length > 300 ? '...' : ''));
    
    // Generate URL slug if not provided
    const generateSlug = (title) => {
      return title
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim('-');
    };
    
    let finalUrlSlug = urlSlug || generateSlug(title);
    
    // Check if URL slug is unique
    const existingPost = await Post.findOne({ where: { urlSlug: finalUrlSlug } });
    if (existingPost) {
      const timestamp = Date.now();
      finalUrlSlug = `${finalUrlSlug}-${timestamp}`;
    }
    
    // Determine status based on publish date if not explicitly set
    let finalStatus = status;
    if (!finalStatus && publishDate) {
      const now = new Date();
      const publishDateTime = new Date(publishDate);
      finalStatus = publishDateTime > now ? 'scheduled' : 'published';
    } else if (!finalStatus) {
      finalStatus = 'published';
    }
    
    const post = await Post.create({
      postId: String(Date.now()),
      title,
      subtitle,
      content,
      category: category || 'Uncategorized',
      tags: Array.isArray(tags) ? tags : [],
      coverImage,
      additionalImages: Array.isArray(additionalImages) ? additionalImages : [],
      status: finalStatus,
      hidden: false, // Explicitly set to false
      authorId: req.user.id,
      author: req.user.name || 'Elanko-Dse',
      excerpt: finalExcerpt,
      urlSlug: finalUrlSlug,
      comments: 0,
      likes: 0,
      publishedAt: publishDate ? new Date(publishDate) : new Date(),
      updatedAt: new Date(),
    });
    
    // Ensure the post is committed to the database
    await post.reload();
    
    console.log('✅ Post created successfully:', {
      id: post.id,
      postId: post.postId,
      urlSlug: post.urlSlug,
      title: post.title,
      status: post.status
    });
    
    // Clear cache when a new published post is created
    if (finalStatus === 'published') {
      clearPostsCache();
    }
    
    res.status(201).json(post);
  } catch (error) {
    console.error('Error creating post:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      sql: error.sql,
      stack: error.stack
    });
    res.status(500).json({ error: 'Failed to create post', details: error.message });
  }
});

// Edit post (author only)
router.put('/:id', auth, requireAuthor, async (req, res) => {
  try {
    const { 
      title, 
      subtitle, 
      content, 
      category, 
      coverImage, 
      tags, 
      status, 
      publishDate,
      excerpt: providedExcerpt,
      urlSlug,
      additionalImages 
    } = req.body;
    
    if (!title || !content) {
      return res.status(400).json({ error: 'Title and content are required' });
    }
    
    // Generate excerpt from content if not provided
    const cleanContent = cleanHtmlTags(content);
    const finalExcerpt = providedExcerpt || 
      (cleanContent.slice(0, 300) + (cleanContent.length > 300 ? '...' : ''));
    
    // Find the post first - try by postId first, then by numeric id
    let post = await Post.findOne({
      where: { postId: req.params.id }
    });
    
    if (!post) {
      // If not found by postId, try by numeric id
      const numericId = parseInt(req.params.id);
      if (!isNaN(numericId)) {
        post = await Post.findOne({
          where: { id: numericId }
        });
      }
    }
    
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }
    
    // Handle URL slug updates
    let finalUrlSlug = post.urlSlug; // Keep existing if not changed
    if (urlSlug && urlSlug !== post.urlSlug) {
      // Check if new URL slug is unique
      const existingPost = await Post.findOne({ 
        where: { 
          urlSlug: urlSlug,
          id: { [Op.ne]: post.id } // Exclude current post
        } 
      });
      if (existingPost) {
        return res.status(400).json({ error: 'URL slug already exists' });
      }
      finalUrlSlug = urlSlug;
    }
    
    // Determine status based on publish date if not explicitly set
    let finalStatus = status;
    if (!finalStatus && publishDate) {
      const now = new Date();
      const publishDateTime = new Date(publishDate);
      finalStatus = publishDateTime > now ? 'scheduled' : 'published';
    } else if (!finalStatus) {
      finalStatus = 'published';
    }
    
    // Update the post
    await post.update({
      title, 
      subtitle,
      content, 
      category: category || 'Uncategorized', 
      tags: Array.isArray(tags) ? tags : [],
      coverImage,
      additionalImages: Array.isArray(additionalImages) ? additionalImages : [],
      status: finalStatus,
      publishedAt: publishDate ? new Date(publishDate) : post.publishedAt,
      author: req.user.name || 'Elanko-Dse',
      excerpt: finalExcerpt,
      urlSlug: finalUrlSlug,
      updatedAt: new Date()
    });
    
    // Clear cache when a published post is updated or status changes to published
    if (finalStatus === 'published' || post.status === 'published') {
      clearPostsCache();
    }
    
    // Return the updated post
    res.json(post);
  } catch (error) {
    console.error('Error updating post:', error);
    res.status(500).json({ error: 'Failed to update post' });
  }
});

// Delete post (author only)
router.delete('/:id', auth, requireAuthor, async (req, res) => {
  try {
    // Find the post first - try by postId first, then by numeric id
    let post = await Post.findOne({
      where: { postId: req.params.id }
    });
    
    if (!post) {
      // If not found by postId, try by numeric id
      const numericId = parseInt(req.params.id);
      if (!isNaN(numericId)) {
        post = await Post.findOne({
          where: { id: numericId }
        });
      }
    }
    
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }
    
    // Delete the post
    await post.destroy();
    
    // Clear cache when ANY post is deleted (drafts, published, scheduled)
    // This ensures the dashboard shows updated data immediately
    clearPostsCache();
    console.log(`✅ Post deleted and cache cleared - ID: ${post.id}, Status: ${post.status}, Title: ${post.title}`);
    
    res.json({ message: 'Post deleted' });
  } catch (error) {
    console.error('Error deleting post:', error);
    res.status(500).json({ error: 'Failed to delete post' });
  }
});

// Check and publish scheduled posts (no auth required for auto-publish)
router.post('/publish-scheduled', async (req, res) => {
  try {
    console.log('Publish scheduled endpoint called');
    const now = new Date();
    console.log('Checking for scheduled posts to publish at:', now);
    
    // Find all scheduled posts that should be published
    const scheduledPosts = await Post.findAll({
      where: {
        status: 'scheduled',
        publishedAt: {
          [Op.lte]: now
        }
      }
    });
    
    console.log(`Found ${scheduledPosts.length} scheduled posts to publish`);
    
    let publishedCount = 0;
    
    for (const post of scheduledPosts) {
      console.log(`Publishing post: ${post.title} (ID: ${post.id})`);
      await post.update({
        status: 'published',
        updatedAt: new Date()
      });
      publishedCount++;
      console.log(`Successfully published post: ${post.title}`);
    }
    
    res.json({ 
      message: `Published ${publishedCount} scheduled posts`,
      publishedCount,
      totalScheduled: scheduledPosts.length
    });
  } catch (error) {
    console.error('Error publishing scheduled posts:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      sql: error.sql,
      stack: error.stack
    });
    res.status(500).json({ error: 'Failed to publish scheduled posts', details: error.message });
  }
});

// Cache management endpoint (admin only)
router.post('/clear-cache', requireAuthor, clearCacheEndpoint);

// Webhook endpoint for external cache invalidation (e.g., from CMS, scheduled jobs)
router.post('/webhook/cache-invalidate', async (req, res) => {
  try {
    const { secret, reason } = req.body;
    
    // Simple secret-based authentication for webhook
    const webhookSecret = process.env.WEBHOOK_SECRET || 'default-secret-change-in-production';
    if (secret !== webhookSecret) {
      return res.status(401).json({ error: 'Invalid webhook secret' });
    }
    
    clearPostsCache();
    console.log(`🔗 Cache invalidated via webhook. Reason: ${reason || 'Not specified'}`);
    
    res.json({ 
      success: true, 
      message: 'Cache invalidated via webhook',
      reason: reason,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error in webhook cache invalidation:', error);
    res.status(500).json({ error: 'Failed to invalidate cache via webhook' });
  }
});

// Debug endpoint to understand user identification issues
router.get('/debug/user-id', (req, res) => {
  try {
    const debugInfo = getUserIdentificationDebug(req);
    const userId = getUserIdentifier(req);
    
    res.json({
      userId: userId,
      debug: debugInfo,
      headers: {
        userAgent: req.get('User-Agent'),
        acceptLanguage: req.get('Accept-Language'),
        xForwardedFor: req.get('X-Forwarded-For'),
        xRealIp: req.get('X-Real-IP')
      },
      ip: req.ip,
      connection: {
        remoteAddress: req.connection?.remoteAddress,
        socketRemoteAddress: req.socket?.remoteAddress
      }
    });
  } catch (error) {
    console.error('Debug endpoint error:', error);
    res.status(500).json({ error: 'Debug failed' });
  }
});

export default router; 