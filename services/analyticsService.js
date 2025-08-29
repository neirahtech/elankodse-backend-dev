import Analytics from '../models/Analytics.js';
import { PageView, Visitor, Post } from '../models/index.js';
import { Op } from 'sequelize';
import { sequelize } from '../config/db.js';
import UAParser from 'ua-parser-js';
import { getUserIdentifier } from '../utils/userIdentification.js';
import crypto from 'crypto';

class AnalyticsService {
  constructor() {
    this.botPatterns = [
      /bot|crawler|spider|crawling/i,
      /google|bing|yahoo|baidu|yandex|duckduckbot/i,
      /facebook|twitter|linkedin|pinterest/i,
      /whatsapp|telegram|slack/i
    ];
  }

  // Generate a unique visitor ID
  generateVisitorId(identityFactors, userAgent) {
    try {
      const hash = crypto.createHash('sha256');
      hash.update(identityFactors);
      const baseHash = hash.digest('hex').substring(0, 16);
      
      // Add timestamp component to ensure uniqueness while maintaining some consistency
      const timeComponent = Math.floor(Date.now() / (1000 * 60 * 60 * 6)); // 6-hour windows
      
      return `visitor_${baseHash}_${timeComponent}`;
    } catch (error) {
      console.warn('Error generating visitor ID, using fallback:', error);
      // Fallback to simpler method
      return `visitor_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
  }

  // Detect if request is from a bot
  isBot(userAgent) {
    if (!userAgent) return false;
    return this.botPatterns.some(pattern => pattern.test(userAgent));
  }

  // Parse user agent for browser/device information
  parseUserAgent(userAgent) {
    const parser = new UAParser(userAgent);
    const result = parser.getResult();
    
    return {
      browser: result.browser.name || 'Unknown',
      browserVersion: result.browser.version || 'Unknown',
      operatingSystem: result.os.name || 'Unknown',
      deviceType: this.getDeviceType(result),
    };
  }

  // Determine device type
  getDeviceType(uaResult) {
    if (uaResult.device.type === 'mobile') return 'mobile';
    if (uaResult.device.type === 'tablet') return 'tablet';
    return 'desktop';
  }

  // Determine traffic source
  getTrafficSource(referrer) {
    if (!referrer) return 'direct';
    
    const domain = this.extractDomain(referrer);
    
    // Search engines
    if (/google|bing|yahoo|baidu|yandex|duckduckgo/i.test(domain)) {
      return 'search';
    }
    
    // Social media
    if (/facebook|twitter|instagram|linkedin|pinterest|reddit|youtube|tiktok/i.test(domain)) {
      return 'social';
    }
    
    // Email
    if (/gmail|outlook|yahoo|mail/i.test(domain)) {
      return 'email';
    }
    
    return 'referral';
  }

  // Extract domain from URL
  extractDomain(url) {
    try {
      return new URL(url).hostname.toLowerCase();
    } catch {
      return '';
    }
  }

  // Truncate string to a specified maximum length
  truncateString(str, maxLength) {
    if (!str) return null;
    if (str.length <= maxLength) return str;
    return str.substring(0, maxLength);
  }

  // Record a page view
  async recordPageView(data, req) {
    try {
      const {
        postId,
        url,
        title,
        ipAddress,
        userAgent,
        referrer,
        userId,
        sessionId,
        timeOnPage,
        scrollDepth
      } = data;

      // Get consistent user ID that matches like functionality
      const consistentUserId = getUserIdentifier(req);

      console.log('Recording page view with data:', {
        postId, url: url?.substring(0, 100) + '...', title, 
        visitorId: data.visitorId, sessionId, 
        consistentUserId: consistentUserId.slice(0, 20) + '...',
        ipAddress: ipAddress?.substring(0, 10) + '...',
        environment: process.env.NODE_ENV
      });

      // Parse user agent
      const deviceInfo = this.parseUserAgent(userAgent);
      const isBot = this.isBot(userAgent);
      
      // Skip bot traffic for analytics
      if (isBot) {
        console.log('Skipping bot traffic:', userAgent?.substring(0, 100));
        return null;
      }

      // Enhanced visitor ID generation for production
      let visitorId = data.visitorId;
      if (!visitorId) {
        // In production, create a more robust visitor ID using multiple factors
        const identityFactors = [
          ipAddress,
          userAgent?.substring(0, 200), // Truncate to avoid issues
          // Add more entropy in production
          process.env.NODE_ENV === 'production' ? Date.now().toString() : ''
        ].filter(Boolean).join('-');
        
        visitorId = this.generateVisitorId(identityFactors, userAgent);
        console.log('Generated new visitor ID for production:', visitorId.substring(0, 10) + '...');
      }

      // Determine traffic source
      const trafficSource = this.getTrafficSource(referrer);
      const referrerDomain = referrer ? this.extractDomain(referrer) : null;
      
      // Truncate referrer URL if it's too long for database
      const truncatedReferrer = referrer ? this.truncateString(referrer, 255) : null;

      // Validate required fields before database insert
      if (!url) {
        throw new Error('URL is required for page view tracking');
      }

      if (url.length > 255) {
        throw new Error('URL too long for database storage');
      }

      // Check for duplicate page views using consistent user identification
      // This ensures page view deduplication works the same way as like functionality
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000); // 5 minutes
      
      const recentPageView = await PageView.findOne({
        where: {
          [Op.or]: [
            // Same consistent user ID, same URL within 5 minutes (primary check)
            {
              userId: consistentUserId,
              url,
              viewDate: {
                [Op.gte]: fiveMinutesAgo
              }
            },
            // Fallback: Same visitor ID for backward compatibility
            {
              visitorId,
              url,
              viewDate: {
                [Op.gte]: fiveMinutesAgo
              }
            },
            // Same session, same URL within 5 minutes (covers session-based tracking)
            sessionId ? {
              sessionId,
              url,
              viewDate: {
                [Op.gte]: fiveMinutesAgo
              }
            } : null
          ].filter(Boolean) // Remove null values
        },
        order: [['viewDate', 'DESC']]
      });

      if (recentPageView) {
        const timeSinceLastView = Date.now() - recentPageView.viewDate.getTime();
        console.log('Skipping duplicate page view within 5 minutes:', {
          consistentUserId: consistentUserId.slice(0, 20) + '...',
          visitorId,
          sessionId,
          url: url.substring(0, 50) + '...',
          timeSinceLastView: Math.round(timeSinceLastView / 1000) + 's'
        });
        
        // Update the existing page view's timestamp and user ID to show recent activity
        await recentPageView.update({
          viewDate: new Date(),
          userId: consistentUserId, // Ensure consistent user ID is stored
          timeOnPage: timeOnPage || recentPageView.timeOnPage,
          scrollDepth: scrollDepth || recentPageView.scrollDepth
        });
        
        return recentPageView; // Return the updated page view instead of creating a duplicate
      }

      // Create page view record with consistent user identification
      const pageView = await PageView.create({
        postId,
        url,
        title: title ? this.truncateString(title, 255) : null,
        visitorId,
        sessionId,
        userId: consistentUserId, // Store consistent user ID instead of basic userId
        ipAddress,
        userAgent: userAgent ? this.truncateString(userAgent, 1000) : null,
        browser: deviceInfo.browser,
        browserVersion: deviceInfo.browserVersion,
        operatingSystem: deviceInfo.operatingSystem,
        deviceType: deviceInfo.deviceType,
        referrer: truncatedReferrer,
        referrerDomain,
        trafficSource,
        timeOnPage: timeOnPage || 0,
        scrollDepth: scrollDepth || 0,
        viewHour: new Date().getHours(),
        isBot
      });

      console.log('Successfully created page view with consistent user ID:', {
        pageViewId: pageView.id,
        consistentUserId: consistentUserId.slice(0, 20) + '...',
        visitorId: visitorId.slice(0, 10) + '...'
      });

      // Update or create visitor record
      await this.updateVisitor(visitorId, {
        userId,
        ipAddress,
        userAgent,
        deviceInfo,
        trafficSource,
        referrer,
        isBot
      });

      // Update post views if it's a post
      if (postId) {
        await this.updatePostViews(postId);
      }

      // Update daily analytics with enhanced deduplication
      await this.updateDailyAnalytics(postId, {
        deviceType: deviceInfo.deviceType,
        trafficSource,
        visitorId,
        browser: deviceInfo.browser,
        operatingSystem: deviceInfo.operatingSystem,
        viewHour: new Date().getHours(),
        sessionId: sessionId || visitorId  // Add session info for better deduplication
      });

      return pageView;
    } catch (error) {
      console.error('Error recording page view:', error);
      console.error('Data that caused error:', JSON.stringify(data, null, 2));
      throw error;
    }
  }

  // Update visitor information
  async updateVisitor(visitorId, data) {
    try {
      const [visitor, created] = await Visitor.findOrCreate({
        where: { visitorId },
        defaults: {
          visitorId,
          userId: data.userId,
          ipAddress: data.ipAddress,
          userAgent: data.userAgent,
          browser: data.deviceInfo.browser,
          operatingSystem: data.deviceInfo.operatingSystem,
          deviceType: data.deviceInfo.deviceType,
          initialReferrer: data.referrer,
          initialTrafficSource: data.trafficSource,
          isBot: data.isBot,
          totalPageViews: 1
        }
      });

      if (!created) {
        // Update existing visitor
        await visitor.update({
          lastVisit: new Date(),
          totalVisits: visitor.totalVisits + 1,
          totalPageViews: visitor.totalPageViews + 1,
          userId: data.userId || visitor.userId
        });
      }

      return visitor;
    } catch (error) {
      console.error('Error updating visitor:', error);
      throw error;
    }
  }

  // Update post view count
  async updatePostViews(postId) {
    try {
      const post = await Post.findOne({ where: { postId } });
      if (post) {
        await post.update({
          views: (post.views || 0) + 1
        });
      }
    } catch (error) {
      console.error('Error updating post views:', error);
    }
  }

  // Update daily analytics
  async updateDailyAnalytics(postId, data) {
    try {
      const now = new Date();
      const date = now.toISOString().split('T')[0];
      const year = now.getFullYear();
      const month = now.getMonth() + 1;
      const day = now.getDate();

      // Handle null/undefined postId by setting it to null explicitly
      const cleanPostId = postId || null;

      const [analytics, created] = await Analytics.findOrCreate({
        where: { postId: cleanPostId, date },
        defaults: {
          postId: cleanPostId,
          date,
          year,
          month,
          day,
          views: 1,
          visitors: 1,
          hourlyViews: { [data.viewHour]: 1 },
          browsers: { [data.browser]: 1 },
          operatingSystems: { [data.operatingSystem]: 1 }
        }
      });

      if (!created) {
        // Update existing analytics - Handle JSON fields that might be strings
        let hourlyViews = {};
        try {
          hourlyViews = typeof analytics.hourlyViews === 'string' 
            ? JSON.parse(analytics.hourlyViews) 
            : (analytics.hourlyViews || {});
        } catch (e) {
          console.warn('Failed to parse hourlyViews JSON, using empty object:', e.message);
          hourlyViews = {};
        }
        hourlyViews[data.viewHour] = (hourlyViews[data.viewHour] || 0) + 1;

        let browsers = {};
        try {
          browsers = typeof analytics.browsers === 'string' 
            ? JSON.parse(analytics.browsers) 
            : (analytics.browsers || {});
        } catch (e) {
          console.warn('Failed to parse browsers JSON, using empty object:', e.message);
          browsers = {};
        }
        browsers[data.browser] = (browsers[data.browser] || 0) + 1;

        let operatingSystems = {};
        try {
          operatingSystems = typeof analytics.operatingSystems === 'string' 
            ? JSON.parse(analytics.operatingSystems) 
            : (analytics.operatingSystems || {});
        } catch (e) {
          console.warn('Failed to parse operatingSystems JSON, using empty object:', e.message);
          operatingSystems = {};
        }
        operatingSystems[data.operatingSystem] = (operatingSystems[data.operatingSystem] || 0) + 1;

        await analytics.update({
          views: analytics.views + 1,
          hourlyViews,
          browsers,
          operatingSystems,
          [`${data.deviceType}Views`]: (analytics[`${data.deviceType}Views`] || 0) + 1,
          [`${data.trafficSource}Traffic`]: (analytics[`${data.trafficSource}Traffic`] || 0) + 1
        });
      }

      return analytics;
    } catch (error) {
      console.error('Error updating daily analytics:', error);
      throw error;
    }
  }

  // Get site statistics
  async getSiteStats(period = 'all') {
    try {
      const conditions = this.getPeriodConditions(period);
      
      // Get total views
      const totalViews = await PageView.count({
        where: {
          isBot: false,
          ...conditions
        }
      });

      // Get unique visitors
      const uniqueVisitors = await PageView.count({
        distinct: true,
        col: 'visitorId',
        where: {
          isBot: false,
          ...conditions
        }
      });

      // Get period-specific stats
      const periodStats = await this.getPeriodStats();

      return {
        totalViews,
        uniqueVisitors,
        ...periodStats
      };
    } catch (error) {
      console.error('Error getting site stats:', error);
      throw error;
    }
  }

  // Get period-specific statistics
  async getPeriodStats() {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

    const [todayViews, yesterdayViews, thisMonthViews, lastMonthViews] = await Promise.all([
      PageView.count({
        where: {
          isBot: false,
          viewDate: { [Op.gte]: today }
        }
      }),
      PageView.count({
        where: {
          isBot: false,
          viewDate: {
            [Op.gte]: yesterday,
            [Op.lt]: today
          }
        }
      }),
      PageView.count({
        where: {
          isBot: false,
          viewDate: { [Op.gte]: thisMonth }
        }
      }),
      PageView.count({
        where: {
          isBot: false,
          viewDate: {
            [Op.gte]: lastMonth,
            [Op.lte]: lastMonthEnd
          }
        }
      })
    ]);

    return {
      today: todayViews,
      yesterday: yesterdayViews,
      thisMonth: thisMonthViews,
      lastMonth: lastMonthViews
    };
  }

  // Get post statistics
  async getPostStats(postId, period = '7days') {
    try {
      const conditions = this.getPeriodConditions(period);
      
      const stats = await PageView.findAll({
        attributes: [
          [sequelize.fn('DATE', sequelize.col('viewDate')), 'date'],
          [sequelize.fn('COUNT', sequelize.col('id')), 'views']
        ],
        where: {
          postId,
          isBot: false,
          ...conditions
        },
        group: [sequelize.fn('DATE', sequelize.col('viewDate'))],
        order: [[sequelize.fn('DATE', sequelize.col('viewDate')), 'ASC']]
      });

      const totalViews = await PageView.count({
        where: {
          postId,
          isBot: false,
          ...conditions
        }
      });

      return {
        totalViews,
        dailyViews: stats.map(stat => ({
          date: stat.dataValues.date,
          views: parseInt(stat.dataValues.views)
        }))
      };
    } catch (error) {
      console.error('Error getting post stats:', error);
      throw error;
    }
  }

  // Get period conditions for queries
  getPeriodConditions(period) {
    const now = new Date();
    
    switch (period) {
      case 'today':
        return {
          viewDate: {
            [Op.gte]: new Date(now.getFullYear(), now.getMonth(), now.getDate())
          }
        };
      case 'yesterday':
        const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        return {
          viewDate: {
            [Op.gte]: new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate()),
            [Op.lt]: new Date(now.getFullYear(), now.getMonth(), now.getDate())
          }
        };
      case '7days':
        return {
          viewDate: {
            [Op.gte]: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
          }
        };
      case '30days':
        return {
          viewDate: {
            [Op.gte]: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
          }
        };
      case 'thisMonth':
        return {
          viewDate: {
            [Op.gte]: new Date(now.getFullYear(), now.getMonth(), 1)
          }
        };
      case 'lastMonth':
        const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
        return {
          viewDate: {
            [Op.gte]: lastMonth,
            [Op.lte]: lastMonthEnd
          }
        };
      case 'all':
      default:
        return {};
    }
  }

  // Get top posts by views (Enhanced with likes and comments - Blogger style)
  async getTopPosts(limit = 10, period = '30days') {
    try {
      console.log(`📊 Analytics: Getting top posts (limit: ${limit}, period: ${period})`);
      
      const conditions = this.getPeriodConditions(period);
      console.log('📊 Analytics: Period conditions:', conditions);
      
      // Get view counts from analytics
      const postViews = await PageView.findAll({
        attributes: [
          'postId',
          [sequelize.fn('COUNT', sequelize.col('PageView.id')), 'views']
        ],
        where: {
          postId: { [Op.not]: null },
          isBot: false,
          ...conditions
        },
        group: ['postId'],
        order: [[sequelize.fn('COUNT', sequelize.col('PageView.id')), 'DESC']],
        limit: limit * 2 // Get more to filter out any missing posts
      });

      console.log(`📊 Analytics: Found ${postViews.length} posts with analytics data for period ${period}`);

      // Get the post IDs
      const postIds = postViews.map(pv => pv.postId);
      console.log('📊 Analytics: PostIds from analytics:', postIds);
      
      // ENHANCED: If no analytics data for the period, use all posts with their existing stats
      if (postIds.length === 0) {
        console.log('📊 No analytics data found for period, using all published posts with existing stats');
        
        // Get all published posts with their existing views, likes, comments
        const allPosts = await Post.findAll({
          where: {
            status: 'published',
            hidden: false
          },
          attributes: ['postId', 'title', 'urlSlug', 'publishedAt', 'likes', 'comments', 'views', 'category'],
          order: [
            // Sort by engagement score: views + likes*2 + comments*5
            [sequelize.literal('(COALESCE(views, 0) + COALESCE(likes, 0) * 2 + COALESCE(comments, 0) * 5)'), 'DESC'],
            ['views', 'DESC'], // Secondary sort by views
            ['publishedAt', 'DESC'] // Tertiary sort by date
          ],
          limit
        });

        console.log(`📊 Found ${allPosts.length} published posts for analytics`);
        
        if (allPosts.length === 0) {
          console.log('📊 No published posts found in database');
          return [];
        }
        
        const result = allPosts.map(post => ({
          postId: post.postId,
          title: post.title,
          urlSlug: post.urlSlug,
          publishedAt: post.publishedAt,
          category: post.category,
          views: parseInt(post.views || 0),
          likes: parseInt(post.likes || 0),
          comments: parseInt(post.comments || 0),
          // Calculate engagement score (views + likes*2 + comments*5)
          engagementScore: parseInt(post.views || 0) + parseInt(post.likes || 0) * 2 + parseInt(post.comments || 0) * 5
        }));
        
        console.log(`📊 Returning ${result.length} posts with engagement data`);
        console.log('📊 Sample post:', result[0] || 'None');
        
        return result;
      }

      // Get full post details with likes and comments from the Posts table
      const posts = await Post.findAll({
        where: {
          postId: { [Op.in]: postIds },
          status: 'published',
          hidden: false
        },
        attributes: ['postId', 'title', 'urlSlug', 'publishedAt', 'likes', 'comments', 'views', 'category'],
        limit
      });

      console.log(`📊 Analytics: Found ${posts.length} matching posts in Posts table`);
      if (posts.length === 0 && postIds.length > 0) {
        console.log('📊 Analytics: No posts found for IDs:', postIds);
        console.log('📊 Analytics: Falling back to all published posts');
        
        // Fallback to all published posts
        const allPosts = await Post.findAll({
          where: {
            status: 'published',
            hidden: false
          },
          attributes: ['postId', 'title', 'urlSlug', 'publishedAt', 'likes', 'comments', 'views', 'category'],
          order: [
            [sequelize.literal('(COALESCE(views, 0) + COALESCE(likes, 0) * 2 + COALESCE(comments, 0) * 5)'), 'DESC'],
            ['views', 'DESC'],
            ['publishedAt', 'DESC']
          ],
          limit
        });
        
        return allPosts.map(post => ({
          postId: post.postId,
          title: post.title,
          urlSlug: post.urlSlug,
          publishedAt: post.publishedAt,
          category: post.category,
          views: parseInt(post.views || 0),
          likes: parseInt(post.likes || 0),
          comments: parseInt(post.comments || 0),
          engagementScore: parseInt(post.views || 0) + parseInt(post.likes || 0) * 2 + parseInt(post.comments || 0) * 5
        }));
      }

      // Combine analytics views with post data
      const combinedData = posts.map(post => {
        const viewData = postViews.find(pv => pv.postId === post.postId);
        return {
          postId: post.postId,
          title: post.title,
          urlSlug: post.urlSlug,
          publishedAt: post.publishedAt,
          category: post.category,
          views: parseInt(viewData?.dataValues?.views || post.views || 0),
          likes: parseInt(post.likes || 0),
          comments: parseInt(post.comments || 0),
          // Calculate engagement score (Blogger-style metric)
          engagementScore: parseInt(post.likes || 0) * 2 + parseInt(post.comments || 0) * 5 + parseInt(viewData?.dataValues?.views || post.views || 0)
        };
      });

      // Sort by views (or engagement score) and return top posts
      return combinedData
        .sort((a, b) => b.views - a.views)
        .slice(0, limit);
      
    } catch (error) {
      console.error('Error getting top posts:', error);
      throw error;
    }
  }
}

export default new AnalyticsService();
