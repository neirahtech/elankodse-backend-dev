import { DataTypes } from 'sequelize';
import { sequelize } from '../config/db.js';

// Visitor model for tracking unique visitors and their sessions
const Visitor = sequelize.define('Visitor', {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    autoIncrement: true,
    primaryKey: true,
  },
  // Unique visitor identifier (generated on first visit)
  visitorId: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: false,
    index: true,
  },
  // User identification (if logged in)
  userId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    index: true,
  },
  // First visit information
  firstVisit: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  lastVisit: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  // Visit statistics
  totalVisits: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
  },
  totalPageViews: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  totalTimeOnSite: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Total time spent on site in seconds'
  },
  // Visitor characteristics
  ipAddress: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  userAgent: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  // Geographic information
  country: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  region: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  city: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  timezone: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  // Device information
  browser: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  operatingSystem: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  deviceType: {
    type: DataTypes.ENUM('mobile', 'desktop', 'tablet'),
    allowNull: true,
  },
  screenResolution: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  // Language preference
  language: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  // First visit source
  initialReferrer: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  initialTrafficSource: {
    type: DataTypes.ENUM('direct', 'search', 'social', 'referral', 'email', 'other'),
    defaultValue: 'direct',
  },
  // Engagement metrics
  averageSessionDuration: {
    type: DataTypes.FLOAT,
    defaultValue: 0,
    comment: 'Average session duration in seconds'
  },
  bounceRate: {
    type: DataTypes.FLOAT,
    defaultValue: 0,
    comment: 'Percentage of single-page sessions'
  },
  // Subscription/Engagement status
  isSubscriber: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  hasCommented: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  hasLiked: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  // Session tracking
  currentSessionId: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  currentSessionStart: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  // Bot detection
  isBot: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  botType: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Type of bot if detected (GoogleBot, BingBot, etc.)'
  },
  // Privacy
  acceptedCookies: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  optOutTracking: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
}, {
  tableName: 'visitors'
});

export default Visitor;
