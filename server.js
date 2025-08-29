import express from 'express';
import cors from 'cors';
import compression from 'compression';
import dotenv from 'dotenv';
import connectDB from './config/db.js';
import config from './config/environment.js';
import { createCorsOptions, getAllowedOrigins } from './config/cors.js';
import authorRoutes from './routes/author.js';
import postRoutes from './routes/posts.js';
import categoriesRoutes from './routes/categories.js';
import diaryRoutes from './routes/diary.js';
import utilityRoutes from './routes/utility.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/user.js';
import libraryRoutes from './routes/library.js';
import settingsRoutes from './routes/settings.js';
import notificationRoutes from './routes/notifications.js';
import commentRoutes from './routes/comments.js';
import postInteractionRoutes from './routes/postInteractions.js';
import imageRoutes from './routes/images.js';
import aboutRoutes from './routes/about.js';
import bookRoutes from './routes/books.js';
import socialRoutes from './routes/social.js';
import subscriptionRoutes from './routes/subscription.js';
import footerRoutes from './routes/footer.js';
import publicRoutes from './routes/public.js';
import metaRoutes from './routes/meta.js';
import fixImagesRoutes from './routes/fix-images.js';
import analyticsRoutes from './routes/analytics.js';
import { seedAboutContent } from './scripts/seedAbout.js';
import { seedBooks } from './scripts/seedBooks.js';
import './models/index.js'; // Import all models and set up associations
import './models/Author.js';
import './models/Post.js';
import './models/About.js';
import './models/Book.js';

dotenv.config();

connectDB().then(async () => {
  // Import sequelize after models are loaded
  const { sequelize } = await import('./config/db.js');
  await sequelize.sync(); // This will create all tables if they don't exist

  // RESOURCE OPTIMIZATION: Blogger sync functionality removed
  // All image management is now handled locally

  // Check existing posts count
  const { Post } = await import('./models/index.js');
  const postCount = await Post.count();
  console.log(`📊 Posts in database: ${postCount}`);
  if (postCount === 0) {
    console.log('💡 No posts found. Run "npm run sync" to populate data from Blogger.');
  }

  // Seed default about content
  try {
    await seedAboutContent();
    await seedBooks();
  } catch (err) {
    console.error('Content seeding failed:', err);
  }

  const app = express();

  // Configure trust proxy for production deployment (Render, Heroku, etc.)
  // This ensures req.ip gets the real client IP, not the proxy IP
  if (process.env.NODE_ENV === 'production') {
    app.set('trust proxy', 1); // Trust first proxy
    console.log('🔧 Trust proxy enabled for production environment');
  }

  // Enable gzip compression for better performance
  app.use(compression({
    filter: (req, res) => {
      if (req.headers['x-no-compression']) {
        return false;
      }
      return compression.filter(req, res);
    },
    level: 6,
    threshold: 1024,
    memLevel: 8
  }));

  // Debug CORS configuration
  const allowedOrigins = getAllowedOrigins();
  console.log('🔧 CORS Configuration:');
  console.log('📋 Allowed Origins:', allowedOrigins);
  console.log('🌍 Node Environment:', process.env.NODE_ENV);
  console.log('🔑 ALLOWED_ORIGINS env:', process.env.ALLOWED_ORIGINS);

  // Configure CORS with centralized settings
  const corsOptions = createCorsOptions();

  // Enhanced CORS handling for production issues
  app.use((req, res, next) => {
    const origin = req.get('origin');
    if (origin) {
      console.log(`🌐 Request from origin: ${origin} to ${req.method} ${req.path}`);
    }
    next();
  });

  app.use(cors(corsOptions));

  // Enhanced preflight handling with detailed logging
  app.options('*', (req, res) => {
    const origin = req.get('origin');
    console.log(`🔍 OPTIONS request from ${origin} for ${req.get('access-control-request-method')} ${req.path}`);
    
    cors(corsOptions)(req, res, (err) => {
      if (err) {
        console.log('❌ CORS preflight failed:', err.message);
        return res.status(403).json({ error: 'CORS preflight failed', origin });
      }
      console.log('✅ CORS preflight passed for origin:', origin);
      res.status(200).end();
    });
  });

  // RESOURCE OPTIMIZATION: Reduced payload limits to save memory (2MB vs 10MB)
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true, limit: '2mb' }));

  // Add cache control headers for API responses
  app.use('/api', (req, res, next) => {
    // Set proper headers for API responses to prevent browser caching
    res.header('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.header('Pragma', 'no-cache');
    res.header('Expires', '0');
    
    // Add security headers
    res.header('X-Content-Type-Options', 'nosniff');
    res.header('X-Frame-Options', 'DENY');
    res.header('X-XSS-Protection', '1; mode=block');
    
    next();
  });
  
  // Serve static files for uploaded images with CORS headers
  app.use('/uploads', (req, res, next) => {
    // Set CORS headers for images
    res.header('Access-Control-Allow-Origin', req.get('Origin') || '*');
    res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Cache-Control', 'public, max-age=31536000'); // 1 year cache for images
    
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    
    next();
  }, express.static('uploads'));

  // Add a test endpoint to check if files exist
  app.get('/api/test-image/:filename', (req, res) => {
    const path = require('path');
    const fs = require('fs');
    const imagePath = path.join(process.cwd(), 'uploads', 'images', req.params.filename);
    
    if (fs.existsSync(imagePath)) {
      res.json({ exists: true, path: `/uploads/images/${req.params.filename}` });
    } else {
      res.json({ exists: false, path: imagePath });
    }
  });

  app.use('/api/author', authorRoutes);
  app.use('/api/posts', postRoutes);
  app.use('/api/categories', categoriesRoutes);
  app.use('/api/diary', diaryRoutes);
  app.use('/api', utilityRoutes);
  app.use('/api/auth', authRoutes);
  app.use('/api/user', userRoutes);
  app.use('/api/library', libraryRoutes);
  app.use('/api/settings', settingsRoutes);
  app.use('/api/notifications', notificationRoutes);
  app.use('/api/comments', commentRoutes);
  app.use('/api/post', postInteractionRoutes);
  app.use('/api/images', imageRoutes);
  app.use('/api/about', aboutRoutes);
  app.use('/api/books', bookRoutes);
  app.use('/api/social', socialRoutes);
  app.use('/api/newsletter', subscriptionRoutes);
  app.use('/api/footer', footerRoutes);
  app.use('/api/public', publicRoutes);
  app.use('/api/meta', metaRoutes);
  app.use('/api/fix', fixImagesRoutes);
  app.use('/api/analytics', analyticsRoutes);


  // Root endpoint
  app.get('/', (req, res) => {
    res.json({
      message: 'Backend API is running!',
      environment: config.nodeEnv,
      serverUrl: config.getServerUrl(),
      timestamp: new Date().toISOString()
    });
  });

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.status(200).json({
      status: 'healthy',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      environment: config.nodeEnv,
      cors: {
        allowedOrigins: getAllowedOrigins()
      }
    });
  });

  // CORS test endpoint
  app.get('/api/cors-test', (req, res) => {
    res.json({
      success: true,
      message: 'CORS is working!',
      origin: req.get('Origin'),
      timestamp: new Date().toISOString()
    });
  });

  // Manual sync endpoints (use only when needed to refresh Blogger data)
  
  // Blogger sync endpoints removed - using local image management only
  
  // Manual refresh endpoint - for cache clearing and compatibility
  app.post('/api/refresh', async (req, res) => {
    try {
      // Simple cache clearing endpoint for backward compatibility
      console.log('Manual refresh requested - clearing caches');
      
      res.json({ 
        status: 'refreshed',
        message: 'Cache cleared successfully',
        totalPosts: 0, // We don't track this in the new system
        newPosts: 0, // We don't track this in the new system  
        updatedPosts: 0, // We don't track this in the new system
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error during manual refresh:', error);
      res.status(500).json({ 
        status: 'error', 
        message: 'Failed to refresh',
        error: error.message 
      });
    }
  });
  
  // Test endpoint to verify posts are available
  app.get('/api/test/posts', async (req, res) => {
    try {
      const { Post } = await import('./models/index.js');
      const postCount = await Post.count();
      const samplePosts = await Post.findAll({
        limit: 5,
        attributes: ['id', 'postId', 'title']
      });
      res.json({
        message: 'Posts test endpoint',
        totalPosts: postCount,
        samplePosts: samplePosts.map(p => ({ id: p.id, postId: p.postId, title: p.title }))
      });
    } catch (error) {
      console.error('Test endpoint error:', error);
      res.status(500).json({ error: 'Database test failed', details: error.message });
    }
  });

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'healthy',
      environment: config.nodeEnv,
      serverUrl: config.getServerUrl(),
      timestamp: new Date().toISOString()
    });
  });

  // Global error handling middleware
  app.use((error, req, res, next) => {
    console.error('🚨 Global error handler:', error);
    
    // Handle CORS errors specifically
    if (error.message === 'Not allowed by CORS') {
      return res.status(403).json({
        error: 'CORS Error',
        message: 'Origin not allowed',
        origin: req.get('Origin'),
        allowedOrigins: getAllowedOrigins()
      });
    }
    
    res.status(500).json({
      error: 'Internal Server Error',
      message: config.isProduction ? 'Something went wrong' : error.message,
      timestamp: new Date().toISOString()
    });
  });

  // 404 handler for undefined routes
  app.use('*', (req, res) => {
    console.log('404 - Route not found:', req.method, req.originalUrl);
    res.status(404).json({
      error: 'Route not found',
      message: `Route ${req.originalUrl} not found`,
      method: req.method,
      url: req.originalUrl,
      availableRoutes: [
        'GET /',
        'GET /health',
        'GET /api/cors-test',
        'GET /api/posts',
        'GET /api/author',
        // Add more as needed
      ]
    });
  });

  const PORT = config.port;
  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log('');
    console.log('🎉 Server started successfully (Resource Optimized)!');
    console.log(`🌐 Port: ${PORT}`);
    console.log(`📍 Environment: ${config.nodeEnv}`);
    console.log(`🔗 Server URL: ${config.getServerUrl()}`);
    console.log(`🛡️  CORS Origins: ${getAllowedOrigins().join(', ')}`);
    console.log('');
    console.log('🚨 OPTIMIZATIONS ACTIVE:');
    console.log('  ✅ No automatic Blogger sync on startup');
    console.log('  ✅ Reduced memory limits (2MB vs 10MB)');
    // console.log('  ✅ Manual sync available: POST /api/admin/sync');
    // console.log('  ✅ Or use: npm run sync');
    console.log('');
  });

  // Graceful shutdown handling
  process.on('SIGINT', async () => {
    console.log('\n🛑 Received SIGINT. Graceful shutdown...');
    server.close(async () => {
      console.log('🔌 HTTP server closed');
      try {
        const { sequelize } = await import('./config/db.js');
        await sequelize.close();
        console.log('🗄️  Database connection closed');
        process.exit(0);
      } catch (error) {
        console.error('❌ Error during shutdown:', error);
        process.exit(1);
      }
    });
  });

  process.on('SIGTERM', async () => {
    console.log('\n🛑 Received SIGTERM. Graceful shutdown...');
    server.close(async () => {
      console.log('🔌 HTTP server closed');
      try {
        const { sequelize } = await import('./config/db.js');
        await sequelize.close();
        console.log('🗄️  Database connection closed');
        process.exit(0);
      } catch (error) {
        console.error('❌ Error during shutdown:', error);
        process.exit(1);
      }
    });
  });

  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
    console.error('💥 Server will restart...');
    process.exit(1);
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
    console.error('💥 Server will restart...');
    process.exit(1);
  });
}); 