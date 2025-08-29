import express from 'express';
import auth from '../middleware/auth.js';
import requireAuthor from '../middleware/author.js';
import Post from '../models/Post.js';
import { clearPostsCache } from '../controllers/postController.js';
import { getUserIdentifier, hasUserLiked, getUserIdentificationDebug } from '../utils/userIdentification.js';

const router = express.Router();

// In-memory cache for rate limiting
const rateLimitCache = new Map();

// Clean up old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, timestamp] of rateLimitCache.entries()) {
    if (now - timestamp > 60000) { // Remove entries older than 1 minute
      rateLimitCache.delete(key);
    }
  }
}, 300000);

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
    
    // Rate limiting: Prevent rapid-fire requests
    const now = Date.now();
    const rateLimitKey = `${req.params.id}_${req.ip}_${req.get('User-Agent')?.slice(0, 50)}`;
    const lastRequest = rateLimitCache.get(rateLimitKey) || 0;
    const timeSinceLastRequest = now - lastRequest;
    
    if (timeSinceLastRequest < 1000) { // 1 second minimum between requests
      console.log('🚫 Rate limited: Too many requests too quickly');
      return res.status(429).json({ 
        error: 'Rate limited. Please wait before trying again.',
        likes: post.likes,
        userLiked: false
      });
    }
    
    // Update rate limit cache
    rateLimitCache.set(rateLimitKey, now);
    
    // Get consistent user identifier using shared utility
    const userId = getUserIdentifier(req);
    const debugInfo = getUserIdentificationDebug(req);
    
    console.log('🔍 User identification:', debugInfo);
    
    // Ensure likedBy is an array
    let likedBy = post.likedBy || [];
    if (!Array.isArray(likedBy)) {
      likedBy = [];
    }
    
    console.log('🔍 Like toggle debug:', {
      postId: req.params.id,
      userId: debugInfo.userId,
      isAuthenticated: debugInfo.isAuthenticated,
      currentLikes: post.likes,
      currentLikedBy: likedBy.length + ' users'
    });
    
    // Use shared utility to check if user has liked
    const hasLiked = hasUserLiked(likedBy, req);
    
    console.log('🔍 Has liked check:', {
      hasLiked,
      userId: userId.toString().slice(0, 20) + '...',
      likedByArray: likedBy.map(id => id.toString().slice(0, 20) + '...'),
      exactMatch: likedBy.find(id => id.toString() === userId.toString())
    });
    
    let newLikes, newLikedBy;
    
    if (hasLiked) {
      // Unlike
      console.log('🔄 Unlike operation');
      newLikes = Math.max(0, (post.likes || 0) - 1);
      newLikedBy = likedBy.filter(id => id.toString() !== userId.toString());
    } else {
      // Like
      console.log('🔄 Like operation');
      newLikes = (post.likes || 0) + 1;
      newLikedBy = [...likedBy, userId];
    }
    
    // Clean up any invalid entries in likedBy array (optional maintenance)
    newLikedBy = newLikedBy.filter(id => id && id.toString().length > 0);
    
    console.log('🔍 Before save:', {
      oldLikes: post.likes,
      newLikes,
      oldLikedBy: post.likedBy?.length || 0,
      newLikedBy: newLikedBy.length
    });
    
    // Update the post with new values
    post.likes = newLikes;
    post.likedBy = newLikedBy;
    
    await post.save();
    
    // Clear cache to ensure consistency between published posts and individual post APIs
    clearPostsCache();
    
    console.log('🔍 After save:', {
      finalLikes: post.likes,
      finalLikedBy: post.likedBy?.length || 0,
      userLikedResult: !hasLiked
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
    
  // Clear cache to ensure consistency between APIs
  clearPostsCache();
    
  res.json({ likes: post.likes });
  } catch (error) {
    console.error('Error liking post:', error);
    res.status(500).json({ error: 'Failed to like post' });
  }
});

// View a post (increment views, prevent abuse)
router.post('/:id/view', async (req, res) => {
  try {
    const postId = req.params.id;
    console.log('Attempting to increment views for post ID:', postId);
    
    const post = await Post.findOne({ where: { postId: postId } });
    if (!post) {
      console.warn('Post not found for view increment, ID:', postId);
      return res.status(404).json({ error: 'Post not found' });
    }
    
    console.log('Found post for view increment:', { postId: post.postId, title: post.title?.substring(0, 50) + '...' });
    
    // Ensure viewedBy is always an array
    if (!Array.isArray(post.viewedBy)) {
      post.viewedBy = [];
    }
    
    const userId = req.user ? req.user.id : null;
    
    // Get real client IP (handles proxy situations)
    const clientIP = req.ip || 
                    req.connection.remoteAddress || 
                    req.socket.remoteAddress ||
                    (req.connection.socket ? req.connection.socket.remoteAddress : null) ||
                    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
                    req.headers['x-real-ip'] ||
                    'unknown';
    
    // For anonymous users, create unique identifier like in like functionality
    const anonymousId = userId ? null : `anon_${clientIP}_${Buffer.from((req.get('User-Agent') || '') + (req.get('Accept-Language') || '')).toString('base64').slice(0, 20)}`;
    
    console.log('🔍 View tracking debug:', {
      postId,
      userId: userId || 'anonymous',
      clientIP,
      anonymousId: anonymousId?.slice(0, 30) + '...' || 'N/A'
    });
    
    const now = new Date();
    let canIncrement = true;
    
    // Check if user or anonymous identifier has viewed in last 6 hours
    if (userId) {
      // For authenticated users, check by user ID
      const last = post.viewedBy.find(v => v.user && v.user.toString() === userId.toString());
      if (last && now - new Date(last.lastViewed) < 6*60*60*1000) {
        canIncrement = false;
        console.log('🔍 View increment blocked - authenticated user viewed recently');
      }
    } else {
      // For anonymous users, check by the unique anonymous identifier
      const last = post.viewedBy.find(v => v.anonymousId === anonymousId);
      if (last && now - new Date(last.lastViewed) < 6*60*60*1000) {
        canIncrement = false;
        console.log('🔍 View increment blocked - anonymous user viewed recently');
      }
    }
    
    if (canIncrement) {
      post.views = (post.views || 0) + 1;
      if (!post.viewedBy) post.viewedBy = [];
      
      if (userId) {
        // For authenticated users, store by user ID
        const idx = post.viewedBy.findIndex(v => v.user && v.user.toString() === userId.toString());
        if (idx >= 0) {
          post.viewedBy[idx].lastViewed = now;
        } else {
          post.viewedBy.push({ user: userId, lastViewed: now });
        }
      } else {
        // For anonymous users, store by anonymous identifier
        const idx = post.viewedBy.findIndex(v => v.anonymousId === anonymousId);
        if (idx >= 0) {
          post.viewedBy[idx].lastViewed = now;
        } else {
          post.viewedBy.push({ anonymousId, ip: clientIP, lastViewed: now });
        }
      }
      
      // Clean up old entries (older than 7 days) to prevent array from growing too large
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      post.viewedBy = post.viewedBy.filter(v => new Date(v.lastViewed) > sevenDaysAgo);
      
      await post.save();
      console.log('✅ Successfully incremented view count for post:', postId, 'New count:', post.views);
    } else {
      console.log('⏭️  View increment skipped (recent view) for post:', postId);
    }
    
    res.json({ views: post.views || 0 });
  } catch (error) {
    console.error('Error recording view for post ID:', req.params.id);
    console.error('Error details:', error);
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
    
  // Clear cache to ensure consistency between APIs
  clearPostsCache();
    
  res.json({ likes: post.likes });
  } catch (error) {
    console.error('Error unliking post:', error);
    res.status(500).json({ error: 'Failed to unlike post' });
  }
});

// Debug endpoint to understand user identification issues
router.get('/debug/user-id', (req, res) => {
  try {
    const debugInfo = getUserIdentificationDebug(req);
    const userId = getUserIdentifier(req);
    
    res.json({
      userId: userId,
      debug: debugInfo,
      headers: {
        userAgent: req.get('User-Agent'),
        acceptLanguage: req.get('Accept-Language'),
        xForwardedFor: req.get('X-Forwarded-For'),
        xRealIp: req.get('X-Real-IP')
      },
      ip: req.ip,
      connection: {
        remoteAddress: req.connection?.remoteAddress,
        socketRemoteAddress: req.socket?.remoteAddress
      }
    });
  } catch (error) {
    console.error('Debug endpoint error:', error);
    res.status(500).json({ error: 'Debug failed' });
  }
});

export default router; 