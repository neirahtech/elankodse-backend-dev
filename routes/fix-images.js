import express from 'express';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import Post from '../models/Post.js';
import Image from '../models/Image.js';
import { Op } from 'sequelize';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Global migration state
let migrationState = {
  isRunning: false,
  currentBatch: 0,
  totalPosts: 0,
  processedPosts: 0,
  successCount: 0,
  errorCount: 0,
  currentPost: null,
  startTime: null,
  errors: []
};

// Create uploads directory on server startup
const createUploadsDirectory = () => {
  try {
    const uploadsDir = path.join(process.cwd(), 'uploads');
    const imagesDir = path.join(process.cwd(), 'uploads', 'images');
    
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true, mode: 0o755 });
      console.log('📁 Created uploads directory on server');
    }
    
    if (!fs.existsSync(imagesDir)) {
      fs.mkdirSync(imagesDir, { recursive: true, mode: 0o755 });
      console.log('📁 Created images directory on server');
    }
    
    // Test write permissions
    const testFile = path.join(imagesDir, 'server_test.txt');
    fs.writeFileSync(testFile, 'Server upload test');
    fs.unlinkSync(testFile);
    console.log('✅ Server upload directory is writable');
    
    return { success: true, uploadsDir, imagesDir };
  } catch (error) {
    console.error('❌ Failed to create uploads directory on server:', error);
    return { success: false, error: error.message };
  }
};

// Initialize uploads directory when module loads
const uploadsSetup = createUploadsDirectory();

let imageCounter = Date.now();

const generateSafeFilename = (url, postTitle, type = 'post') => {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    
    let extension = path.extname(pathname).toLowerCase();
    if (!extension || !['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(extension)) {
      extension = '.jpg';
    }
    
    const safeTitle = postTitle
      ? postTitle.replace(/[^a-zA-Z0-9\u0B80-\u0BFF\s]/g, '')
        .replace(/\s+/g, '_')
        .substring(0, 30)
      : 'unnamed';
    
    const timestamp = ++imageCounter;
    const filename = `${type}_${safeTitle}_${timestamp}${extension}`;
    
    return filename.length > 100 ? `${type}_${timestamp}${extension}` : filename;
    
  } catch (error) {
    const timestamp = ++imageCounter;
    return `${type}_image_${timestamp}.jpg`;
  }
};

const downloadImageToServer = async (url, filename, retryCount = 0) => {
  const MAX_RETRIES = 3;
  const RETRY_DELAY = 2000;
  
  try {
    console.log(`   📥 Downloading to server (attempt ${retryCount + 1}): ${url.substring(0, 80)}...`);
    
    const cleanUrl = url.trim().replace(/^\/\//, 'https://');
    
    const response = await axios({
      method: 'GET',
      url: cleanUrl,
      responseType: 'arraybuffer',
      timeout: 45000,
      maxRedirects: 5,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    });
    
    if (response.status !== 200) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    if (!response.data || response.data.byteLength === 0) {
      throw new Error('Empty response data');
    }
    
    const buffer = Buffer.from(response.data);
    const serverImagePath = path.join(process.cwd(), 'uploads', 'images', filename);
    
    // Validate and process image using Sharp
    const imageInfo = await sharp(buffer).metadata();
    if (!imageInfo.width || !imageInfo.height) {
      throw new Error('Invalid image data');
    }
    
    // Save optimized image to server
    await sharp(buffer)
      .resize(1200, 1200, { 
        fit: 'inside', 
        withoutEnlargement: true 
      })
      .jpeg({ 
        quality: 85, 
        progressive: true 
      })
      .toFile(serverImagePath);
    
    // Verify file exists on server
    if (!fs.existsSync(serverImagePath)) {
      throw new Error('File was not saved to server');
    }
    
    const stats = fs.statSync(serverImagePath);
    console.log(`   ✅ Saved to server: ${filename} (${(stats.size / 1024).toFixed(2)}KB)`);
    
    return `/uploads/images/${filename}`;
    
  } catch (error) {
    console.error(`   ❌ Server download failed (attempt ${retryCount + 1}):`, error.message);
    
    if (retryCount < MAX_RETRIES - 1) {
      const delay = RETRY_DELAY * (retryCount + 1);
      console.log(`   ⏳ Retrying in ${delay/1000}s...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return downloadImageToServer(url, filename, retryCount + 1);
    }
    
    return null;
  }
};

const extractImageUrls = (htmlContent) => {
  if (!htmlContent) return [];
  
  const imgPatterns = [
    /<img[^>]+src=['"]([^'"]+)['"][^>]*>/gi,
    /<img[^>]+data-src=['"]([^'"]+)['"][^>]*>/gi,
  ];
  
  const imageUrls = new Set();
  
  imgPatterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(htmlContent)) !== null) {
      const url = match[1];
      if (url && 
          !url.startsWith('data:') && 
          !url.includes('1x1') && 
          !url.includes('spacer') &&
          !url.startsWith('/uploads/') &&
          (url.includes('blogger.googleusercontent.com') || 
           url.includes('blogspot.com') ||
           url.includes('bp.blogspot.com') ||
           url.includes('lh3.googleusercontent.com'))) {
        imageUrls.add({
          url: url,
          fullMatch: match[0]
        });
      }
    }
  });
  
  return Array.from(imageUrls);
};

// API Route: Test server setup
router.get('/test-server-setup', async (req, res) => {
  const results = {
    timestamp: new Date().toISOString(),
    tests: {}
  };

  try {
    // Test 1: Check if uploads directory can be created
    results.tests.uploadsDirectory = await testUploadsDirectory();
    
    // Test 2: Test image download capability
    results.tests.imageDownload = await testImageDownload();
    
    // Test 3: Check database connectivity
    results.tests.database = await testDatabaseConnection();
    
    // Test 4: Check Sharp library
    results.tests.imageProcessing = await testImageProcessing();
    
    // Test 5: Check sample posts with external images
    results.tests.samplePosts = await testSamplePosts();

    const allTestsPassed = Object.values(results.tests).every(test => test.success);
    
    res.json({
      success: allTestsPassed,
      message: allTestsPassed 
        ? 'All tests passed! Server is ready for migration.' 
        : 'Some tests failed. Check details below.',
      ...results
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Test failed',
      details: error.message,
      ...results
    });
  }
});

// Test functions
async function testUploadsDirectory() {
  try {
    const uploadsDir = path.join(process.cwd(), 'uploads');
    const imagesDir = path.join(process.cwd(), 'uploads', 'images');
    
    // Create directories
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    if (!fs.existsSync(imagesDir)) {
      fs.mkdirSync(imagesDir, { recursive: true });
    }
    
    // Test write permissions
    const testFile = path.join(imagesDir, `test_${Date.now()}.txt`);
    fs.writeFileSync(testFile, 'Server test file');
    const stats = fs.statSync(testFile);
    fs.unlinkSync(testFile);
    
    return {
      success: true,
      uploadsDir,
      imagesDir,
      writable: true,
      testFileSize: stats.size
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      uploadsDir: path.join(process.cwd(), 'uploads'),
      imagesDir: path.join(process.cwd(), 'uploads', 'images')
    };
  }
}

async function testImageDownload() {
  try {
    // Try a simple HTTP request to blogger domain
    const response = await axios.head('https://blogger.googleusercontent.com/', {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ImageTest/1.0)'
      }
    });
    
    return {
      success: true,
      canConnectToBlogger: response.status === 200,
      message: 'Can connect to Blogger domain'
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      message: 'Cannot connect to Blogger (this might be normal)'
    };
  }
}

async function testDatabaseConnection() {
  try {
    const { sequelize } = await import('../config/db.js');
    await sequelize.authenticate();
    
    // Test a simple query
    const testQuery = await sequelize.query('SELECT 1 as test');
    
    return {
      success: true,
      connected: true,
      testQueryResult: testQuery[0][0].test
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      connected: false
    };
  }
}

async function testImageProcessing() {
  try {
    // Test Sharp library - just check if we can import it
    const testResult = await sharp({
      create: {
        width: 10,
        height: 10,
        channels: 3,
        background: { r: 255, g: 0, b: 0 }
      }
    }).jpeg().toBuffer();
    
    return {
      success: true,
      sharpLoaded: true,
      testImageSize: testResult.length
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      sharpLoaded: false,
      fix: 'Run: npm install sharp'
    };
  }
}

async function testSamplePosts() {
  try {
    // Count posts with external images
    const externalImagePosts = await Post.count({
      where: {
        [Op.or]: [
          {
            coverImage: {
              [Op.like]: '%blogger.googleusercontent.com%'
            }
          },
          {
            content: {
              [Op.like]: '%blogger.googleusercontent.com%'
            }
          }
        ]
      }
    });
    
    // Get a sample post
    const samplePost = await Post.findOne({
      where: {
        [Op.or]: [
          {
            coverImage: {
              [Op.like]: '%blogger.googleusercontent.com%'
            }
          },
          {
            content: {
              [Op.like]: '%blogger.googleusercontent.com%'
            }
          }
        ]
      },
      attributes: ['id', 'title', 'coverImage']
    });
    
    return {
      success: true,
      postsWithExternalImages: externalImagePosts,
      samplePost: samplePost ? {
        id: samplePost.id,
        title: samplePost.title?.substring(0, 50) + '...',
        hasCoverImage: !!samplePost.coverImage
      } : null,
      migrationNeeded: externalImagePosts > 0
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      postsWithExternalImages: 'unknown'
    };
  }
}

// API Route: Start server-side migration
router.post('/server-migrate-images', async (req, res) => {
  if (migrationState.isRunning) {
    return res.json({
      success: false,
      message: 'Migration is already running',
      state: migrationState
    });
  }

  try {
    const { batchSize = 5, startOffset = 0 } = req.body;
    
    // Check uploads directory
    if (!uploadsSetup.success) {
      return res.status(500).json({
        success: false,
        error: 'Server uploads directory is not ready',
        details: uploadsSetup.error
      });
    }

    // Initialize migration state
    migrationState = {
      isRunning: true,
      currentBatch: 0,
      totalPosts: 0,
      processedPosts: 0,
      successCount: 0,
      errorCount: 0,
      currentPost: null,
      startTime: new Date(),
      errors: [],
      batchSize,
      startOffset
    };

    // Get total count of posts needing migration
    const totalCount = await Post.count({
      where: {
        [Op.or]: [
          {
            coverImage: {
              [Op.and]: [
                { [Op.ne]: null },
                { [Op.notLike]: '/uploads/%' },
                {
                  [Op.or]: [
                    { [Op.like]: '%blogger.googleusercontent.com%' },
                    { [Op.like]: '%blogspot.com%' },
                    { [Op.like]: '%lh3.googleusercontent.com%' }
                  ]
                }
              ]
            }
          },
          {
            content: {
              [Op.or]: [
                { [Op.like]: '%blogger.googleusercontent.com%' },
                { [Op.like]: '%blogspot.com%' },
                { [Op.like]: '%lh3.googleusercontent.com%' }
              ]
            }
          }
        ]
      }
    });

    migrationState.totalPosts = totalCount;

    if (totalCount === 0) {
      migrationState.isRunning = false;
      return res.json({
        success: true,
        message: 'No posts need image migration',
        totalPosts: 0
      });
    }

    // Send immediate response
    res.json({
      success: true,
      message: 'Server-side image migration started',
      state: {
        totalPosts: migrationState.totalPosts,
        batchSize: migrationState.batchSize,
        startOffset: migrationState.startOffset,
        serverUploadsDir: uploadsSetup.imagesDir
      },
      statusUrl: '/api/fix/migration-status'
    });

    // Start migration in background
    setTimeout(() => {
      runServerMigration(batchSize, startOffset);
    }, 1000);

  } catch (error) {
    migrationState.isRunning = false;
    console.error('Error starting server migration:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start server migration',
      details: error.message
    });
  }
});

// API Route: Trigger server migration script
router.post('/trigger-server-migration', async (req, res) => {
  try {
    console.log('🚀 Triggering server migration script...');
    
    // Import and run the server migration script
    const { spawn } = await import('child_process');
    const path = await import('path');
    
    const scriptPath = path.join(process.cwd(), 'scripts', 'server-migrate-images.js');
    
    console.log(`📜 Running script: ${scriptPath}`);
    
    const child = spawn('node', [scriptPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: process.cwd()
    });
    
    let output = '';
    let errorOutput = '';
    
    child.stdout.on('data', (data) => {
      const message = data.toString();
      output += message;
      console.log('📤 Migration output:', message.trim());
    });
    
    child.stderr.on('data', (data) => {
      const message = data.toString();
      errorOutput += message;
      console.error('❌ Migration error:', message.trim());
    });
    
    child.on('close', (code) => {
      console.log(`🏁 Migration script exited with code ${code}`);
      
      if (code === 0) {
        console.log('✅ Server migration completed successfully');
      } else {
        console.error('❌ Server migration failed');
      }
    });
    
    // Send immediate response
    res.json({
      success: true,
      message: 'Server migration script started',
      scriptPath: scriptPath,
      pid: child.pid,
      note: 'Check server logs for progress'
    });
    
  } catch (error) {
    console.error('❌ Error triggering server migration:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to trigger server migration',
      details: error.message
    });
  }
});

// Background migration function that runs on server
const runServerMigration = async (batchSize, startOffset) => {
  try {
    console.log('\n🚀 Starting SERVER-SIDE Image Migration...');
    console.log(`📦 Batch size: ${batchSize}`);
    console.log(`📍 Start offset: ${startOffset}`);
    console.log(`📁 Server uploads: ${uploadsSetup.imagesDir}`);

    const posts = await Post.findAll({
      where: {
        [Op.or]: [
          {
            coverImage: {
              [Op.and]: [
                { [Op.ne]: null },
                { [Op.notLike]: '/uploads/%' },
                {
                  [Op.or]: [
                    { [Op.like]: '%blogger.googleusercontent.com%' },
                    { [Op.like]: '%blogspot.com%' },
                    { [Op.like]: '%lh3.googleusercontent.com%' }
                  ]
                }
              ]
            }
          },
          {
            content: {
              [Op.or]: [
                { [Op.like]: '%blogger.googleusercontent.com%' },
                { [Op.like]: '%blogspot.com%' },
                { [Op.like]: '%lh3.googleusercontent.com%' }
              ]
            }
          }
        ]
      },
      limit: batchSize,
      offset: startOffset,
      order: [['id', 'ASC']]
    });

    console.log(`📚 Processing ${posts.length} posts on server...`);

    for (let i = 0; i < posts.length; i++) {
      const post = posts[i];
      migrationState.currentPost = {
        id: post.id,
        title: post.title,
        index: i + 1,
        total: posts.length
      };
      migrationState.processedPosts++;

      console.log(`\n📝 [${i + 1}/${posts.length}] Processing: ${post.title} (ID: ${post.id})`);

      try {
        let updatedContent = post.content;
        let updatedCoverImage = post.coverImage;
        const downloadedImages = [];
        let hasChanges = false;

        // Process cover image
        if (post.coverImage && 
            !post.coverImage.startsWith('/uploads/') &&
            (post.coverImage.includes('blogger.googleusercontent.com') || 
             post.coverImage.includes('blogspot.com') ||
             post.coverImage.includes('lh3.googleusercontent.com'))) {
          
          console.log(`   🖼️  Processing cover image on server...`);
          const coverFilename = generateSafeFilename(post.coverImage, post.title, 'cover');
          const localCoverPath = await downloadImageToServer(post.coverImage, coverFilename);
          
          if (localCoverPath) {
            updatedCoverImage = localCoverPath;
            downloadedImages.push({
              original: post.coverImage,
              local: localCoverPath,
              type: 'cover'
            });
            hasChanges = true;
          }
        }

        // Process content images
        const contentImages = extractImageUrls(post.content);
        console.log(`   🎨 Found ${contentImages.length} content images`);

        for (let j = 0; j < contentImages.length; j++) {
          const imageInfo = contentImages[j];
          const filename = generateSafeFilename(imageInfo.url, post.title, 'content');
          const localPath = await downloadImageToServer(imageInfo.url, filename);
          
          if (localPath) {
            const urlRegex = new RegExp(imageInfo.url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
            updatedContent = updatedContent.replace(urlRegex, localPath);
            
            downloadedImages.push({
              original: imageInfo.url,
              local: localPath,
              type: 'content'
            });
            hasChanges = true;
          }

          // Small delay between downloads
          if (j < contentImages.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }

        // Update post in database
        if (hasChanges) {
          await post.update({
            coverImage: updatedCoverImage,
            content: updatedContent,
            images: downloadedImages.map(img => img.local),
            updatedAt: new Date()
          });
          
          console.log(`   ✅ Updated post with ${downloadedImages.length} images saved to server`);
          migrationState.successCount++;
        } else {
          console.log(`   ⏭️  No external images to migrate`);
          migrationState.successCount++;
        }

      } catch (error) {
        console.error(`   ❌ Error processing post ${post.id}:`, error.message);
        migrationState.errorCount++;
        migrationState.errors.push({
          postId: post.id,
          title: post.title,
          error: error.message,
          timestamp: new Date()
        });
      }

      // Pause between posts
      if (i < posts.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    // Migration complete
    migrationState.isRunning = false;
    migrationState.endTime = new Date();
    
    console.log('\n📊 SERVER Migration Complete!');
    console.log('================================');
    console.log(`✅ Successfully processed: ${migrationState.successCount}`);
    console.log(`❌ Failed: ${migrationState.errorCount}`);
    console.log(`⏱️  Duration: ${((migrationState.endTime - migrationState.startTime) / 1000 / 60).toFixed(2)} minutes`);
    console.log(`📁 Images saved to: ${uploadsSetup.imagesDir}`);

  } catch (error) {
    migrationState.isRunning = false;
    migrationState.errors.push({
      error: 'Migration failed',
      details: error.message,
      timestamp: new Date()
    });
    console.error('❌ Server migration failed:', error);
  }
};

// API Route: Get migration status
router.get('/migration-status', async (req, res) => {
  try {
    // Get current counts
    const externalCount = await Post.count({
      where: {
        [Op.or]: [
          {
            coverImage: {
              [Op.and]: [
                { [Op.ne]: null },
                { [Op.notLike]: '/uploads/%' },
                {
                  [Op.or]: [
                    { [Op.like]: '%blogger.googleusercontent.com%' },
                    { [Op.like]: '%blogspot.com%' },
                    { [Op.like]: '%lh3.googleusercontent.com%' }
                  ]
                }
              ]
            }
          },
          {
            content: {
              [Op.or]: [
                { [Op.like]: '%blogger.googleusercontent.com%' },
                { [Op.like]: '%blogspot.com%' },
                { [Op.like]: '%lh3.googleusercontent.com%' }
              ]
            }
          }
        ]
      }
    });

    const localCount = await Post.count({
      where: {
        coverImage: { [Op.like]: '/uploads/%' }
      }
    });

    // Check server uploads directory
    let serverImageCount = 0;
    try {
      const serverImagesDir = path.join(process.cwd(), 'uploads', 'images');
      if (fs.existsSync(serverImagesDir)) {
        const files = fs.readdirSync(serverImagesDir);
        serverImageCount = files.filter(file => 
          file.match(/\.(jpg|jpeg|png|gif|webp)$/i)
        ).length;
      }
    } catch (error) {
      console.error('Error checking server images:', error);
    }

    res.json({
      success: true,
      migration: {
        isRunning: migrationState.isRunning,
        currentPost: migrationState.currentPost,
        processedPosts: migrationState.processedPosts,
        totalPosts: migrationState.totalPosts,
        successCount: migrationState.successCount,
        errorCount: migrationState.errorCount,
        startTime: migrationState.startTime,
        errors: migrationState.errors.slice(-5) // Last 5 errors
      },
      database: {
        postsWithExternalImages: externalCount,
        postsWithLocalImages: localCount,
        migrationNeeded: externalCount > 0
      },
      server: {
        uploadsDirectory: uploadsSetup.imagesDir,
        uploadsReady: uploadsSetup.success,
        imageFilesCount: serverImageCount
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get migration status',
      details: error.message
    });
  }
});

// API Route: Stop migration
router.post('/stop-migration', (req, res) => {
  if (!migrationState.isRunning) {
    return res.json({
      success: false,
      message: 'No migration is currently running'
    });
  }

  migrationState.isRunning = false;
  res.json({
    success: true,
    message: 'Migration stop requested',
    note: 'Current post will complete before stopping'
  });
});

// ========================================
// EXISTING FUNCTIONALITY (keep these)
// ========================================

// Fix missing image references (your existing code)
router.post('/fix-missing-images', async (req, res) => {
  try {
    console.log('Checking for missing image references...');
    
    const missingImages = await Image.findAll({
      where: {
        url: {
          [Op.like]: '%banner_1754119867135%'
        }
      }
    });

    if (missingImages.length > 0) {
      console.log('Found records with missing image:', missingImages);
      
      const replacementUrl = 'https://elankodse-backend.onrender.com/uploads/images/banner_1753710841801.webp';
      
      console.log(`Updating to use: ${replacementUrl}`);
      
      const updateResult = await Image.update(
        { url: replacementUrl },
        {
          where: {
            url: {
              [Op.like]: '%banner_1754119867135%'
            }
          }
        }
      );

      console.log(`Updated ${updateResult[0]} record(s)`);
      
      res.json({
        success: true,
        message: `Fixed ${updateResult[0]} missing image reference(s)`,
        updatedRecords: updateResult[0],
        replacementUrl: replacementUrl
      });
      
    } else {
      res.json({
        success: true,
        message: 'No missing image references found',
        updatedRecords: 0
      });
    }

  } catch (error) {
    console.error('Error fixing missing images:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Check for any missing image references (your existing code)
router.get('/check-missing-images', async (req, res) => {
  try {
    console.log('Checking for missing image references...');
    
    const missingImagePattern = 'banner_1754119867135';
    const results = {};
    
    const imageRows = await Image.findAll({
      where: {
        url: {
          [Op.like]: `%${missingImagePattern}%`
        }
      }
    });
    
    if (imageRows.length > 0) {
      results.images = imageRows;
    }
    
    const bannerImages = await Image.findAll({
      where: {
        url: {
          [Op.like]: '%banner_%'
        }
      },
      order: [['createdAt', 'DESC']]
    });
    
    res.json({
      success: true,
      missingImageReferences: results,
      availableBannerImages: bannerImages
    });

  } catch (error) {
    console.error('Error checking missing images:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;