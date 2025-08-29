import express from 'express';
import analyticsService from '../services/analyticsService.js';
import auth from '../middleware/auth.js';
import { Op } from 'sequelize';
import { sequelize } from '../config/db.js';
import Analytics from '../models/Analytics.js';
import PageView from '../models/PageView.js';
import Visitor from '../models/Visitor.js';
import Post from '../models/Post.js';

const router = express.Router();

// Middleware to track page views (public endpoint)
router.post('/track', async (req, res) => {
  try {
    console.log('Analytics track request body:', JSON.stringify(req.body, null, 2));
    
    const {
      postId,
      url,
      title,
      sessionId,
      timeOnPage,
      scrollDepth,
      visitorId
    } = req.body;

    // Validate required fields
    if (!url) {
      console.warn('Analytics track request missing URL:', req.body);
      return res.status(400).json({ error: 'URL is required' });
    }

    // Validate URL format
    try {
      new URL(url);
    } catch (error) {
      console.warn('Analytics track request invalid URL format:', url);
      return res.status(400).json({ error: 'Invalid URL format' });
    }

    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('User-Agent');
    const referrer = req.get('Referer');
    const userId = req.user ? req.user.id : null;

    console.log('Analytics track data:', {
      postId, url, title, sessionId, timeOnPage, scrollDepth, visitorId,
      ipAddress, userAgent: userAgent?.substring(0, 100) + '...'
    });

    const pageView = await analyticsService.recordPageView({
      postId,
      url,
      title,
      ipAddress,
      userAgent,
      referrer,
      userId,
      sessionId,
      timeOnPage,
      scrollDepth,
      visitorId
    }, req); // Pass req object for consistent user identification

    if (pageView) {
      res.json({ 
        success: true, 
        visitorId: pageView.visitorId
      });
    } else {
      // Bot traffic or filtered out
      res.json({ 
        success: true, 
        filtered: true,
        reason: 'Bot traffic or filtered'
      });
    }
  } catch (error) {
    console.error('Analytics track error:', error);
    console.error('Request body that caused error:', req.body);
    res.status(500).json({ 
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Analytics tracking failed'
    });
  }
});

// Track engagement events (batch endpoint)
router.post('/engagement', async (req, res) => {
  try {
    const { events } = req.body;
    
    if (!Array.isArray(events)) {
      return res.status(400).json({ error: 'Events must be an array' });
    }
    
    // Process engagement events (time on page, etc.)
    for (const event of events) {
      if (event.timeSpent && event.timeSpent > 1000) { // Only track meaningful time
        // You can add engagement tracking logic here if needed
        console.log('Engagement tracked:', {
          visitorId: event.visitorId,
          postId: event.postId,
          timeSpent: event.timeSpent
        });
      }
    }
    
    res.json({ success: true, processed: events.length });
  } catch (error) {
    console.error('Engagement tracking error:', error);
    res.status(500).json({ error: 'Failed to track engagement' });
  }
});

// Get site-wide statistics (protected route)
router.get('/site-stats', auth, async (req, res) => {
  try {
    const { period = 'all' } = req.query;
    const stats = await analyticsService.getSiteStats(period);
    res.json(stats);
  } catch (error) {
    console.error('Error getting site stats:', error);
    res.status(500).json({ error: 'Failed to get site statistics' });
  }
});

// Get detailed dashboard statistics (protected route)
router.get('/dashboard', auth, async (req, res) => {
  try {
    // Get overall site stats
    const siteStats = await analyticsService.getSiteStats();
    
    // Get top posts
    const topPosts = await analyticsService.getTopPosts(10, '30days');
    
    // Get recent activity (last 7 days)
    const recentActivity = await analyticsService.getPostStats(null, '7days');
    
    // Get traffic sources for last 30 days
    const trafficSources = await PageView.findAll({
      attributes: [
        'trafficSource',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      where: {
        isBot: false,
        viewDate: {
          [Op.gte]: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        }
      },
      group: ['trafficSource'],
      order: [[sequelize.fn('COUNT', sequelize.col('id')), 'DESC']]
    });

    // Get device breakdown
    const deviceBreakdown = await PageView.findAll({
      attributes: [
        'deviceType',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      where: {
        isBot: false,
        viewDate: {
          [Op.gte]: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        }
      },
      group: ['deviceType'],
      order: [[sequelize.fn('COUNT', sequelize.col('id')), 'DESC']]
    });

    res.json({
      siteStats,
      topPosts,
      recentActivity,
      trafficSources: trafficSources.map(ts => ({
        source: ts.trafficSource,
        count: parseInt(ts.dataValues.count)
      })),
      deviceBreakdown: deviceBreakdown.map(db => ({
        device: db.deviceType,
        count: parseInt(db.dataValues.count)
      }))
    });
  } catch (error) {
    console.error('Error getting dashboard stats:', error);
    res.status(500).json({ error: 'Failed to get dashboard statistics' });
  }
});

// Get analytics for all published posts with pagination (public endpoint)
router.get('/all-posts-detailed', async (req, res) => {
  try {
    const { period = '30days', limit = 20, page = 1, search = '' } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let dateFilter = {};
    const now = new Date();
    
    switch (period) {
      case '7days':
        dateFilter = { [Op.gte]: new Date(now - 7 * 24 * 60 * 60 * 1000) };
        break;
      case '30days':
        dateFilter = { [Op.gte]: new Date(now - 30 * 24 * 60 * 60 * 1000) };
        break;
      case 'thisMonth':
        dateFilter = { 
          [Op.gte]: new Date(now.getFullYear(), now.getMonth(), 1),
          [Op.lt]: new Date(now.getFullYear(), now.getMonth() + 1, 1)
        };
        break;
      case 'lastMonth':
        dateFilter = { 
          [Op.gte]: new Date(now.getFullYear(), now.getMonth() - 1, 1),
          [Op.lt]: new Date(now.getFullYear(), now.getMonth(), 1)
        };
        break;
      default:
        dateFilter = {};
    }

    // Build where condition for posts
    const postWhere = {
      status: 'published',
      hidden: false
    };

    // Add search filter if provided
    if (search && search.trim()) {
      postWhere[Op.or] = [
        {
          title: {
            [Op.like]: `%${search.trim()}%`
          }
        },
        {
          excerpt: {
            [Op.like]: `%${search.trim()}%`
          }
        }
      ];
    }

    // First get the total count of published posts (with search filter)
    const totalCount = await Post.count({
      where: postWhere
    });

    // Get all published posts with pagination and search
    const posts = await Post.findAll({
      attributes: ['id', 'title', 'createdAt', 'status', 'views', 'likes', 'comments'],
      where: postWhere,
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset,
      raw: true
    });

    const postsWithAnalytics = [];

    for (const post of posts) {
      // Get total views for this post from PageView table
      const totalViews = await PageView.count({
        where: {
          postId: post.id.toString(),
          isBot: false
        }
      });

      // Get views for the period
      const periodViews = await PageView.count({
        where: {
          postId: post.id.toString(),
          isBot: false,
          ...(Object.keys(dateFilter).length > 0 && { createdAt: dateFilter })
        }
      });

      // Get unique visitors
      const uniqueVisitors = await PageView.count({
        distinct: true,
        col: 'visitorId',
        where: {
          postId: post.id.toString(),
          isBot: false,
          ...(Object.keys(dateFilter).length > 0 && { createdAt: dateFilter })
        }
      });

      // Get daily views for the period
      const dailyViews = await PageView.findAll({
        attributes: [
          [sequelize.fn('DATE', sequelize.col('createdAt')), 'date'],
          [sequelize.fn('COUNT', sequelize.col('id')), 'views']
        ],
        where: {
          postId: post.id.toString(),
          isBot: false,
          ...(Object.keys(dateFilter).length > 0 && { createdAt: dateFilter })
        },
        group: [sequelize.fn('DATE', sequelize.col('createdAt'))],
        order: [[sequelize.fn('DATE', sequelize.col('createdAt')), 'ASC']],
        raw: true
      });

      // Include all published posts, even those without analytics data
      postsWithAnalytics.push({
        post: {
          id: post.id,
          title: post.title,
          createdAt: post.createdAt,
          status: post.status
        },
        analytics: {
          totalViews: totalViews || post.views || 0,
          periodViews: periodViews || 0,
          uniqueVisitors: uniqueVisitors || 0,
          dailyViews: dailyViews.map(dv => ({
            date: dv.date,
            views: parseInt(dv.views)
          }))
        }
      });
    }

    const totalPages = Math.ceil(totalCount / parseInt(limit));
    const hasMore = parseInt(page) < totalPages;

    res.json({
      period,
      totalPosts: totalCount,
      posts: postsWithAnalytics,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalCount,
        hasMore,
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Error getting all posts analytics:', error);
    res.status(500).json({ error: 'Failed to get posts analytics' });
  }
});

// Get individual post analytics with charts (protected route)
router.get('/post/:postId/detailed', async (req, res) => {
  try {
    const { postId } = req.params;
    const { period = '30days' } = req.query;

    // Get the post details first - handle both numeric ID and string postId
    let post;
    
    // First try to find by primary key (numeric id)
    if (!isNaN(postId)) {
      post = await Post.findByPk(parseInt(postId), {
        attributes: ['id', 'postId', 'title', 'urlSlug', 'createdAt', 'status']
      });
    }
    
    // If not found or if postId is not numeric, try to find by postId field
    if (!post) {
      post = await Post.findOne({
        where: { postId: postId },
        attributes: ['id', 'postId', 'title', 'urlSlug', 'createdAt', 'status']
      });
    }

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    // Use the actual database ID for all PageView queries
    const actualPostId = post.id;

    let dateFilter = {};
    const now = new Date();
    
    switch (period) {
      case '7days':
        dateFilter = { [Op.gte]: new Date(now - 7 * 24 * 60 * 60 * 1000) };
        break;
      case '30days':
        dateFilter = { [Op.gte]: new Date(now - 30 * 24 * 60 * 60 * 1000) };
        break;
      case 'thisMonth':
        dateFilter = { 
          [Op.gte]: new Date(now.getFullYear(), now.getMonth(), 1),
          [Op.lt]: new Date(now.getFullYear(), now.getMonth() + 1, 1)
        };
        break;
      case 'lastMonth':
        dateFilter = { 
          [Op.gte]: new Date(now.getFullYear(), now.getMonth() - 1, 1),
          [Op.lt]: new Date(now.getFullYear(), now.getMonth(), 1)
        };
        break;
      default:
        dateFilter = {};
    }

    // Get daily views for the post
    const dailyViews = await PageView.findAll({
      attributes: [
        [sequelize.fn('DATE', sequelize.col('createdAt')), 'date'],
        [sequelize.fn('COUNT', sequelize.col('id')), 'views'],
        [sequelize.fn('COUNT', sequelize.literal('DISTINCT visitorId')), 'uniqueViews']
      ],
      where: {
        postId: actualPostId.toString(), // Convert to string as PageView stores postId as string
        isBot: false,
        ...(Object.keys(dateFilter).length > 0 && { createdAt: dateFilter })
      },
      group: [sequelize.fn('DATE', sequelize.col('createdAt'))],
      order: [[sequelize.fn('DATE', sequelize.col('createdAt')), 'ASC']],
      raw: true
    });

    // Get hourly distribution for today
    const hourlyViews = await PageView.findAll({
      attributes: [
        [sequelize.fn('HOUR', sequelize.col('createdAt')), 'hour'],
        [sequelize.fn('COUNT', sequelize.col('id')), 'views']
      ],
      where: {
        postId: actualPostId.toString(),
        isBot: false,
        createdAt: {
          [Op.gte]: new Date(now.toDateString())
        }
      },
      group: [sequelize.fn('HOUR', sequelize.col('createdAt'))],
      order: [[sequelize.fn('HOUR', sequelize.col('createdAt')), 'ASC']],
      raw: true
    });

    // Get device breakdown
    const deviceBreakdown = await PageView.findAll({
      attributes: [
        'deviceType',
        [sequelize.fn('COUNT', sequelize.col('id')), 'views']
      ],
      where: {
        postId: actualPostId.toString(),
        isBot: false,
        ...(Object.keys(dateFilter).length > 0 && { createdAt: dateFilter })
      },
      group: ['deviceType'],
      order: [[sequelize.fn('COUNT', sequelize.col('id')), 'DESC']],
      raw: true
    });

    // Get traffic sources
    const trafficSources = await PageView.findAll({
      attributes: [
        'referrerDomain',
        [sequelize.fn('COUNT', sequelize.col('id')), 'views']
      ],
      where: {
        postId: actualPostId.toString(),
        isBot: false,
        referrerDomain: { [Op.not]: null },
        ...(Object.keys(dateFilter).length > 0 && { createdAt: dateFilter })
      },
      group: ['referrerDomain'],
      order: [[sequelize.fn('COUNT', sequelize.col('id')), 'DESC']],
      limit: 10,
      raw: true
    });

    // Get overall post stats
    const totalViews = await PageView.count({
      where: {
        postId: actualPostId.toString(),
        isBot: false
      }
    });

    const uniqueVisitors = await PageView.count({
      distinct: true,
      col: 'visitorId',
      where: {
        postId: actualPostId.toString(),
        isBot: false
      }
    });

    // Get average engagement metrics
    const engagementMetrics = await PageView.findOne({
      attributes: [
        [sequelize.fn('AVG', sequelize.col('timeOnPage')), 'avgTimeOnPage'],
        [sequelize.fn('AVG', sequelize.col('scrollDepth')), 'avgScrollDepth']
      ],
      where: {
        postId: actualPostId.toString(),
        isBot: false,
        timeOnPage: { [Op.not]: null }
      },
      raw: true
    });

    res.json({
      post: {
        id: post.id,
        postId: post.postId, // Include both IDs for frontend reference
        title: post.title,
        urlSlug: post.urlSlug,
        createdAt: post.createdAt,
        status: post.status
      },
      overview: {
        totalViews,
        uniqueVisitors,
        avgTimeOnPage: Math.round(parseFloat(engagementMetrics?.avgTimeOnPage || 0)),
        avgScrollDepth: Math.round(parseFloat(engagementMetrics?.avgScrollDepth || 0))
      },
      dailyViews: dailyViews.map(dv => ({
        date: dv.date,
        views: parseInt(dv.views),
        uniqueViews: parseInt(dv.uniqueViews)
      })),
      hourlyViews: hourlyViews.map(hv => ({
        hour: parseInt(hv.hour),
        views: parseInt(hv.views)
      })),
      deviceBreakdown: deviceBreakdown.map(db => ({
        device: db.deviceType || 'Unknown',
        views: parseInt(db.views)
      })),
      trafficSources: trafficSources.map(ts => ({
        source: ts.referrerDomain || 'Direct',
        views: parseInt(ts.views)
      }))
    });
  } catch (error) {
    console.error('Error getting detailed post analytics:', error);
    res.status(500).json({ error: 'Failed to get post analytics' });
  }
});

// Get statistics for a specific post (protected route)
router.get('/post/:postId', auth, async (req, res) => {
  try {
    const { postId } = req.params;
    const { period = '7days' } = req.query;
    
    const stats = await analyticsService.getPostStats(postId, period);
    
    // Get additional post-specific metrics
    const postMetrics = await PageView.findAll({
      attributes: [
        [sequelize.fn('AVG', sequelize.col('timeOnPage')), 'avgTimeOnPage'],
        [sequelize.fn('AVG', sequelize.col('scrollDepth')), 'avgScrollDepth'],
        [sequelize.fn('COUNT', sequelize.col('id')), 'totalViews']
      ],
      where: {
        postId,
        isBot: false,
        timeOnPage: { [Op.not]: null }
      }
    });

    // Get top referrers for this post
    const topReferrers = await PageView.findAll({
      attributes: [
        'referrerDomain',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      where: {
        postId,
        isBot: false,
        referrerDomain: { [Op.not]: null }
      },
      group: ['referrerDomain'],
      order: [[sequelize.fn('COUNT', sequelize.col('id')), 'DESC']],
      limit: 10
    });

    res.json({
      ...stats,
      metrics: postMetrics[0] ? {
        avgTimeOnPage: parseFloat(postMetrics[0].dataValues.avgTimeOnPage || 0),
        avgScrollDepth: parseFloat(postMetrics[0].dataValues.avgScrollDepth || 0)
      } : { avgTimeOnPage: 0, avgScrollDepth: 0 },
      topReferrers: topReferrers.map(ref => ({
        domain: ref.referrerDomain,
        count: parseInt(ref.dataValues.count)
      }))
    });
  } catch (error) {
    console.error('Error getting post stats:', error);
    res.status(500).json({ error: 'Failed to get post statistics' });
  }
});

// Temporary test route (remove in production)
router.get('/test-posts', async (req, res) => {
  try {
    console.log('📊 Test Analytics: /test-posts called');
    
    // Set proper UTF-8 headers for Tamil text
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    
    const { limit = 20, period = '30days' } = req.query;
    console.log(`📊 Test Analytics: Getting top posts (limit: ${limit}, period: ${period})`);
    
    const topPosts = await analyticsService.getTopPosts(parseInt(limit), period);
    console.log(`📊 Test Analytics: Retrieved ${topPosts.length} posts`);
    
    res.json(topPosts);
  } catch (error) {
    console.error('Error getting test top posts:', error);
    res.status(500).json({ error: 'Failed to get test top posts', details: error.message });
  }
});

// Get top posts (protected route)
router.get('/top-posts', auth, async (req, res) => {
  try {
    console.log('📊 Analytics API: /top-posts called');
    
    // Set proper UTF-8 headers for Tamil text
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    
    const { limit = 20, period = '30days' } = req.query;
    console.log(`📊 Analytics API: Getting top posts (limit: ${limit}, period: ${period})`);
    
    const topPosts = await analyticsService.getTopPosts(parseInt(limit), period);
    console.log(`📊 Analytics API: Retrieved ${topPosts.length} posts`);
    
    res.json(topPosts);
  } catch (error) {
    console.error('Error getting top posts:', error);
    res.status(500).json({ error: 'Failed to get top posts' });
  }
});

// Get visitor statistics (protected route)
router.get('/visitors', auth, async (req, res) => {
  try {
    const { period = '30days' } = req.query;
    const conditions = analyticsService.getPeriodConditions(period);

    // Get visitor counts
    const totalVisitors = await Visitor.count({
      where: {
        isBot: false,
        firstVisit: conditions.viewDate || {}
      }
    });

    const returningVisitors = await Visitor.count({
      where: {
        isBot: false,
        totalVisits: { [Op.gt]: 1 },
        lastVisit: conditions.viewDate || {}
      }
    });

    // Get geographic distribution
    const countries = await Visitor.findAll({
      attributes: [
        'country',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      where: {
        isBot: false,
        country: { [Op.not]: null }
      },
      group: ['country'],
      order: [[sequelize.fn('COUNT', sequelize.col('id')), 'DESC']],
      limit: 10
    });

    // Get browser statistics
    const browsers = await Visitor.findAll({
      attributes: [
        'browser',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      where: {
        isBot: false,
        browser: { [Op.not]: null }
      },
      group: ['browser'],
      order: [[sequelize.fn('COUNT', sequelize.col('id')), 'DESC']],
      limit: 10
    });

    res.json({
      totalVisitors,
      returningVisitors,
      newVisitors: totalVisitors - returningVisitors,
      countries: countries.map(c => ({
        country: c.country,
        count: parseInt(c.dataValues.count)
      })),
      browsers: browsers.map(b => ({
        browser: b.browser,
        count: parseInt(b.dataValues.count)
      }))
    });
  } catch (error) {
    console.error('Error getting visitor stats:', error);
    res.status(500).json({ error: 'Failed to get visitor statistics' });
  }
});

// Get real-time statistics (protected route)
router.get('/realtime', auth, async (req, res) => {
  try {
    const now = new Date();
    const lastHour = new Date(now.getTime() - 60 * 60 * 1000);
    const last5Minutes = new Date(now.getTime() - 5 * 60 * 1000);

    // Active visitors (viewed a page in last 5 minutes)
    const activeVisitors = await PageView.count({
      distinct: true,
      col: 'visitorId',
      where: {
        isBot: false,
        viewDate: { [Op.gte]: last5Minutes }
      }
    });

    // Page views in last hour
    const recentViews = await PageView.count({
      where: {
        isBot: false,
        viewDate: { [Op.gte]: lastHour }
      }
    });

    // Most viewed pages in last hour
    const popularPages = await PageView.findAll({
      attributes: [
        'url',
        'title',
        [sequelize.fn('COUNT', sequelize.col('id')), 'views']
      ],
      where: {
        isBot: false,
        viewDate: { [Op.gte]: lastHour }
      },
      group: ['url', 'title'],
      order: [[sequelize.fn('COUNT', sequelize.col('id')), 'DESC']],
      limit: 5
    });

    res.json({
      activeVisitors,
      recentViews,
      popularPages: popularPages.map(page => ({
        url: page.url,
        title: page.title,
        views: parseInt(page.dataValues.views)
      }))
    });
  } catch (error) {
    console.error('Error getting realtime stats:', error);
    res.status(500).json({ error: 'Failed to get realtime statistics' });
  }
});

// Get Blogger-style analytics (protected route)
router.get('/blogger-style', auth, async (req, res) => {
  try {
    const { period = '30days' } = req.query;
    
    // Get total all-time views
    const totalViews = await PageView.count({
      where: { isBot: false }
    });

    // Get today's views
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayViews = await PageView.count({
      where: {
        isBot: false,
        viewDate: { [Op.gte]: todayStart }
      }
    });

    // Get yesterday's views
    const yesterdayStart = new Date();
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);
    yesterdayStart.setHours(0, 0, 0, 0);
    const yesterdayEnd = new Date(yesterdayStart);
    yesterdayEnd.setHours(23, 59, 59, 999);
    const yesterdayViews = await PageView.count({
      where: {
        isBot: false,
        viewDate: {
          [Op.gte]: yesterdayStart,
          [Op.lte]: yesterdayEnd
        }
      }
    });

    // Get this month's views
    const thisMonthStart = new Date();
    thisMonthStart.setDate(1);
    thisMonthStart.setHours(0, 0, 0, 0);
    const thisMonthViews = await PageView.count({
      where: {
        isBot: false,
        viewDate: { [Op.gte]: thisMonthStart }
      }
    });

    // Get last month's views
    const lastMonthStart = new Date();
    lastMonthStart.setMonth(lastMonthStart.getMonth() - 1);
    lastMonthStart.setDate(1);
    lastMonthStart.setHours(0, 0, 0, 0);
    const lastMonthEnd = new Date(thisMonthStart.getTime() - 1);
    const lastMonthViews = await PageView.count({
      where: {
        isBot: false,
        viewDate: {
          [Op.gte]: lastMonthStart,
          [Op.lte]: lastMonthEnd
        }
      }
    });

    res.json({
      totalViews,
      todayViews,
      yesterdayViews,
      thisMonthViews,
      lastMonthViews
    });
  } catch (error) {
    console.error('Error getting Blogger-style analytics:', error);
    res.status(500).json({ error: 'Failed to get Blogger-style analytics' });
  }
});

// Get detailed views data for graphs (protected route)
router.get('/detailed-views', auth, async (req, res) => {
  try {
    const { period = '30days' } = req.query;
    
    let startDate = new Date();
    let endDate = new Date();
    
    // Set proper date ranges based on period
    if (period === '7days') {
      startDate.setDate(startDate.getDate() - 7);
    } else if (period === '30days') {
      startDate.setDate(startDate.getDate() - 30);
    } else if (period === '90days') {
      startDate.setDate(startDate.getDate() - 90);
    } else if (period === 'thisMonth') {
      // Start from the 1st day of current month
      startDate.setDate(1);
    } else if (period === 'lastMonth') {
      // Start from 1st day of last month, end on last day of last month
      const lastMonth = new Date();
      lastMonth.setMonth(lastMonth.getMonth() - 1);
      startDate.setMonth(lastMonth.getMonth());
      startDate.setDate(1);
      endDate.setMonth(lastMonth.getMonth() + 1);
      endDate.setDate(0); // Last day of last month
    } else if (period === 'all') {
      // Start from a very early date for all time
      startDate = new Date('2020-01-01');
    } else {
      // Default to 30 days
      startDate.setDate(startDate.getDate() - 30);
    }
    
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);

    // Get daily view counts
    const dailyViews = await PageView.findAll({
      attributes: [
        [sequelize.fn('DATE', sequelize.col('viewDate')), 'date'],
        [sequelize.fn('COUNT', sequelize.col('id')), 'views']
      ],
      where: {
        isBot: false,
        viewDate: { 
          [Op.gte]: startDate,
          [Op.lte]: endDate
        }
      },
      group: [sequelize.fn('DATE', sequelize.col('viewDate'))],
      order: [[sequelize.fn('DATE', sequelize.col('viewDate')), 'ASC']]
    });

    // Fill in missing dates with zero views
    const result = [];
    const currentDate = new Date(startDate);
    const finalDate = period === 'lastMonth' ? endDate : new Date();
    
    while (currentDate <= finalDate) {
      const dateStr = currentDate.toISOString().split('T')[0];
      const existing = dailyViews.find(dv => dv.dataValues.date === dateStr);
      
      result.push({
        date: dateStr,
        views: existing ? parseInt(existing.dataValues.views) : 0
      });
      
      currentDate.setDate(currentDate.getDate() + 1);
    }

    res.json(result);
  } catch (error) {
    console.error('Error getting detailed views:', error);
    res.status(500).json({ error: 'Failed to get detailed views' });
  }
});

// Export analytics data (protected route)
router.get('/export', auth, async (req, res) => {
  try {
    const { format = 'json', period = '30days' } = req.query;
    const conditions = analyticsService.getPeriodConditions(period);

    const data = await PageView.findAll({
      where: {
        isBot: false,
        ...conditions
      },
      order: [['viewDate', 'DESC']],
      limit: 10000 // Limit for performance
    });

    if (format === 'csv') {
      // Convert to CSV format
      const csv = [
        'Date,URL,Title,Visitor ID,Device Type,Browser,OS,Country,Traffic Source,Time on Page,Scroll Depth',
        ...data.map(row => [
          row.viewDate,
          row.url,
          row.title || '',
          row.visitorId,
          row.deviceType || '',
          row.browser || '',
          row.operatingSystem || '',
          row.country || '',
          row.trafficSource || '',
          row.timeOnPage || '',
          row.scrollDepth || ''
        ].join(','))
      ].join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=analytics-${period}.csv`);
      res.send(csv);
    } else {
      res.json(data);
    }
  } catch (error) {
    console.error('Error exporting analytics data:', error);
    res.status(500).json({ error: 'Failed to export analytics data' });
  }
});

export default router;
