#!/usr/bin/env node

/**
 * Batch Post Image Migration Script
 * 
 * This script migrates post images in small batches with detailed progress reporting.
 * Run with: node scripts/batch-migrate-images.js [batch_size] [start_offset]
 * 
 * Examples:
 * node scripts/batch-migrate-images.js 5 0    # Process 5 posts starting from 0
 * node scripts/batch-migrate-images.js 10 5   # Process 10 posts starting from offset 5
 */

import Post from '../models/Post.js';
import { sequelize } from '../config/db.js';
import { Op } from 'sequelize';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get command line arguments
const args = process.argv.slice(2);
const BATCH_SIZE = parseInt(args[0]) || 5;
const START_OFFSET = parseInt(args[1]) || 0;

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, '..', 'uploads', 'images');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

let imageCounter = Date.now();

function generateSafeFilename(url, postTitle, type = 'post') {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    
    let extension = path.extname(pathname).toLowerCase();
    if (!extension || !['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(extension)) {
      extension = '.jpg';
    }
    
    const safeTitle = postTitle
      ? postTitle.replace(/[^a-zA-Z0-9\u0B80-\u0BFF]/g, '_')
        .replace(/_+/g, '_')
        .substring(0, 50)
      : 'unnamed';
    
    const timestamp = ++imageCounter;
    return `${type}_${safeTitle}_${timestamp}${extension}`;
    
  } catch (error) {
    const timestamp = ++imageCounter;
    return `${type}_image_${timestamp}.jpg`;
  }
}

async function downloadImage(url, filename) {
  try {
    console.log(`   📥 Downloading: ${url.substring(0, 80)}...`);
    
    const response = await axios({
      method: 'GET',
      url: url,
      responseType: 'arraybuffer',
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ImageDownloader/1.0)'
      }
    });
    
    if (response.status !== 200) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const buffer = Buffer.from(response.data);
    const filepath = path.join(uploadsDir, filename);
    
    // Use sharp to process and optimize the image
    await sharp(buffer)
      .resize(1200, 1200, { 
        fit: 'inside', 
        withoutEnlargement: true 
      })
      .jpeg({ quality: 85 })
      .toFile(filepath);
    
    console.log(`   ✅ Saved: ${filename}`);
    return `/uploads/images/${filename}`;
    
  } catch (error) {
    console.error(`   ❌ Failed to download:`, error.message);
    return null;
  }
}

function extractImageUrls(htmlContent) {
  if (!htmlContent) return [];
  
  const imgRegex = /<img[^>]+src=['"]([^'"]+)['"][^>]*>/gi;
  const imageUrls = [];
  let match;
  
  while ((match = imgRegex.exec(htmlContent)) !== null) {
    const url = match[1];
    if (!url.startsWith('data:') && 
        !url.includes('1x1') && 
        !url.includes('spacer') &&
        !url.startsWith('/uploads/') &&
        (url.includes('blogger.googleusercontent.com') || 
         url.includes('blogspot.com') ||
         url.includes('bp.blogspot.com'))) {
      imageUrls.push({
        url: url,
        fullMatch: match[0]
      });
    }
  }
  
  return imageUrls;
}

async function processPost(post, postIndex, totalPosts) {
  console.log(`\n📝 Processing [${postIndex + 1}/${totalPosts}]: ${post.title} (ID: ${post.id})`);
  
  let updatedContent = post.content;
  let updatedCoverImage = post.coverImage;
  const downloadedImages = [];
  
  try {
    // Process cover image
    if (post.coverImage && 
        (post.coverImage.includes('blogger.googleusercontent.com') || 
         post.coverImage.includes('blogspot.com'))) {
      
      console.log(`   🖼️  Processing cover image...`);
      const coverFilename = generateSafeFilename(post.coverImage, post.title, 'cover');
      const localCoverPath = await downloadImage(post.coverImage, coverFilename);
      
      if (localCoverPath) {
        updatedCoverImage = localCoverPath;
        downloadedImages.push({
          original: post.coverImage,
          local: localCoverPath,
          type: 'cover'
        });
      }
    }
    
    // Process images in content
    const contentImages = extractImageUrls(post.content);
    console.log(`   🎨 Found ${contentImages.length} images in content`);
    
    for (const imageInfo of contentImages) {
      const filename = generateSafeFilename(imageInfo.url, post.title, 'content');
      const localPath = await downloadImage(imageInfo.url, filename);
      
      if (localPath) {
        updatedContent = updatedContent.replace(imageInfo.url, localPath);
        downloadedImages.push({
          original: imageInfo.url,
          local: localPath,
          type: 'content'
        });
      }
    }
    
    // Update the post in database
    if (downloadedImages.length > 0) {
      await post.update({
        coverImage: updatedCoverImage,
        content: updatedContent,
        images: downloadedImages.map(img => img.local)
      });
      
      console.log(`   ✅ Updated post with ${downloadedImages.length} images`);
    } else {
      console.log(`   ⏭️  No images to migrate`);
    }
    
    return {
      success: true,
      imagesDownloaded: downloadedImages.length
    };
    
  } catch (error) {
    console.error(`   ❌ Error processing post ${post.id}:`, error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

async function batchMigrateImages() {
  try {
    console.log('🚀 Starting batch image migration...');
    console.log(`📦 Batch size: ${BATCH_SIZE}`);
    console.log(`📍 Starting offset: ${START_OFFSET}`);
    
    await sequelize.authenticate();
    console.log('✅ Database connected successfully');
    
    // Get total count first
    const totalCount = await Post.count({
      where: {
        [Op.or]: [
          {
            coverImage: {
              [Op.like]: '%blogger.googleusercontent.com%'
            }
          },
          {
            coverImage: {
              [Op.like]: '%blogspot.com%'
            }
          },
          {
            content: {
              [Op.like]: '%blogger.googleusercontent.com%'
            }
          },
          {
            content: {
              [Op.like]: '%blogspot.com%'
            }
          }
        ]
      }
    });
    
    console.log(`📊 Total posts with external images: ${totalCount}`);
    console.log(`📦 Processing batch: ${START_OFFSET + 1} to ${Math.min(START_OFFSET + BATCH_SIZE, totalCount)}`);
    
    // Get posts for this batch
    const posts = await Post.findAll({
      where: {
        [Op.or]: [
          {
            coverImage: {
              [Op.like]: '%blogger.googleusercontent.com%'
            }
          },
          {
            coverImage: {
              [Op.like]: '%blogspot.com%'
            }
          },
          {
            content: {
              [Op.like]: '%blogger.googleusercontent.com%'
            }
          },
          {
            content: {
              [Op.like]: '%blogspot.com%'
            }
          }
        ]
      },
      limit: BATCH_SIZE,
      offset: START_OFFSET,
      order: [['id', 'ASC']]
    });
    
    if (posts.length === 0) {
      console.log('🎉 No posts found in this batch range. Migration complete!');
      return;
    }
    
    console.log(`📚 Found ${posts.length} posts in this batch`);
    
    let successCount = 0;
    let errorCount = 0;
    let totalImagesDownloaded = 0;
    
    // Process each post in sequence
    for (let i = 0; i < posts.length; i++) {
      const result = await processPost(posts[i], i, posts.length);
      
      if (result.success) {
        successCount++;
        totalImagesDownloaded += result.imagesDownloaded;
      } else {
        errorCount++;
      }
      
      // Brief pause between posts (except for the last one)
      if (i < posts.length - 1) {
        console.log('   ⏸️  Waiting 2 seconds before next post...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    console.log('\n📊 Batch Migration Summary:');
    console.log('============================');
    console.log(`✅ Successfully processed: ${successCount} posts`);
    console.log(`❌ Failed: ${errorCount} posts`);
    console.log(`🖼️  Total images downloaded: ${totalImagesDownloaded}`);
    console.log(`📦 Batch range: ${START_OFFSET + 1} to ${START_OFFSET + posts.length}`);
    console.log(`📊 Overall progress: ${START_OFFSET + posts.length}/${totalCount} posts processed`);
    
    if (START_OFFSET + BATCH_SIZE < totalCount) {
      console.log('\n🔄 Next batch command:');
      console.log(`node scripts/batch-migrate-images.js ${BATCH_SIZE} ${START_OFFSET + BATCH_SIZE}`);
    } else {
      console.log('\n🎉 All batches completed! Migration finished!');
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await sequelize.close();
    console.log('\n🔒 Database connection closed');
    process.exit(0);
  }
}

// Handle unhandled rejections
process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled rejection:', error);
  process.exit(1);
});

// Run the migration
batchMigrateImages();
