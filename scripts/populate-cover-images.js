import { Post } from '../models/index.js';
import { sequelize } from '../config/db.js';

// Function to extract first image URL from HTML content
function extractFirstImageFromContent(content) {
  if (!content) return null;
  
  // Look for img tags in the content
  const imgRegex = /<img[^>]+src\s*=\s*["']([^"']+)["'][^>]*>/i;
  const match = content.match(imgRegex);
  
  if (match && match[1]) {
    let imageUrl = match[1];
    
    // Clean up the URL
    imageUrl = imageUrl.trim();
    
    // Skip very small images (likely icons or decorative elements)
    if (imageUrl.includes('1x1') || imageUrl.includes('icon') || imageUrl.includes('spacer')) {
      return null;
    }
    
    // Skip data URLs (embedded images)
    if (imageUrl.startsWith('data:')) {
      return null;
    }
    
    return imageUrl;
  }
  
  return null;
}

async function populateCoverImages() {
  try {
    console.log('🚀 Starting cover image population...');
    
    // Get count of posts without cover images first
    const totalCount = await Post.count({
      where: {
        coverImage: ['', null]
      }
    });
    
    console.log(`📊 Found ${totalCount} posts without cover images`);
    
    let updatedCount = 0;
    let processedCount = 0;
    const batchSize = 10; // Process 10 posts at a time
    
    // Process posts in batches
    for (let offset = 0; offset < totalCount; offset += batchSize) {
      console.log(`� Processing batch ${Math.floor(offset/batchSize) + 1}/${Math.ceil(totalCount/batchSize)} (posts ${offset + 1}-${Math.min(offset + batchSize, totalCount)})`);
      
      const postsWithoutCoverImages = await Post.findAll({
        where: {
          coverImage: ['', null]
        },
        attributes: ['id', 'title', 'content', 'coverImage'],
        limit: batchSize,
        offset: offset
      });
      
      for (const post of postsWithoutCoverImages) {
        processedCount++;
        
        const coverImage = extractFirstImageFromContent(post.content);
        
        if (coverImage) {
          await Post.update(
            { coverImage: coverImage },
            { where: { id: post.id } }
          );
          
          updatedCount++;
          console.log(`✅ Updated post ${post.id}: ${post.title.substring(0, 50)}...`);
          console.log(`   Cover image: ${coverImage.substring(0, 80)}...`);
        } else {
          console.log(`⚠️  No image found in post ${post.id}: ${post.title.substring(0, 50)}...`);
        }
      }
      
      // Progress indicator
      console.log(`📈 Progress: ${processedCount}/${totalCount} posts processed, ${updatedCount} updated`);
    }
    
    console.log('\n🎉 Cover image population completed!');
    console.log(`📊 Summary:`);
    console.log(`   - Total posts processed: ${processedCount}`);
    console.log(`   - Posts updated with cover images: ${updatedCount}`);
    console.log(`   - Posts without images: ${processedCount - updatedCount}`);
    
    await sequelize.close();
    
  } catch (error) {
    console.error('❌ Error populating cover images:', error);
    await sequelize.close();
    process.exit(1);
  }
}

// Run the script
populateCoverImages();

export { populateCoverImages, extractFirstImageFromContent };
