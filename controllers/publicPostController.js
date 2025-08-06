import Post from '../models/Post.js';
import { Op } from 'sequelize';

export const getPublicPosts = async (req, res) => {
  try {
    const posts = await Post.findAll({
      where: {
        status: 'published',
        hidden: false
      },
      attributes: [
        'id', 'postId', 'title', 'subtitle', 'excerpt', 'coverImage', 'author', 'category',
        'publishedAt', 'tags', 'likes', 'comments', 'urlSlug', 'additionalImages'
      ],
      order: [['publishedAt', 'DESC']],
     
    });

    res.json(posts);
  } catch (error) {
    console.error('Error fetching public posts:', error);
    res.status(500).json({ error: 'Failed to fetch posts' });
  }
};

// Get single public post by ID or URL slug
export const getPublicPostById = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Try to find by URL slug first, then by postId, then by numeric id
    let post = await Post.findOne({
      where: {
        urlSlug: id,
        status: 'published',
        hidden: false
      }
    });
    
    if (!post) {
      // Try by postId
      post = await Post.findOne({
        where: {
          postId: id,
          status: 'published',
          hidden: false
        }
      });
    }
    
    if (!post) {
      // Try by numeric id
      const numericId = parseInt(id);
      if (!isNaN(numericId)) {
        post = await Post.findOne({
          where: {
            id: numericId,
            status: 'published',
            hidden: false
          }
        });
      }
    }
    
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }
    
    // Increment view count
    await post.increment('views');
    
    res.json(post);
  } catch (error) {
    console.error('Error fetching public post:', error);
    res.status(500).json({ error: 'Failed to fetch post' });
  }
};
