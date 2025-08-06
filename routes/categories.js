import express from 'express';
import { Category, Post } from '../models/index.js';
import { Op } from 'sequelize';

const router = express.Router();

// Get all categories with pagination and search
router.get('/', async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      search = '', 
      sortBy = 'postCount', 
      sortOrder = 'DESC',
      includeEmpty = 'false'
    } = req.query;
    
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    // Build where clause
    const whereClause = {
      isActive: true
    };
    
    if (search) {
      whereClause.name = {
        [Op.like]: `%${search}%`
      };
    }
    
    if (includeEmpty === 'false') {
      whereClause.postCount = {
        [Op.gt]: 0
      };
    }
    
    // Get categories with pagination
    const { count, rows: categories } = await Category.findAndCountAll({
      where: whereClause,
      order: [[sortBy, sortOrder.toUpperCase()]],
      limit: parseInt(limit),
      offset: offset,
      attributes: ['id', 'name', 'slug', 'description', 'postCount', 'createdAt']
    });
    
    res.json({
      categories,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(count / parseInt(limit)),
        totalCount: count,
        hasMore: offset + categories.length < count,
        limit: parseInt(limit)
      }
    });
    
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// Get posts by category with pagination
router.get('/:categorySlug/posts', async (req, res) => {
  try {
    const { categorySlug } = req.params;
    const { 
      page = 1, 
      limit = 20, 
      sortBy = 'publishedAt', 
      sortOrder = 'DESC'
    } = req.query;
    
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    // Find category by slug
    const category = await Category.findOne({
      where: { slug: categorySlug, isActive: true }
    });
    
    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }
    
    // Get posts for this category
    const { count, rows: posts } = await Post.findAndCountAll({
      where: {
        categoryId: category.id,
        status: 'published',
        hidden: false
      },
      order: [[sortBy, sortOrder.toUpperCase()]],
      limit: parseInt(limit),
      offset: offset,
      attributes: [
        'id', 'postId', 'title', 'subtitle', 'excerpt', 'coverImage', 'content',
        'publishedAt', 'views', 'likes', 'comments', 'author'
      ]
    });
    
    res.json({
      category: {
        id: category.id,
        name: category.name,
        slug: category.slug,
        description: category.description,
        postCount: category.postCount
      },
      posts,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(count / parseInt(limit)),
        totalCount: count,
        hasMore: offset + posts.length < count,
        limit: parseInt(limit)
      }
    });
    
  } catch (error) {
    console.error('Error fetching category posts:', error);
    res.status(500).json({ error: 'Failed to fetch category posts' });
  }
});

// Get category by slug
router.get('/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    
    const category = await Category.findOne({
      where: { slug, isActive: true },
      attributes: ['id', 'name', 'slug', 'description', 'postCount', 'createdAt']
    });
    
    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }
    
    res.json({ category });
    
  } catch (error) {
    console.error('Error fetching category:', error);
    res.status(500).json({ error: 'Failed to fetch category' });
  }
});

// Update category post count (internal use)
router.put('/:id/update-count', async (req, res) => {
  try {
    const { id } = req.params;
    
    const category = await Category.findByPk(id);
    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }
    
    // Count published posts for this category
    const postCount = await Post.count({
      where: {
        categoryId: id,
        status: 'published',
        hidden: false
      }
    });
    
    await category.update({ postCount });
    
    res.json({ 
      message: 'Category post count updated', 
      category: {
        id: category.id,
        name: category.name,
        postCount
      }
    });
    
  } catch (error) {
    console.error('Error updating category count:', error);
    res.status(500).json({ error: 'Failed to update category count' });
  }
});

export default router;
