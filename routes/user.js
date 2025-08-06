import express from 'express';
import auth from '../middleware/auth.js';
import User from '../models/User.js';
import Post from '../models/Post.js';
import Comment from '../models/Comment.js';

const router = express.Router();

// Get current user's profile
router.get('/me', auth, async (req, res) => {
  try {
  const user = await User.findById(req.user.id).select('-password');
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ error: 'Failed to fetch user profile' });
  }
});

// Get user's liked posts
router.get('/liked-posts', auth, async (req, res) => {
  try {
    const posts = await Post.find({
      likedBy: req.user.id
    }, {
      postId: 1,
      title: 1,
      date: 1,
      category: 1,
      coverImage: 1,
      comments: 1,
      likes: 1,
      updatedAt: 1,
      excerpt: 1,
      likedBy: 1
    }).sort({ date: -1 });
    
    res.json(posts);
  } catch (error) {
    console.error('Error fetching liked posts:', error);
    res.status(500).json({ error: 'Failed to fetch liked posts' });
  }
});

// Get user's commented posts
router.get('/commented-posts', auth, async (req, res) => {
  try {
    // First get all comments by this user
    const userComments = await Comment.find({ user: req.user.id }).distinct('post');
    
    if (userComments.length === 0) {
      return res.json([]);
    }
    
    // Then get the posts that user has commented on
    const posts = await Post.find({
      _id: { $in: userComments }
    }, {
      postId: 1,
      title: 1,
      date: 1,
      category: 1,
      coverImage: 1,
      comments: 1,
      likes: 1,
      updatedAt: 1,
      excerpt: 1,
      likedBy: 1
    }).sort({ date: -1 });
    
    res.json(posts);
  } catch (error) {
    console.error('Error fetching commented posts:', error);
    res.status(500).json({ error: 'Failed to fetch commented posts' });
  }
});

export default router; 