import express from 'express';
import { Post, Diary } from '../models/index.js';
import { updateDiaryEntries, clearDiaryCache } from '../utils/diaryUtils.js';
import { dashboardCache } from '../controllers/postController.js';

const router = express.Router();

// Clear diary-related caches
function clearDiaryCaches() {
  // Clear backend dashboard cache
  if (dashboardCache && dashboardCache.clear) {
    dashboardCache.clear();
  }
}

// Get all diary entries (year-month combinations) with pagination
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const search = req.query.search || '';

    let whereClause = {
      isActive: true
    };

    // Add search functionality
    if (search) {
      const { Op } = await import('sequelize');
      whereClause[Op.or] = [
        { monthName: { [Op.like]: `%${search}%` } },
        { year: { [Op.like]: `%${search}%` } }
      ];
    }

    // Filter by minimum post count
    if (req.query.minPosts) {
      const { Op } = await import('sequelize');
      whereClause.postCount = {
        [Op.gt]: parseInt(req.query.minPosts) - 1
      };
    }

    const { count, rows: diary } = await Diary.findAndCountAll({
      where: whereClause,
      order: [
        ['year', 'DESC'],
        ['month', 'DESC']
      ],
      limit,
      offset
    });

    res.json({
      diary,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(count / limit),
        totalCount: count,
        hasMore: page * limit < count,
        limit
      }
    });
  } catch (error) {
    console.error('Error fetching diary entries:', error);
    res.status(500).json({ error: 'Failed to fetch diary entries' });
  }
});

// Get posts for a specific diary entry (year/month)
router.get('/:slug/posts', async (req, res) => {
  try {
    const { slug } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const search = req.query.search || '';

    // Find the diary entry
    const diary = await Diary.findOne({
      where: { slug, isActive: true }
    });

    if (!diary) {
      return res.status(404).json({ error: 'Diary entry not found' });
    }

    let whereClause = {
      publishedYear: diary.year,
      publishedMonth: diary.month,
      status: 'published',
      hidden: false
    };

    // Add search functionality
    if (search) {
      const { Op } = await import('sequelize');
      whereClause[Op.or] = [
        { title: { [Op.iLike]: `%${search}%` } },
        { excerpt: { [Op.iLike]: `%${search}%` } },
        { content: { [Op.iLike]: `%${search}%` } }
      ];
    }

    const { count, rows: posts } = await Post.findAndCountAll({
      where: whereClause,
      order: [['publishedAt', 'DESC']],
      limit,
      offset
    });

    res.json({
      diary: {
        id: diary.id,
        year: diary.year,
        month: diary.month,
        monthName: diary.monthName,
        slug: diary.slug,
        postCount: diary.postCount
      },
      posts,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(count / limit),
        totalCount: count,
        hasMore: page * limit < count,
        limit
      }
    });
  } catch (error) {
    console.error('Error fetching posts for diary entry:', error);
    res.status(500).json({ error: 'Failed to fetch posts for diary entry' });
  }
});

// Get posts for a specific date (year/month/day)
router.get('/date/:year/:month/:day', async (req, res) => {
  try {
    const { year, month, day } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const search = req.query.search || '';

    // Convert month name to number if needed
    let monthNumber = parseInt(month);
    if (isNaN(monthNumber)) {
      const monthNames = [
        'january', 'february', 'march', 'april', 'may', 'june',
        'july', 'august', 'september', 'october', 'november', 'december'
      ];
      monthNumber = monthNames.indexOf(month.toLowerCase()) + 1;
    }

    let whereClause = {
      publishedYear: parseInt(year),
      publishedMonth: monthNumber,
      publishedDay: parseInt(day),
      status: 'published',
      hidden: false
    };

    // Add search functionality
    if (search) {
      const { Op } = await import('sequelize');
      whereClause[Op.or] = [
        { title: { [Op.iLike]: `%${search}%` } },
        { excerpt: { [Op.iLike]: `%${search}%` } },
        { content: { [Op.iLike]: `%${search}%` } }
      ];
    }

    const { count, rows: posts } = await Post.findAndCountAll({
      where: whereClause,
      order: [['publishedAt', 'DESC']],
      limit,
      offset
    });

    res.json({
      date: {
        year: parseInt(year),
        month: monthNumber,
        day: parseInt(day)
      },
      posts,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(count / limit),
        totalCount: count,
        hasMore: page * limit < count,
        limit
      }
    });
  } catch (error) {
    console.error('Error fetching posts for specific date:', error);
    res.status(500).json({ error: 'Failed to fetch posts for specific date' });
  }
});

// Manual diary update endpoint (useful for maintenance)
router.post('/update', async (req, res) => {
  try {
    const result = await updateDiaryEntries();
    
    // Clear caches after update
    clearDiaryCaches();
    
    res.json({
      success: true,
      message: 'Diary entries updated successfully',
      result: {
        created: result.created,
        updated: result.updated,
        total: result.total
      }
    });
  } catch (error) {
    console.error('Error in manual diary update:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to update diary entries',
      message: error.message 
    });
  }
});

// Clear diary caches endpoint
router.post('/clear-cache', (req, res) => {
  try {
    clearDiaryCaches();
    res.json({
      success: true,
      message: 'Diary caches cleared successfully',
      cachesToClear: clearDiaryCache().cachesToClear
    });
  } catch (error) {
    console.error('Error clearing diary cache:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to clear diary cache' 
    });
  }
});

export default router;
