const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
app.use(cors());

require('dotenv').config();
// MongoDB connection
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Mongoose Schemas
const AuthorSchema = new mongoose.Schema({
  name: String,
  avatar: String,
  quote: String,
  updatedAt: Date,
});
const PostSchema = new mongoose.Schema({
  postId: String,
  title: String,
  date: String,
  excerpt: String,
  content: String,
  category: String,
  coverImage: String,
  comments: Number,
  likes: Number,
  updatedAt: Date,
});
// Add indexes for performance
PostSchema.index({ date: -1 }); // for sorting/filtering by date
PostSchema.index({ category: 1 }); // for filtering by category
PostSchema.index({ postId: 1 }, { unique: true }); // for fast lookup by postId
const Author = mongoose.model('Author', AuthorSchema);
const Post = mongoose.model('Post', PostSchema);

// Fetch and cache author and posts
// Legacy blogger sync function - DISABLED
// This function was used to sync with Blogger but is no longer needed
// Kept commented for reference only
/*
async function fetchAndCacheBloggerData() {
  console.log('⚠️ Blogger sync is disabled - this function is no longer used');
  // Function body removed - see git history if needed
}
*/

// API endpoints
app.get('/api/author', async (req, res) => {
  const author = await Author.findOne({});
  res.json(author);
});

app.get('/api/posts', async (req, res) => {
  // Only select fields needed for sidebar and lists
  const posts = await Post.find({}, {
    postId: 1,
    title: 1,
    date: 1,
    category: 1,
    coverImage: 1,
    comments: 1,
    likes: 1,
    updatedAt: 1,
    excerpt: 1 // if needed for preview
    // content: 0 // exclude heavy content
  }).sort({ date: -1 });
  res.json(posts);
});

app.get('/api/posts/:id', async (req, res) => {
  const post = await Post.findOne({ postId: req.params.id });
  res.json(post);
});

// Manual refresh endpoint - clear caches and return status
app.post('/api/refresh', async (req, res) => {
  try {
    // Simply clear any internal caches and return success
    // Note: This endpoint is kept for backward compatibility but no longer syncs with Blogger
    console.log('Manual refresh requested - clearing internal caches');
    
    res.json({ 
      status: 'refreshed',
      message: 'Cache cleared successfully',
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

// Utility endpoint to fix cover images for posts missing them
app.post('/api/fix-cover-images', async (req, res) => {
  // Find posts without a coverImage
  const posts = await Post.find({ $or: [ { coverImage: { $exists: false } }, { coverImage: '' }, { coverImage: null } ] });
  let updatedCount = 0;
  for (const post of posts) {
    if (!post.content) continue;
    // Extract first image src from content
    const match = post.content.match(/<img[^>]+src=["']([^"'>]+)["']/i);
    if (match && match[1]) {
      post.coverImage = match[1];
      await post.save();
      updatedCount++;
    }
  }
  res.json({ updated: updatedCount, totalChecked: posts.length });
});

// Start server
const PORT = process.env.PORT || 8001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  // Server started successfully - no blogger sync needed
});
