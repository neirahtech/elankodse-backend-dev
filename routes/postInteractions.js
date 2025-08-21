import express from 'express';
import auth from '../middleware/auth.js';
import requireAuthor from '../middleware/author.js';
import Post from '../models/Post.js';
import { clearPostsCache } from '../controllers/postController.js';

const router = express.Router();

// Toggle like/unlike a post
router.post('/:id/toggle-like', async (req, res) => {
  try {
    console.log('🔍 Toggle-like request for postId:', req.params.id);
    
    // Try to find post by postId first (Blogger ID), then by database id as fallback
    let post = await Post.findOne({ where: { postId: req.params.id } });
    
    // If not found by postId and the param looks like a database id (integer), try finding by database id
    if (!post && /^\d+$/.test(req.params.id)) {
      console.log('🔍 Not found by postId, trying database id:', req.params.id);
      post = await Post.findOne({ where: { id: parseInt(req.params.id) } });
    }
    
    console.log('🔍 Post found:', post ? `${post.title} (likes: ${post.likes})` : 'null');
    if (!post) return res.status(404).json({ error: 'Post not found' });
    
    // For anonymous users, use a combination of IP and user agent for better consistency
    const userId = req.user ? req.user.id : `${req.ip}-${req.get('User-Agent')?.slice(0, 50) || 'anonymous'}`;
    
    // Ensure likedBy is an array
    let likedBy = post.likedBy || [];
    if (!Array.isArray(likedBy)) {
      likedBy = [];
    }
    
    console.log('🔍 Like toggle debug:', {
      postId: req.params.id,
      userId,
      currentLikes: post.likes,
      currentLikedBy: likedBy,
      userAgent: req.get('User-Agent')?.slice(0, 50)
    });
    
    const hasLiked = likedBy.some(id => id.toString() === userId.toString());
    
    console.log('🔍 Has liked:', hasLiked);
    
    if (hasLiked) {
      // Unlike
      console.log('🔄 Unlike operation');
      post.likes = Math.max(0, (post.likes || 0) - 1);
      post.likedBy = likedBy.filter(id => id.toString() !== userId.toString());
    } else {
      // Like
      console.log('🔄 Like operation');
      post.likes = (post.likes || 0) + 1;
      post.likedBy = [...likedBy, userId];
    }
    
    console.log('🔍 After operation:', {
      newLikes: post.likes,
      newLikedBy: post.likedBy
    });
    
    await post.save();
    
    // Verify the save worked by fetching the post again
    // Use the same lookup method that worked initially
    let savedPost;
    if (post.postId === req.params.id) {
      // Found by postId (Blogger ID)
      savedPost = await Post.findOne({ where: { postId: req.params.id } });
    } else {
      // Found by database id
      savedPost = await Post.findOne({ where: { id: parseInt(req.params.id) } });
    }
    
    console.log('🔍 After save verification:', {
      savedLikes: savedPost?.likes || 'not found',
      savedLikedBy: savedPost?.likedBy || 'not found'
    });
    
    res.json({ 
      likes: post.likes,
      userLiked: !hasLiked // Return the new state
    });
  } catch (error) {
    console.error('Error toggling like:', error);
    res.status(500).json({ error: 'Failed to toggle like' });
  }
});

// Toggle hide/unhide a post (Author only)
router.post('/:id/toggle-hide', auth, requireAuthor, async (req, res) => {
  try {
    console.log('🔍 Toggle-hide request for postId:', req.params.id, 'by user:', req.user.id);
    
    // Try to find post by postId first (Blogger ID), then by database id as fallback
    let post = await Post.findOne({ where: { postId: req.params.id } });
    
    // If not found by postId and the param looks like a database id (integer), try finding by database id
    if (!post && /^\d+$/.test(req.params.id)) {
      console.log('🔍 Not found by postId, trying database id:', req.params.id);
      post = await Post.findOne({ where: { id: parseInt(req.params.id) } });
    }
    
    console.log('🔍 Post found:', post ? `${post.title} (hidden: ${post.hidden})` : 'null');
    if (!post) return res.status(404).json({ error: 'Post not found' });
    
    // Toggle the hidden status
    post.hidden = !post.hidden;
    await post.save();
    
    // Clear backend cache to ensure fresh data on next request
    clearPostsCache();
    
    console.log(`📝 Post ${req.params.id} ${post.hidden ? 'hidden' : 'unhidden'} by author`);
    
    res.json({ 
      hidden: post.hidden,
      message: post.hidden ? 'Post hidden successfully' : 'Post unhidden successfully'
    });
  } catch (error) {
    console.error('Error toggling post visibility:', error);
    res.status(500).json({ error: 'Failed to toggle post visibility' });
  }
});

// Like a post
router.post('/:id/like', auth, async (req, res) => {
  try {
  const post = await Post.findOne({ where: { postId: req.params.id } });
  if (!post) return res.status(404).json({ error: 'Post not found' });
    
    const userId = req.user.id; // Use req.user.id instead of req.user._id
    const hasLiked = post.likedBy && post.likedBy.some(id => id.toString() === userId.toString());
    
    if (hasLiked) {
      return res.json({ likes: post.likes });
    }
    
    post.likes = (post.likes || 0) + 1;
    if (!post.likedBy) post.likedBy = [];
  post.likedBy.push(userId);
  await post.save();
    
  res.json({ likes: post.likes });
  } catch (error) {
    console.error('Error liking post:', error);
    res.status(500).json({ error: 'Failed to like post' });
  }
});

// View a post (increment views, prevent abuse)
router.post('/:id/view', async (req, res) => {
  try {
  const post = await Post.findOne({ where: { postId: req.params.id } });
  if (!post) return res.status(404).json({ error: 'Post not found' });
  
  // Ensure viewedBy is always an array
  if (!Array.isArray(post.viewedBy)) {
    post.viewedBy = [];
  }
  
  const userId = req.user ? req.user.id : null;
  const ip = req.ip;
  const now = new Date();
  let canIncrement = true;
  
  // Check if user or IP has viewed in last 6 hours
  if (userId) {
    const last = post.viewedBy.find(v => v.user && v.user.toString() === userId);
    if (last && now - new Date(last.lastViewed) < 6*60*60*1000) canIncrement = false;
  } else {
    const last = post.viewedBy.find(v => v.ip === ip);
    if (last && now - new Date(last.lastViewed) < 6*60*60*1000) canIncrement = false;
  }
  
  if (canIncrement) {
      post.views = (post.views || 0) + 1;
      if (!post.viewedBy) post.viewedBy = [];
      
    if (userId) {
      const idx = post.viewedBy.findIndex(v => v.user && v.user.toString() === userId);
        if (idx >= 0) {
          post.viewedBy[idx].lastViewed = now;
        } else {
          post.viewedBy.push({ user: userId, lastViewed: now });
        }
    } else {
      const idx = post.viewedBy.findIndex(v => v.ip === ip);
        if (idx >= 0) {
          post.viewedBy[idx].lastViewed = now;
        } else {
          post.viewedBy.push({ ip, lastViewed: now });
        }
    }
    await post.save();
  }
  
  res.json({ views: post.views || 0 });
  } catch (error) {
    console.error('Error recording view:', error);
    res.status(500).json({ error: 'Failed to record view' });
  }
});

// Unlike a post
router.delete('/:id/like', auth, async (req, res) => {
  try {
  const post = await Post.findOne({ postId: req.params.id });
  if (!post) return res.status(404).json({ error: 'Post not found' });
    
    const userId = req.user.id; // Use req.user.id instead of req.user._id
    const hasLiked = post.likedBy && post.likedBy.some(id => id.toString() === userId.toString());
    
    if (!hasLiked) {
      return res.json({ likes: post.likes || 0 });
    }
    
    post.likes = Math.max(0, (post.likes || 0) - 1);
    post.likedBy = post.likedBy.filter(id => id.toString() !== userId.toString());
  await post.save();
    
  res.json({ likes: post.likes });
  } catch (error) {
    console.error('Error unliking post:', error);
    res.status(500).json({ error: 'Failed to unlike post' });
  }
});

export default router; 