import Post from '../models/Post.js';
import Image from '../models/Image.js';
import { sequelize } from '../config/db.js';
import { Op } from 'sequelize';
import axios from 'axios';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';

// Configuration
const BATCH_SIZE = 10;
const MAX_RETRIES = 3;
const DELAY_BETWEEN_BATCHES = 5000;
const BLOGGER_API_KEY = 'AIzaSyDPyVbsQxvXi_FhQJo1zzmjNL98cIlS-yw';
const BLOGGER_BLOG_ID = '9143217'; // Your blog ID
const BLOGGER_API_BASE = 'https://www.googleapis.com/blogger/v3/blogs';

// Ensure uploads directory exists
function ensureUploadsDirectory() {
  const uploadsDir = path.join(process.cwd(), 'uploads', 'images');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
    console.log(`📁 Created uploads directory: ${uploadsDir}`);
  }
  return uploadsDir;
}

async function fetchBloggerPosts(pageToken = null, maxResults = 10) {
  try {
    let url = `${BLOGGER_API_BASE}/${BLOGGER_BLOG_ID}/posts`;
    const params = {
      key: BLOGGER_API_KEY,
      maxResults: maxResults,
      status: 'live',
      fetchImages: true,
      fields: 'items(id,title,content,images),nextPageToken'
    };

    if (pageToken) {
      params.pageToken = pageToken;
    }

    const response = await axios.get(url, { params });
    return response.data;
  } catch (error) {
    console.error('❌ Error fetching from Blogger API:', error.message);
    throw error;
  }
}

async function downloadAndProcessImage(imageUrl, postId, imageType, index = 0) {
  try {
    console.log(`   📥 Downloading image: ${imageUrl.substring(0, 80)}...`);
    
    const response = await axios({
      method: 'GET',
      url: imageUrl,
      responseType: 'arraybuffer',
      timeout: 30000
    });

    if (!response.data) {
      throw new Error('Empty response data');
    }

    const buffer = Buffer.from(response.data);
    
    // Process with Sharp
    const imageInfo = await sharp(buffer).metadata();
    
    // Optimize image
    const optimizedBuffer = await sharp(buffer)
      .resize(1200, 1200, { 
        fit: 'inside', 
        withoutEnlargement: true 
      })
      .jpeg({ 
        quality: 85, 
        progressive: true 
      })
      .toBuffer();

    // Save to file system
    const timestamp = Date.now();
    const filename = `${imageType}_${postId}_${timestamp}_${index}.jpg`;
    const uploadsDir = ensureUploadsDirectory();
    const filePath = path.join(uploadsDir, filename);
    
    fs.writeFileSync(filePath, optimizedBuffer);
    
    const imagePath = `/uploads/images/${filename}`;
    
    // Create image record
    const imageRecord = await Image.create({
      name: `${imageType} image for post ${postId}`,
      type: `post_${imageType}`,
      filename: filename,
      originalName: filename,
      path: imagePath,
      url: `${process.env.SERVER_URL || 'http://localhost:8084'}${imagePath}`,
      size: optimizedBuffer.length,
      mimeType: 'image/jpeg',
      width: imageInfo.width,
      height: imageInfo.height,
      isActive: true,
      description: `Image migrated from Blogger API for post: ${postId}`
    });

    console.log(`   ✅ Image saved: ${filename} (${(optimizedBuffer.length / 1024).toFixed(2)}KB)`);
    return imageRecord;

  } catch (error) {
    console.error(`   ❌ Error processing image: ${error.message}`);
    return null;
  }
}

async function processPost(bloggerPost) {
  try {
    console.log(`\n📝 Processing Blogger post: ${bloggerPost.title}`);
    
    // Find or create local post
    let localPost = await Post.findOne({
      where: {
        postId: bloggerPost.id.toString()
      }
    });

    if (!localPost) {
      console.log(`   ⚠️ Post not found locally (postId: ${bloggerPost.id}), skipping...`);
      return false;
    }
    
    console.log(`   ✅ Found local post (ID: ${localPost.id}, postId: ${localPost.postId})`);

    // Process featured image if available
    if (bloggerPost.images && bloggerPost.images.length > 0) {
      const featuredImage = bloggerPost.images[0];
      const imageRecord = await downloadAndProcessImage(
        featuredImage.url,
        localPost.id,
        'cover'
      );
      
      if (imageRecord) {
        localPost.coverImage = imageRecord.path;
        await localPost.save();
        console.log(`   ✅ Updated post cover image: ${imageRecord.filename}`);
      }
    }

    // Extract and process content images
    const imgRegex = /<img[^>]+src=['"]([^'"]+)['"][^>]*>/gi;
    let match;
    let contentImageIndex = 0;
    
    while ((match = imgRegex.exec(bloggerPost.content)) !== null) {
      const contentImageUrl = match[1];
      if (contentImageUrl && !contentImageUrl.startsWith('data:') && !contentImageUrl.startsWith('/uploads/')) {
        console.log(`   📷 Processing content image ${contentImageIndex + 1}`);
        const contentImageRecord = await downloadAndProcessImage(
          contentImageUrl,
          localPost.id,
          'content',
          contentImageIndex++
        );
        if (contentImageRecord) {
          console.log(`   ✅ Saved content image: ${contentImageRecord.filename}`);
        }
      }
    }

    return true;

  } catch (error) {
    console.error(`   ❌ Error processing post: ${error.message}`);
    return false;
  }
}

async function migrateAllPosts() {
  try {
    console.log('🚀 Starting Blogger API Migration...');
    console.log('===================================');
    
    await sequelize.authenticate();
    console.log('✅ Connected to database successfully');
    
    let processedCount = 0;
    let successCount = 0;
    let errorCount = 0;
    let nextPageToken = null;
    const targetPosts = 110;

    while (processedCount < targetPosts) {
      const maxResults = Math.min(10, targetPosts - processedCount);
      
      console.log(`\n📚 Fetching batch of ${maxResults} posts (${processedCount + 1}-${processedCount + maxResults})`);
      
      try {
        const bloggerData = await fetchBloggerPosts(nextPageToken, maxResults);
        
        if (!bloggerData.items || bloggerData.items.length === 0) {
          console.log('   ⚠️ No more posts found in Blogger');
          break;
        }

        for (const bloggerPost of bloggerData.items) {
          const success = await processPost(bloggerPost);
          if (success) {
            successCount++;
          } else {
            errorCount++;
          }
          processedCount++;
          
          if (processedCount >= targetPosts) {
            break;
          }
        }

        nextPageToken = bloggerData.nextPageToken;
        
        // Progress update
        const progress = (processedCount / targetPosts * 100).toFixed(1);
        console.log(`\n📊 Progress: ${progress}% (${processedCount}/${targetPosts} posts)`);
        
        if (processedCount < targetPosts && nextPageToken) {
          console.log(`⏸️  Waiting ${DELAY_BETWEEN_BATCHES/1000}s before next batch...`);
          await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
        }

      } catch (error) {
        console.error(`❌ Error in batch: ${error.message}`);
        errorCount++;
        
        if (error.response?.status === 403) {
          console.error('❌ API quota exceeded or permission denied');
          break;
        }
      }
    }

    console.log('\n📊 Migration Summary:');
    console.log('====================');
    console.log(`✅ Successfully processed: ${successCount} posts`);
    console.log(`❌ Failed: ${errorCount} posts`);
    console.log(`📚 Total processed: ${processedCount}/${targetPosts} posts`);

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    throw error;
  } finally {
    try {
      await sequelize.close();
      console.log('\n🔒 Database connection closed');
    } catch (error) {
      console.error('Error closing database connection:', error.message);
    }
  }
}

// Handle unhandled rejections
process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled rejection:', error);
  process.exit(1);
});

process.on('SIGINT', async () => {
  console.log('\n🛑 Received interrupt signal. Cleaning up...');
  try {
    await sequelize.close();
  } catch (error) {
    console.error('Error during cleanup:', error.message);
  }
  process.exit(0);
});

// Run the migration
migrateAllPosts().then(() => {
  console.log('\n🎉 Blogger API migration completed!');
  process.exit(0);
}).catch((error) => {
  console.error('\n❌ Blogger API migration failed:', error);
  process.exit(1);
}); 