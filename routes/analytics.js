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
      return res.status(400).json({ error: 'URL is required' });
    }

    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('User-Agent');
    const referrer = req.get('Referer');
    const userId = req.user ? req.user.id : null;

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
    });

    res.json({ 
      success: true, 
      visitorId: pageView ? pageView.visitorId : visitorId 
    });
  } catch (error) {
    console.error('Error tracking page view:', error);
    res.status(500).json({ error: 'Failed to track page view' });
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

// Get top posts (protected route)
router.get('/top-posts', auth, async (req, res) => {
  try {
    const { limit = 20, period = '30days' } = req.query;
    const topPosts = await analyticsService.getTopPosts(parseInt(limit), period);
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
