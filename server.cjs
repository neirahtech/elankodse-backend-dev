const express = require('express');
const mongoose = require('mongoose');
const axios = require('axios');
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
async function fetchAndCacheBloggerData() {
  // Fetch all posts (paginated)
  let allPosts = [];
  let pageToken = null;
  let firstPostAuthor = null;
  do {
    let url = 'https://www.googleapis.com/blogger/v3/blogs/9143217/posts?key=AIzaSyD44Q_YctTPOndoPWrXZsBDJ1jNcOs4B1w&maxResults=500';
    if (pageToken) url += `&pageToken=${pageToken}`;
    const res = await axios.get(url);
    const data = res.data;
    if (data.items) {
      allPosts = allPosts.concat(data.items);
      if (!firstPostAuthor && data.items[0] && data.items[0].author) {
        firstPostAuthor = data.items[0].author;
      }
    }
    pageToken = data.nextPageToken;
    console.log(`Fetched ${allPosts.length} posts so far...`);
  } while (pageToken);

  // Fetch blog description for quote
  let blogQuote = '';
  try {
    const blogRes = await axios.get('https://www.googleapis.com/blogger/v3/blogs/9143217?key=AIzaSyD44Q_YctTPOndoPWrXZsBDJ1jNcOs4B1w');
    blogQuote = blogRes.data.description || '';
  } catch {}

  // Only save author if not already present
  const authorExists = await Author.exists({});
  if (!authorExists && firstPostAuthor) {
    await Author.findOneAndUpdate(
      {},
      {
        name: firstPostAuthor.displayName,
        avatar: firstPostAuthor.image.url,
        quote: blogQuote,
        updatedAt: new Date(),
      },
      { upsert: true }
    );
  }

  // Only insert new posts
  const existingPostIds = new Set((await Post.find({}, { postId: 1 })).map(p => p.postId));
  const newPosts = allPosts.filter(item => !existingPostIds.has(item.id));
  if (newPosts.length === 0) {
    console.log('No new posts to insert.');
    return;
  }

  // Save posts in batches
  const BATCH_SIZE = 100;
  for (let i = 0; i < newPosts.length; i += BATCH_SIZE) {
    const batch = newPosts.slice(i, i + BATCH_SIZE).map(item => ({
      postId: item.id,
      title: item.title,
      date: item.published?.slice(0, 10),
      excerpt: item.content?.replace(/<[^>]+>/g, '').slice(0, 120) + '...',
      content: item.content,
      category: item.labels && item.labels.length > 0 ? item.labels[0] : 'Uncategorized',
      coverImage: item.images && item.images.length > 0 ? item.images[0].url : '',
      comments: item.replies?.totalItems || 0,
      likes: Math.floor(Math.random() * 200),
      updatedAt: new Date(),
    }));
    try {
      await Post.insertMany(batch, { ordered: false }); // ignore duplicates
      console.log(`Inserted posts ${i + 1} to ${i + batch.length}`);
    } catch (err) {
      console.log(`Batch insert error (likely duplicates): ${err.message}`);
    }
  }
  console.log('All new posts cached in MongoDB.');
}

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

// Manual refresh endpoint (or you can schedule this)
app.post('/api/refresh', async (req, res) => {
  await fetchAndCacheBloggerData();
  res.json({ status: 'refreshed' });
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
  // Optionally fetch data on startup
  fetchAndCacheBloggerData();
});
