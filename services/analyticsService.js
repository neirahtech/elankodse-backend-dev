import Analytics from '../models/Analytics.js';
import { PageView, Visitor, Post } from '../models/index.js';
import { Op } from 'sequelize';
import { sequelize } from '../config/db.js';
import UAParser from 'ua-parser-js';
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
  generateVisitorId(ip, userAgent) {
    const hash = crypto.createHash('md5');
    hash.update(`${ip}-${userAgent}-${Date.now()}`);
    return hash.digest('hex');
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
  async recordPageView(data) {
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

      // Parse user agent
      const deviceInfo = this.parseUserAgent(userAgent);
      const isBot = this.isBot(userAgent);
      
      // Skip bot traffic for analytics
      if (isBot) {
        return null;
      }

      // Generate or get visitor ID
      let visitorId = data.visitorId;
      if (!visitorId) {
        visitorId = this.generateVisitorId(ipAddress, userAgent);
      }

      // Determine traffic source
      const trafficSource = this.getTrafficSource(referrer);
      const referrerDomain = referrer ? this.extractDomain(referrer) : null;
      
      // Truncate referrer URL if it's too long for database
      const truncatedReferrer = referrer ? this.truncateString(referrer, 255) : null;

      // Create page view record
      const pageView = await PageView.create({
        postId,
        url,
        title,
        visitorId,
        sessionId,
        userId,
        ipAddress,
        userAgent,
        browser: deviceInfo.browser,
        browserVersion: deviceInfo.browserVersion,
        operatingSystem: deviceInfo.operatingSystem,
        deviceType: deviceInfo.deviceType,
        referrer: truncatedReferrer,
        referrerDomain,
        trafficSource,
        timeOnPage,
        scrollDepth,
        viewHour: new Date().getHours(),
        isBot
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

      // Update daily analytics
      await this.updateDailyAnalytics(postId, {
        deviceType: deviceInfo.deviceType,
        trafficSource,
        visitorId,
        browser: deviceInfo.browser,
        operatingSystem: deviceInfo.operatingSystem,
        viewHour: new Date().getHours()
      });

      return pageView;
    } catch (error) {
      console.error('Error recording page view:', error);
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
        // Update existing analytics
        const hourlyViews = analytics.hourlyViews || {};
        hourlyViews[data.viewHour] = (hourlyViews[data.viewHour] || 0) + 1;

        const browsers = analytics.browsers || {};
        browsers[data.browser] = (browsers[data.browser] || 0) + 1;

        const operatingSystems = analytics.operatingSystems || {};
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
      const conditions = this.getPeriodConditions(period);
      
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

      // Get the post IDs
      const postIds = postViews.map(pv => pv.postId);
      
      if (postIds.length === 0) {
        return [];
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
