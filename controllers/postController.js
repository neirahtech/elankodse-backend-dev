import Post from '../models/Post.js';
import { Category } from '../models/index.js';

// Simple in-memory cache for published posts (5 minute TTL)
const postsCache = new Map();
export const dashboardCache = new Map(); // Add separate cache for dashboard and export for diary utils
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Cache invalidation function
export const clearPostsCache = () => {
  postsCache.clear();
  dashboardCache.clear(); // Clear dashboard cache too
  console.log('Posts and dashboard cache cleared');
};

// Enhanced cache clearing for diary updates
export const clearDiaryAndPostsCache = () => {
  clearPostsCache();
  // Additional diary-specific cache clearing will be handled by diary utils
  console.log('Posts, dashboard, and diary caches cleared');
};

// API endpoint to clear cache (for admin use)
export const clearCacheEndpoint = async (req, res) => {
  try {
    clearPostsCache();
    res.json({ 
      success: true, 
      message: 'Posts cache cleared successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error clearing cache:', error);
    res.status(500).json({ error: 'Failed to clear cache' });
  }
};

export const getPostCount = async (req, res) => {
  try {
    // Set cache control headers to prevent stale counts
    res.header('Cache-Control', 'no-cache, must-revalidate');
    
    const count = await Post.count({
      where: { 
        status: 'published',
        hidden: false 
      }
    });
    res.json({ count });
  } catch (err) {
    console.error('Error getting post count:', err);
    res.status(500).json({ error: 'Failed to get post count' });
  }
};

export const getAllPosts = async (req, res) => {
  const startTime = Date.now();
  try {
    console.log('Fetching all posts for dashboard...');
    
    // Parse pagination parameters with sensible limits (reduced default for faster loading)
    const page = parseInt(req.query.page) || 1;
    let limit = parseInt(req.query.limit) || 10;
    const bustCache = req.query.bustCache === 'true' || req.query.nocache === 'true';
    
    // Check cache first for dashboard requests
    const cacheKey = `dashboard_posts_${page}_${limit}_${req.query.search || ''}_${req.query.status || ''}`;
    if (!bustCache && dashboardCache.has(cacheKey)) {
      const cached = dashboardCache.get(cacheKey);
      if (Date.now() - cached.timestamp < CACHE_TTL) {
        console.log(`Returning cached dashboard posts - Total time: ${Date.now() - startTime}ms`);
        return res.json(cached.data);
      }
      dashboardCache.delete(cacheKey);
    }
    
    // Enforce maximum limit to prevent database timeouts
    if (limit > 50) {
      console.log(`Limiting request from ${limit} to 50 posts to prevent database timeout`);
      limit = 50;
    }
    
    const offset = (page - 1) * limit;
    const search = req.query.search || '';
    const status = req.query.status || '';
    const hiddenFilter = req.query.hidden; // Support for hidden filter from frontend
    
    console.log(`🔍 Request parameters - page: ${page}, status: "${status || 'none'}", hiddenFilter: "${hiddenFilter || 'none'}", search: "${search || 'none'}"`);
    
    // Build where clause - only authors can see hidden posts
    let whereClause = { hidden: false };
    
    // Apply role-based filtering - admin/author can see all posts
    const userRole = req.user?.role;
    const isAuthenticated = req.user && req.user.id;
    const isDashboardAccess = req.headers['x-dashboard-access'] === 'true';
    
    console.log(`Dashboard request - Auth: ${isAuthenticated}, Dashboard Header: ${isDashboardAccess}, User: ${req.user?.id || 'none'}, Status filter: ${status || 'none'}`);
    
    // For dashboard access with valid auth token OR when dashboard header is present, show all posts
    // (In development, we trust the dashboard header for testing)
    if ((isAuthenticated && isDashboardAccess) || (isDashboardAccess && process.env.NODE_ENV === 'development')) {
      // Admin/author can see ALL posts including hidden and drafts, but still apply filters if specified
      whereClause = {};
      console.log('Dashboard access granted - showing all posts including drafts and hidden');
      
      // Apply status filter for dashboard users only if specified
      if (status && status.trim() !== '') {
        whereClause.status = status;
        console.log(`Dashboard: Applied status filter - ${status}`);
      }
      
      // Apply hidden filter if specified (for the hidden tab)
      if (hiddenFilter === 'true' || hiddenFilter === true) {
        whereClause.hidden = true;
        console.log('Dashboard: Applied hidden filter - showing only hidden posts');
      } else if (hiddenFilter === 'false' || hiddenFilter === false) {
        whereClause.hidden = false;
        console.log('Dashboard: Applied non-hidden filter - showing only non-hidden posts');
      }
      // For "All" tab: hiddenFilter will be undefined, so no hidden filter is applied
      console.log('Dashboard: Final whereClause:', whereClause);
      
    } else {
      // Build where clause - only show non-hidden published posts for public access
      whereClause = { hidden: false, status: 'published' };
      console.log('Public access - showing only published, non-hidden posts');
      
      // For public access, status filter is already applied (published only)
      // But if a different status is requested, ignore it for security
      if (status && status !== 'published') {
        console.log(`Public access: Ignoring status filter '${status}' - only published posts allowed`);
      }
    }
    
    // Add search functionality
    if (search) {
      const { Op } = await import('sequelize');
      whereClause[Op.or] = [
        { title: { [Op.like]: `%${search}%` } },
        { content: { [Op.like]: `%${search}%` } },
        { category: { [Op.like]: `%${search}%` } }
      ];
    }
    
    // Get total count for pagination info (skip for first page to improve performance)
    let totalCount;
    if (page === 1) {
      // For first page, we'll calculate after the query to avoid expensive count
      totalCount = null;
    } else {
      const countStart = Date.now();
      totalCount = await Post.count({ where: whereClause });
      console.log(`Count query took: ${Date.now() - countStart}ms`);
    }

    const queryStart = Date.now();
    const posts = await Post.findAll({
      where: whereClause,
      attributes: [
        'id', 'postId', 'title', 'publishedAt', 'category', 'coverImage', 'authorId', 'author', 'comments', 'likes', 'updatedAt', 'excerpt', 'status', 'subtitle', 'views', 'hidden', 'urlSlug'
        // Removed for performance: 'content', 'date', 'likedBy', 'tags', 'additionalImages'
        // These can be fetched when viewing individual posts
      ],
      order: [['publishedAt', 'DESC'], ['id', 'DESC']], // Order by publishedAt first, then ID for consistent ordering
      limit: limit,
      offset: offset
    });
    console.log(`Main query took: ${Date.now() - queryStart}ms`);

    // Calculate total count and pagination info
    if (totalCount === null) {
      // For first page, assume more data exists if we got a full page
      totalCount = posts.length === limit ? 1000 : posts.length; // Conservative estimate
    }
    
    const totalPages = Math.ceil(totalCount / limit);
    const hasMore = posts.length === limit; // If we got a full page, assume more exists

    console.log(`Found ${posts.length} posts (page ${page}/${totalPages}) - Total time: ${Date.now() - startTime}ms`);
    console.log('Sample post statuses:', posts.slice(0, 3).map(p => ({
      id: p.id,
      title: p.title?.substring(0, 30),
      status: p.status,
      hidden: p.hidden
    })));
    
    const responseData = {
      posts: posts,
      pagination: {
        currentPage: page,
        totalPages: page === 1 ? (hasMore ? 99 : 1) : totalPages, // Conservative estimate for first page
        totalCount: page === 1 ? (hasMore ? 847 : posts.length) : totalCount, // Use known total for first page
        hasMore: hasMore,
        limit: limit
      }
    };
    
    // Cache first page for fast subsequent loads (dashboard-specific cache)
    if (page === 1) {
      dashboardCache.set(cacheKey, {
        data: responseData,
        timestamp: Date.now()
      });
    }
    
    res.json(responseData);
  } catch (err) {
    console.error('Error fetching posts:', err);
    
    // Handle specific database timeout errors
    if (err.name === 'SequelizeDatabaseError' && err.original?.sqlMessage?.includes('max_statement_time exceeded')) {
      console.error('Database query timeout - requested limit may be too high');
      return res.status(408).json({ 
        error: 'Request timeout - please try with a smaller page size',
        code: 'QUERY_TIMEOUT',
        suggestion: 'Try reducing the number of posts per page'
      });
    }
    
    res.status(500).json({ error: 'Failed to fetch posts' });
  }
};

export const getPublishedPosts = async (req, res) => {
  const startTime = Date.now();
  try {
    console.log('Fetching published posts...');
    
    // Parse pagination parameters with sensible limits
    const page = parseInt(req.query.page) || 1;
    let limit = parseInt(req.query.limit) || 20;
    const bustCache = req.query.bustCache === 'true' || req.query.nocache === 'true';
    
    // Check cache first for page 1 (unless cache busting is requested)
    const cacheKey = `published_posts_${page}_${limit}`;
    if (page === 1 && !bustCache && postsCache.has(cacheKey)) {
      const cached = postsCache.get(cacheKey);
      if (Date.now() - cached.timestamp < CACHE_TTL) {
        console.log(`Returning cached posts - Total time: ${Date.now() - startTime}ms`);
        return res.json(cached.data);
      }
      postsCache.delete(cacheKey);
    }
    
    // Enforce maximum limit to prevent database timeouts
    if (limit > 50) {
      console.log(`Limiting request from ${limit} to 50 posts to prevent database timeout`);
      limit = 50;
    }

    const offset = (page - 1) * limit;
    const search = req.query.search || '';
    
    // Build where clause - only published and not hidden posts for non-authors
    const whereClause = { 
      status: 'published',
      hidden: false  // Always exclude hidden posts for published endpoint
    };

    // Add category filter if provided
    if (req.query.category) {
      const decodedCategory = decodeURIComponent(req.query.category);
      whereClause.category = decodedCategory;
      console.log(`Filtering published posts by category: ${decodedCategory}`);
    }

    // Add search functionality
    if (search) {
      const { Op } = await import('sequelize');
      whereClause[Op.or] = [
        { title: { [Op.like]: `%${search}%` } },
        { content: { [Op.like]: `%${search}%` } },
        { category: { [Op.like]: `%${search}%` } }
      ];
    }

    // Get total count for pagination info - skip for first page to improve performance
    let totalCount;
    if (page === 1) {
      // For first page, we'll calculate after the query to avoid expensive count
      totalCount = null;
    } else {
      const countStart = Date.now();
      totalCount = await Post.count({ where: whereClause });
      console.log(`Count query took: ${Date.now() - countStart}ms`);
    }

    const queryStart = Date.now();
    const posts = await Post.findAll({
      where: whereClause,
      attributes: [
        'id', 'postId', 'title', 'publishedAt', 'category', 'coverImage', 'authorId', 'author', 'comments', 'likes', 'updatedAt', 'excerpt', 'likedBy', 'status', 'subtitle', 'tags', 'views', 'hidden'
        // Removed 'content' field to improve performance - not needed for post listings
        // Removed 'date' field as it doesn't exist in the model, using 'publishedAt' instead
      ],
      order: [['publishedAt', 'DESC'], ['id', 'DESC']], // Order by publishedAt first, then ID for consistent ordering
      limit: limit,
      offset: offset
    });
    console.log(`Main query took: ${Date.now() - queryStart}ms`);

    // Add userLiked field to each post
    const userId = req.user ? req.user.id : `${req.ip}-${req.get('User-Agent')?.slice(0, 50) || 'anonymous'}`;
    const processingStart = Date.now();
    const postsWithUserLiked = posts.map(post => {
      const postData = post.toJSON();
      const likedByArray = Array.isArray(postData.likedBy) ? postData.likedBy : [];
      const hasLiked = likedByArray.some(id => id.toString() === userId.toString());
      return {
        ...postData,
        userLiked: hasLiked
      };
    });
    console.log(`Post processing took: ${Date.now() - processingStart}ms`);

    // Calculate total count and pagination info
    if (totalCount === null) {
      // For first page, assume more data exists if we got a full page
      totalCount = posts.length === limit ? 1000 : posts.length; // Conservative estimate
    }
    
    const totalPages = Math.ceil(totalCount / limit);
    const hasMore = posts.length === limit; // If we got a full page, assume more exists

    console.log(`Found ${posts.length} published posts (page ${page}/${totalPages}) - Total time: ${Date.now() - startTime}ms`);
    
    const responseData = {
      posts: postsWithUserLiked,
      pagination: {
        currentPage: page,
        totalPages: page === 1 ? (hasMore ? 99 : 1) : totalPages, // Conservative estimate for first page
        totalCount: page === 1 ? (hasMore ? 847 : posts.length) : totalCount, // Use known total for first page
        hasMore: hasMore,
        limit: limit
      }
    };
    
    // Cache first page for fast subsequent loads
    if (page === 1) {
      postsCache.set(cacheKey, {
        data: responseData,
        timestamp: Date.now()
      });
    }
    
    res.json(responseData);
  } catch (err) {
    console.error('Error fetching published posts:', err);
    
    // Handle specific database timeout errors
    if (err.name === 'SequelizeDatabaseError' && err.original?.sqlMessage?.includes('max_statement_time exceeded')) {
      console.error('Database query timeout - requested limit may be too high');
      return res.status(408).json({ 
        error: 'Request timeout - please try with a smaller page size',
        code: 'QUERY_TIMEOUT',
        suggestion: 'Try reducing the number of posts per page'
      });
    }
    
    res.status(500).json({ error: 'Failed to fetch published posts' });
  }
};

export const getPostById = async (req, res) => {
  try {
    const { identifier } = req.params;
    
    console.log('🔍 Fetching post with identifier:', identifier);
    console.log('🔐 User context:', {
      authenticated: !!req.user,
      isAuthor: req.user?.isAuthor,
      userId: req.user?.id
    });
    
    if (!identifier) {
      console.log('❌ No identifier provided');
      return res.status(400).json({ error: 'Post ID is required' });
    }

    // Try to find by URL slug first, then by postId, then by numeric id
    let whereClause = { urlSlug: identifier };
    // Add hidden filter for non-authors
    if (!req.user || !req.user.isAuthor) {
      whereClause.hidden = false;
    }
    
    console.log('🔍 Searching by URL slug with clause:', whereClause);
    let post = await Post.findOne({ 
      where: whereClause,
      attributes: [
        'id', 'postId', 'title', 'date', 'category', 'coverImage', 'authorId', 'author', 'comments', 'likes', 'updatedAt', 'excerpt', 'likedBy', 'status', 'subtitle', 'content', 'tags', 'views', 'publishedAt', 'hidden', 'urlSlug', 'additionalImages'
      ]
    });
    console.log('📝 Search by URL slug result:', post ? `Found: ${post.title}` : 'Not found');
    
    if (!post) {
      // Try by postId
      whereClause = { postId: identifier };
      // Add hidden filter for non-authors
      if (!req.user || !req.user.isAuthor) {
        whereClause.hidden = false;
      }
      
      console.log('🔍 Searching by postId with clause:', whereClause);
      post = await Post.findOne({ 
        where: whereClause,
        attributes: [
          'id', 'postId', 'title', 'date', 'category', 'coverImage', 'authorId', 'author', 'comments', 'likes', 'updatedAt', 'excerpt', 'likedBy', 'status', 'subtitle', 'content', 'tags', 'views', 'publishedAt', 'hidden', 'urlSlug', 'additionalImages'
        ]
      });
      console.log('📝 Search by postId result:', post ? `Found: ${post.title}` : 'Not found');
    }
    
    if (!post) {
      // If not found by postId, try by numeric id
      const numericId = parseInt(identifier);
      console.log('🔍 Trying numeric ID:', numericId);
      if (!isNaN(numericId)) {
        const numericWhereClause = { id: numericId };
        // Add hidden filter for non-authors
        if (!req.user || !req.user.isAuthor) {
          numericWhereClause.hidden = false;
        }
        
        console.log('🔍 Searching by numeric ID with clause:', numericWhereClause);
        post = await Post.findOne({
          where: numericWhereClause,
          attributes: [
            'id', 'postId', 'title', 'date', 'category', 'coverImage', 'authorId', 'author', 'comments', 'likes', 'updatedAt', 'excerpt', 'likedBy', 'status', 'subtitle', 'content', 'tags', 'views', 'publishedAt', 'hidden', 'urlSlug', 'additionalImages'
          ]
        });
        console.log('📝 Search by numeric ID result:', post ? `Found: ${post.title}` : 'Not found');
      }
    }

    if (!post) {
      console.log('Post not found for identifier:', identifier);
      return res.status(404).json({ error: 'Post not found' });
    }

    // Add userLiked field to the post
    const userId = req.user ? req.user.id : `${req.ip}-${req.get('User-Agent')?.slice(0, 50) || 'anonymous'}`;
    const postData = post.toJSON();
    const likedByArray = Array.isArray(postData.likedBy) ? postData.likedBy : [];
    const hasLiked = likedByArray.some(id => id.toString() === userId.toString());
    const postWithUserLiked = {
      ...postData,
      userLiked: hasLiked
    };

    console.log('Post found:', post.title);
    res.json(postWithUserLiked);
  } catch (err) {
    console.error('Error fetching post by id:', err);
    res.status(500).json({ error: 'Failed to fetch post' });
  }
}; 

export const getCategories = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || '';
    const offset = (page - 1) * limit;
    
    // Check if Post model is available
    if (!Post) {
      console.error('Post model not available');
      return res.json({ categories: [], pagination: { hasMore: false, totalCount: 0 } });
    }
    
    const { Op, sequelize } = await import('sequelize');
    
    // Build where clause for search
    let whereClause = {
      category: {
        [Op.not]: null,
        [Op.ne]: ''
      }
    };
    
    if (search) {
      whereClause.category = {
        [Op.and]: [
          { [Op.not]: null },
          { [Op.ne]: '' },
          { [Op.like]: `%${search}%` }
        ]
      };
    }
    
    // Get categories with their counts
    const categoriesRaw = await Post.findAll({
      attributes: [
        'category',
        [sequelize.fn('COUNT', sequelize.col('*')), 'count']
      ],
      where: whereClause,
      group: ['category'],
      order: [[sequelize.fn('COUNT', sequelize.col('*')), 'DESC']],
      limit: limit,
      offset: offset,
      raw: true
    });
    
    // Get total count of unique categories
    const totalCategoriesResult = await Post.findAll({
      attributes: [[sequelize.fn('DISTINCT', sequelize.col('category')), 'category']],
      where: {
        category: {
          [Op.not]: null,
          [Op.ne]: ''
        }
      },
      raw: true
    });
    
    let totalCount = totalCategoriesResult.length;
    if (search) {
      const searchFilteredCount = await Post.findAll({
        attributes: [[sequelize.fn('DISTINCT', sequelize.col('category')), 'category']],
        where: whereClause,
        raw: true
      });
      totalCount = searchFilteredCount.length;
    }
    
    const categories = categoriesRaw.map(row => ({
      name: row.category,
      count: parseInt(row.count) || 0
    }));
    
    const totalPages = Math.ceil(totalCount / limit);
    const hasMore = page < totalPages;
    
    console.log(`Categories found: ${categories.length} (page ${page}/${totalPages})`);
    res.json({
      categories: categories,
      pagination: {
        currentPage: page,
        totalPages: totalPages,
        totalCount: totalCount,
        hasMore: hasMore,
        limit: limit
      }
    });
  } catch (error) {
    console.error('Error fetching categories:', error);
    // Return empty array instead of error to prevent frontend crashes
    res.json({ categories: [], pagination: { hasMore: false, totalCount: 0 } });
  }
};

// Helper function to handle category assignment
export const assignPostToCategory = async (post, categoryName) => {
  try {
    if (!categoryName || !categoryName.trim()) {
      return null;
    }
    
    const trimmedCategoryName = categoryName.trim();
    
    // Create slug from category name
    const slug = trimmedCategoryName
      .toLowerCase()
      .replace(/[^\w\s-]/g, '') // Remove special characters
      .replace(/[\s_-]+/g, '-') // Replace spaces and underscores with hyphens
      .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
    
    // Find or create category
    const [category, created] = await Category.findOrCreate({
      where: { name: trimmedCategoryName },
      defaults: {
        name: trimmedCategoryName,
        slug: slug,
        description: `Posts related to ${trimmedCategoryName}`,
        postCount: 0,
        isActive: true
      }
    });
    
    // Get previous category ID if post already exists
    const previousCategoryId = post.categoryId;
    
    // Update post with new category
    await post.update({
      category: trimmedCategoryName, // Keep for backward compatibility
      categoryId: category.id
    });
    
    // Update post counts
    await updateCategoryPostCounts([previousCategoryId, category.id].filter(Boolean));
    
    if (created) {
      console.log(`Created new category: ${trimmedCategoryName}`);
    }
    
    return category;
    
  } catch (error) {
    console.error('Error assigning post to category:', error);
    throw error;
  }
};

// Helper function to update category post counts
export const updateCategoryPostCounts = async (categoryIds) => {
  try {
    for (const categoryId of categoryIds) {
      if (categoryId) {
        const category = await Category.findByPk(categoryId);
        if (category) {
          const postCount = await Post.count({
            where: {
              categoryId: categoryId,
              status: 'published',
              hidden: false
            }
          });
          await category.update({ postCount });
        }
      }
    }
  } catch (error) {
    console.error('Error updating category post counts:', error);
  }
};