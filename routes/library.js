import express from 'express';
import auth from '../middleware/auth.js';
import User from '../models/User.js';
import Post from '../models/Post.js';

const router = express.Router();

// Get user's library (saved posts)
router.get('/', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate('library');
    const savedPosts = user?.library || [];
    
    if (savedPosts.length === 0) {
      return res.json([]);
    }
    
    // Get full post details for saved posts
    const posts = await Post.find({
      _id: { $in: savedPosts }
    }, {
      postId: 1,
      title: 1,
      date: 1,
      category: 1,
      coverImage: 1,
      author: 1,
      comments: 1,
      likes: 1,
      updatedAt: 1,
      excerpt: 1,
      likedBy: 1
    }).populate('author', 'firstName lastName').sort({ date: -1 });
    
    res.json(posts);
  } catch (error) {
    console.error('Error fetching library:', error);
    res.status(500).json({ error: 'Failed to fetch library' });
  }
});

// Add a post to library
router.post('/add', auth, async (req, res) => {
  try {
    const { postId } = req.body;
    
    if (!postId) {
      return res.status(400).json({ error: 'Post ID is required' });
    }
    
    // Find the post by postId
    const post = await Post.findOne({ postId });
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }
    
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    if (!user.library) user.library = [];
    
    // Check if post is already in library
    const alreadySaved = user.library.some(id => id.toString() === post._id.toString());
    if (alreadySaved) {
      return res.json({ message: 'Post already in library' });
    }
    
    user.library.push(post._id);
    await user.save();
    
    res.json({ message: 'Post added to library' });
  } catch (error) {
    console.error('Error adding to library:', error);
    res.status(500).json({ error: 'Failed to add post to library' });
  }
});

// Remove a post from library
router.post('/remove', auth, async (req, res) => {
  try {
    const { postId } = req.body;
    
    if (!postId) {
      return res.status(400).json({ error: 'Post ID is required' });
    }
    
    // Find the post by postId
    const post = await Post.findOne({ postId });
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }
    
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    if (!user.library) user.library = [];
    
    const initialLength = user.library.length;
    user.library = user.library.filter(id => id.toString() !== post._id.toString());
    
    if (user.library.length === initialLength) {
      return res.json({ message: 'Post not in library' });
    }
    
    await user.save();
    
    res.json({ message: 'Post removed from library' });
  } catch (error) {
    console.error('Error removing from library:', error);
    res.status(500).json({ error: 'Failed to remove post from library' });
  }
});

export default router; 