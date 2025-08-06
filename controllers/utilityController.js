import axios from 'axios';
import Author from '../models/Author.js';
import Post from '../models/Post.js';

export const fetchAndCacheBloggerData = async (req, res) => {
  try {
    console.log('Starting Blogger sync...');
    
    // Fetch all posts (paginated) with all fields
    let allPosts = [];
    let pageToken = null;
    let firstPostAuthor = null;
    let pageCount = 0;
    
    do {
      // Request all fields we need
      let url = 'https://www.googleapis.com/blogger/v3/blogs/9143217/posts?key=AIzaSyD44Q_YctTPOndoPWrXZsBDJ1jNcOs4B1w&maxResults=500&fields=items(id,title,content,published,updated,labels,images,replies,author,url),nextPageToken';
      if (pageToken) url += `&pageToken=${pageToken}`;
      
      console.log(`Fetching page ${pageCount + 1}...`);
      let response;
      try {
        response = await axios.get(url, { timeout: 30000 }); // 30 second timeout for large requests
      } catch (err) {
        console.error('Error fetching Blogger posts:', err.message);
        if (err.response) {
          console.error('Response status:', err.response.status);
          console.error('Response data:', err.response.data);
        }
        throw err;
      }
      
      const data = response.data;
      pageCount++;
      
      if (data.items && Array.isArray(data.items)) {
        allPosts = allPosts.concat(data.items);
        if (!firstPostAuthor && data.items[0] && data.items[0].author) {
          firstPostAuthor = data.items[0].author;
        }
        console.log(`Fetched ${data.items.length} posts from page ${pageCount}`);
      }
      
      pageToken = data.nextPageToken;
      console.log(`Page ${pageCount} complete. Total posts so far: ${allPosts.length}`);
      
      // Add a small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } while (pageToken);
    
    console.log(`✅ Fetched all posts: ${allPosts.length} total`);

    // Fetch blog description for quote
    let blogQuote = '';
    try {
      console.log('Fetching blog description...');
      const blogRes = await axios.get('https://www.googleapis.com/blogger/v3/blogs/9143217?key=AIzaSyD44Q_YctTPOndoPWrXZsBDJ1jNcOs4B1w&fields=description');
      blogQuote = blogRes.data.description || '';
      console.log('✅ Fetched blog description.');
    } catch (err) {
      console.error('Error fetching blog description:', err.message);
    }

    // Upsert author
    if (firstPostAuthor) {
      console.log('Upserting author...');
      await Author.upsert({
        id: 1, // single author
        name: firstPostAuthor.displayName,
        avatar: firstPostAuthor.image?.url || '',
        quote: blogQuote,
        updatedAt: new Date(),
      });
      console.log('✅ Author upserted.');
    }

    // Get existing postIds
    console.log('Fetching existing post IDs...');
    const existingPosts = await Post.findAll({ attributes: ['postId'] });
    const existingPostIds = new Set(existingPosts.map(p => p.postId));
    console.log(`Found ${existingPostIds.size} existing posts`);

    // Separate new posts and existing posts that need updates
    const newPosts = allPosts.filter(item => !existingPostIds.has(item.id));
    const existingPostsToUpdate = allPosts.filter(item => existingPostIds.has(item.id));
    
    console.log(`New posts to insert: ${newPosts.length}`);
    console.log(`Existing posts to update: ${existingPostsToUpdate.length}`);

    // Process all posts (both new and existing)
    const allPostsToProcess = [...newPosts, ...existingPostsToUpdate];
    console.log(`Total posts to process: ${allPostsToProcess.length}`);

    if (allPostsToProcess.length === 0) {
      console.log('✅ No posts to process');
      if (res) return res.json({ status: 'no posts to process', totalPosts: allPosts.length });
      return;
    }

    // Bulk insert/update posts with improved data mapping
    const BATCH_SIZE = 50; // Smaller batch size for better error handling
    let insertedCount = 0;
    let updatedCount = 0;
    
    for (let i = 0; i < allPostsToProcess.length; i += BATCH_SIZE) {
      const batch = allPostsToProcess.slice(i, i + BATCH_SIZE).map(item => {
        // Parse published date properly
        const publishedDate = item.published ? new Date(item.published) : new Date();
        const updatedDate = item.updated ? new Date(item.updated) : publishedDate;
        
        // Extract cover image from images array
        let coverImage = '';
        if (item.images && Array.isArray(item.images) && item.images.length > 0) {
          coverImage = item.images[0].url || '';
        }
        
        // Process labels/categories
        let category = 'பொது'; // Default category
        let tags = [];
        if (item.labels && Array.isArray(item.labels) && item.labels.length > 0) {
          tags = item.labels;
          category = item.labels[0]; // First label as primary category
        }
        
        // Clean content for excerpt
        const cleanContent = item.content ? item.content.replace(/<[^>]+>/g, '').trim() : '';
        const excerpt = cleanContent.length > 200 ? cleanContent.substring(0, 200) + '...' : cleanContent;
        
        return {
          postId: item.id,
          title: item.title || 'Untitled',
          subtitle: '', // Can be extracted from content if needed
          date: publishedDate.toISOString().slice(0, 10), // YYYY-MM-DD format
          excerpt: excerpt,
          content: item.content || '',
          category: category,
          tags: tags, // Store all labels as JSON array
          coverImage: coverImage,
          images: item.images || [], // Store all images as JSON array
          url: item.url || '',
          comments: existingPostIds.has(item.id) ? undefined : (item.replies?.totalItems || 0),
          views: existingPostIds.has(item.id) ? undefined : 0, // Don't overwrite existing views
          likes: existingPostIds.has(item.id) ? undefined : 0, // Don't overwrite existing likes
          status: 'published',
          authorId: 1, // Default author ID
          publishedAt: publishedDate,
          updatedAt: updatedDate,
        };
      });
      
      try {
        console.log(`Processing posts ${i + 1} to ${i + batch.length}...`);
        const result = await Post.bulkCreate(batch, { 
          ignoreDuplicates: false, // Allow updates
          updateOnDuplicate: [
            'title', 'content', 'excerpt', 'category', 'tags', 'coverImage', 
            'images', 'url', 'publishedAt', 'updatedAt', 'date'
            // Note: 'likedBy', 'likes', 'views', 'comments' are excluded to preserve user interactions
          ]
        });
        
        // Count inserted vs updated
        const batchNewPosts = batch.filter(post => !existingPostIds.has(post.postId));
        insertedCount += batchNewPosts.length;
        updatedCount += (batch.length - batchNewPosts.length);
        
        console.log(`✅ Processed posts ${i + 1} to ${i + batch.length} (${batchNewPosts.length} new, ${batch.length - batchNewPosts.length} updated)`);
      } catch (err) {
        console.error('Error processing batch:', err.message);
        // Continue with next batch instead of failing completely
      }
    }
    
    console.log(`✅ Blogger sync complete. Inserted ${insertedCount} new posts, updated ${updatedCount} existing posts out of ${allPosts.length} total posts.`);
    
    if (res) {
      return res.json({ 
        status: 'refreshed', 
        totalPosts: allPosts.length,
        newPosts: insertedCount,
        updatedPosts: updatedCount,
        existingPosts: existingPostIds.size
      });
    }
    
  } catch (err) {
    console.error('Error in fetchAndCacheBloggerData:', err.message);
    if (err.response) {
      console.error('Response status:', err.response.status);
      console.error('Response data:', err.response.data);
    }
    if (res) return res.status(500).json({ error: 'Blogger sync failed', details: err.message });
  }
};

export const fixCoverImages = async (req, res) => {
  // This function still needs to be migrated to Sequelize if used
  res.json({ updated: 0, totalChecked: 0 });
}; 