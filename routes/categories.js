import express from 'express';
import { Post } from '../models/index.js';
import { Op } from 'sequelize';
import { sequelize as db } from '../config/db.js';

const router = express.Router();

// Get all categories with pagination and search
router.get('/', async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      search = '', 
      sortBy = 'count', 
      sortOrder = 'DESC',
      includeEmpty = 'false'
    } = req.query;
    
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    console.log(`🔍 Fetching categories (page ${page}, limit ${limit})`);
    
    // Get categories from Posts table using GROUP BY
    const { Op, sequelize } = await import('sequelize');
    
    // Build where clause for posts
    const postWhereClause = {
      status: 'published',
      hidden: false
    };
    
    if (search) {
      postWhereClause.category = {
        [Op.like]: `%${search}%`
      };
    }
    
    if (includeEmpty === 'false') {
      postWhereClause.category = {
        [Op.and]: [
          { [Op.not]: null },
          { [Op.ne]: '' }
        ]
      };
    }
    
    // Get categories with their counts
    const categoriesRaw = await Post.findAll({
      attributes: [
        'category',
        [db.fn('COUNT', db.col('*')), 'count']
      ],
      where: postWhereClause,
      group: ['category'],
      order: [[db.fn('COUNT', db.col('*')), sortOrder.toUpperCase()]],
      limit: parseInt(limit),
      offset: offset,
      raw: true
    });
    
    // Get total count of unique categories
    const totalCategoriesResult = await Post.findAll({
      attributes: [[db.fn('DISTINCT', db.col('category')), 'category']],
      where: {
        category: {
          [Op.not]: null,
          [Op.ne]: ''
        },
        status: 'published',
        hidden: false
      },
      raw: true
    });
    
    let totalCount = totalCategoriesResult.length;
    if (search) {
      const searchFilteredCount = await Post.findAll({
        attributes: [[db.fn('DISTINCT', db.col('category')), 'category']],
        where: postWhereClause,
        raw: true
      });
      totalCount = searchFilteredCount.length;
    }
    
    const categories = categoriesRaw.map(row => ({
      name: row.category,
      slug: encodeURIComponent(row.category), // Use encoded category name as slug
      count: parseInt(row.count) || 0
    }));
    
    const totalPages = Math.ceil(totalCount / parseInt(limit));
    const hasMore = offset + categories.length < totalCount;
    
    console.log(`📊 Found ${categories.length} categories (page ${page}/${totalPages})`);
    
    res.json({
      categories: categories,
      pagination: {
        currentPage: parseInt(page),
        totalPages: totalPages,
        totalCount: totalCount,
        hasMore: hasMore,
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
    
    // Decode the category slug (it's actually the category name)
    const categoryName = decodeURIComponent(categorySlug);
    
    console.log(`🔍 Looking for posts with category: "${categoryName}"`);
    
    // Get posts for this category using the category field
    const { count, rows: posts } = await Post.findAndCountAll({
      where: {
        category: categoryName,
        status: 'published',
        hidden: false
      },
      order: [[sortBy, sortOrder.toUpperCase()]],
      limit: parseInt(limit),
      offset: offset,
      attributes: [
        'id', 'postId', 'title', 'subtitle', 'excerpt', 'coverImage', 'content',
        'date', 'publishedAt', 'views', 'likes', 'comments', 'author'
      ]
    });
    
    console.log(`📊 Found ${count} posts for category "${categoryName}"`);
    
    res.json({
      category: {
        name: categoryName,
        slug: categorySlug,
        postCount: count
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

// Get category by slug (returns category info)
router.get('/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    const categoryName = decodeURIComponent(slug);
    
    // Count posts for this category
    const postCount = await Post.count({
      where: {
        category: categoryName,
        status: 'published',
        hidden: false
      }
    });
    
    if (postCount === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }
    
    res.json({ 
      category: {
        name: categoryName,
        slug: slug,
        postCount: postCount
      }
    });
    
  } catch (error) {
    console.error('Error fetching category:', error);
    res.status(500).json({ error: 'Failed to fetch category' });
  }
});

export default router;
