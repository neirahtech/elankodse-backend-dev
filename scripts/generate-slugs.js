import Post from '../models/Post.js';
import { sequelize } from '../config/db.js';

async function generateSlugsForAllPosts() {
  try {
    console.log('🔄 Starting slug generation for all posts...');
    
    await sequelize.authenticate();
    console.log('✅ Connected to database successfully');
    
    // Get all posts (we'll regenerate all slugs)
    const posts = await Post.findAll({
      attributes: ['id', 'title', 'urlSlug'],
      order: [['id', 'ASC']]
    });
    
    console.log(`📝 Found ${posts.length} posts to process`);
    
    let updatedCount = 0;
    let errorCount = 0;
    
    for (const post of posts) {
      try {
        if (!post.title) {
          console.log(`   ⚠️ Post ${post.id} has no title, skipping...`);
          continue;
        }

        // Force update slug to exact title (Tamil or any language), no skipping
        await post.update({ urlSlug: post.title });
        console.log(`✅ Forced update: post ${post.id}: "${post.title}" → "${post.title}"`);
        updatedCount++;
      } catch (error) {
        console.error(`❌ Error updating post ${post.id}: ${error.message}`);
        errorCount++;
      }
    }
    
    console.log('\n📊 Slug Generation Summary:');
    console.log('==========================');
    console.log(`✅ Successfully updated: ${updatedCount} posts`);
    console.log(`❌ Errors: ${errorCount} posts`);
    console.log(`📝 Total processed: ${posts.length} posts`);
    
  } catch (error) {
    console.error('❌ Slug generation failed:', error.message);
    throw error;
  } finally {
    // Don't close connection here - let it stay open for the entire process
  }
}

// Handle unhandled rejections
process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled rejection:', error);
  process.exit(1);
});

process.on('SIGINT', async () => {
  console.log('\n🛑 Received SIGINT. Graceful shutdown...');
  try {
    await sequelize.close();
    console.log('🔒 Database connection closed');
  } catch (error) {
    console.error('Error closing database connection:', error.message);
  }
  process.exit(0);
});

// Run the script
generateSlugsForAllPosts()
  .then(async () => {
    try {
      await sequelize.close();
      console.log('\n🔒 Database connection closed');
    } catch (error) {
      console.error('Error closing database connection:', error.message);
    }
    console.log('\n🎉 Slug generation completed successfully!');
    process.exit(0);
  })
  .catch(async (error) => {
    try {
      await sequelize.close();
      console.log('\n🔒 Database connection closed');
    } catch (closeError) {
      console.error('Error closing database connection:', closeError.message);
    }
    console.error('\n💥 Slug generation failed:', error);
    process.exit(1);
  });
