import express from 'express';
import auth, { optionalAuth } from '../middleware/auth.js';
import Comment from '../models/Comment.js';
import Post from '../models/Post.js';
import User from '../models/User.js';
import rateLimit from 'express-rate-limit';

const router = express.Router();

const commentLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  message: { error: 'Too many comments, please try again later.' },
  keyGenerator: (req) => req.user ? req.user.id : req.ip
});

// Helper function to find post by postId or numeric id
async function findPostByIdentifier(identifier) {
  // Try to find by postId first
  let post = await Post.findOne({ where: { postId: identifier } });
  
  if (!post) {
    // If not found by postId, try by numeric id
    const numericId = parseInt(identifier);
    if (!isNaN(numericId)) {
      post = await Post.findByPk(numericId);
    }
  }
  
  return post;
}

// Get comments for a post
router.get('/:postId', optionalAuth, async (req, res) => {
  try {
    // Find the post by postId or numeric id
    const post = await findPostByIdentifier(req.params.postId);
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }
    
    // Check if user is the post author or admin
    const isAuthor = req.user && (req.user.id === post.authorId || req.user.isAuthor);
    
    // If user is not the author, exclude hidden comments
    const whereClause = { postId: post.id };
    if (!isAuthor) {
      whereClause.hidden = false;
    }
    
    const comments = await Comment.findAll({
      where: whereClause,
      order: [['createdAt', 'DESC']]
    });
    
    // Transform comments to include user information
    const transformedComments = comments.map(comment => {
      const commentData = comment.toJSON();
      
      // If comment has userId, include user info from User model
      if (commentData.userId) {
        // This will be populated by the include if we add it back
        return {
          ...commentData,
          user: {
            firstName: commentData.userFirstName || 'Anonymous',
            lastName: commentData.userLastName || '',
            avatar: commentData.userAvatar || '/avatar1.jpg'
          }
        };
      } else {
        // Anonymous comment
        return {
          ...commentData,
          user: {
            firstName: commentData.userFirstName || 'Anonymous',
            lastName: commentData.userLastName || '',
            avatar: commentData.userAvatar || '/avatar1.jpg'
          }
        };
      }
    });
    
    res.json(transformedComments);
  } catch (error) {
    console.error('Error fetching comments:', error);
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
});

// Add a comment to a post
router.post('/:postId', commentLimiter, async (req, res) => {
  try {
    const { text, user } = req.body;
    
    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'Comment text is required' });
    }
    
    // Find the post by postId or numeric id
    const post = await findPostByIdentifier(req.params.postId);
    
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }
    
    // Handle user information (authenticated or anonymous)
    const userId = req.user ? req.user.id : null;
    const userFirstName = user?.firstName || 'Anonymous';
    const userLastName = user?.lastName || '';
    const userAvatar = user?.avatar || '/avatar1.jpg';
    const anonymousId = req.user ? null : req.ip; // Use IP for anonymous users
    
    const comment = await Comment.create({
      postId: post.id,
      userId: userId,
      text: text.trim(),
      userFirstName: userFirstName,
      userLastName: userLastName,
      userAvatar: userAvatar,
      anonymousId: anonymousId
    });
    
    // Update post comment count
    post.comments = (post.comments || 0) + 1;
    await post.save();
    
    // Prepare response with user info
    const commentResponse = {
      ...comment.toJSON(),
      user: {
        firstName: userFirstName,
        lastName: userLastName,
        avatar: userAvatar
      }
    };
    
    res.status(201).json(commentResponse);
  } catch (error) {
    console.error('Error adding comment:', error);
    res.status(500).json({ error: 'Failed to add comment' });
  }
});

// Debug endpoint to check user authentication
router.get('/debug/auth', auth, (req, res) => {
  res.json({
    message: 'Authentication working',
    user: req.user,
    userId: req.user.id,
    email: req.user.email,
    isAuthor: req.user.isAuthor
  });
});

// Toggle comment visibility (hide/unhide) - Author only
router.post('/:commentId/toggle-hide', auth, async (req, res) => {
  try {
    const comment = await Comment.findByPk(req.params.commentId);
    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }
    
    // Get the post to check if user is the post author
    const post = await Post.findByPk(comment.postId);
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }
    
    // Check if user is the post author or admin
    const isPostAuthor = post.authorId === req.user.id;
    const isAdmin = req.user.isAuthor; // Assuming isAuthor means admin/author privileges
    
    if (!isPostAuthor && !isAdmin) {
      return res.status(403).json({ 
        error: 'Only the post author can hide/unhide comments' 
      });
    }
    
    // Toggle the hidden status
    comment.hidden = !comment.hidden;
    await comment.save();
    
    res.json({ 
      message: `Comment ${comment.hidden ? 'hidden' : 'unhidden'} successfully`,
      hidden: comment.hidden,
      commentId: comment.id
    });
  } catch (error) {
    console.error('Error toggling comment visibility:', error);
    res.status(500).json({ error: 'Failed to toggle comment visibility' });
  }
});

// Delete a comment
router.delete('/:commentId', auth, async (req, res) => {
  try {
    console.log('Attempting to delete comment:', req.params.commentId, 'by user:', req.user.id);
    
    const comment = await Comment.findByPk(req.params.commentId);
    if (!comment) {
      console.log('Comment not found');
      return res.status(404).json({ error: 'Comment not found' });
    }
    
    console.log('Comment found:', {
      id: comment.id,
      userId: comment.userId,
      postId: comment.postId,
      text: comment.text?.substring(0, 50) + '...'
    });
    
    // Get the post to check if user is the post author
    const post = await Post.findByPk(comment.postId);
    if (!post) {
      console.log('Post not found for comment');
      return res.status(404).json({ error: 'Post not found' });
    }
    
    console.log('Post found:', {
      id: post.id,
      authorId: post.authorId,
      title: post.title?.substring(0, 50) + '...'
    });
    
    // Check if user is the comment author or the post author
    const isCommentAuthor = comment.userId === req.user.id;
    const isPostAuthor = post.authorId === req.user.id;
    
    console.log('Authorization check:', {
      isCommentAuthor,
      isPostAuthor,
      commentUserId: comment.userId,
      postAuthorId: post.authorId,
      currentUserId: req.user.id
    });
    
    if (!isCommentAuthor && !isPostAuthor) {
      console.log('User not authorized to delete comment');
      return res.status(403).json({ 
        error: 'Not authorized to delete this comment',
        details: {
          isCommentAuthor,
          isPostAuthor,
          commentUserId: comment.userId,
          postAuthorId: post.authorId,
          currentUserId: req.user.id
        }
      });
    }
    
    // Update post comment count
    post.comments = Math.max(0, (post.comments || 0) - 1);
    await post.save();
    
    // Delete the comment
    await comment.destroy();
    
    console.log('Comment deleted successfully');
    res.json({ message: 'Comment deleted successfully' });
  } catch (error) {
    console.error('Error deleting comment:', error);
    res.status(500).json({ error: 'Failed to delete comment' });
  }
});

export default router; 