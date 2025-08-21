import { DataTypes } from 'sequelize';
import { sequelize } from '../config/db.js';

// PageView model for tracking individual page views with detailed information
const PageView = sequelize.define('PageView', {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    autoIncrement: true,
    primaryKey: true,
  },
  // Post reference
  postId: {
    type: DataTypes.STRING,
    allowNull: true,
    index: true,
  },
  // Page information
  url: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  title: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  // Visitor identification
  visitorId: {
    type: DataTypes.STRING,
    allowNull: true,
    index: true,
  },
  sessionId: {
    type: DataTypes.STRING,
    allowNull: true,
    index: true,
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    index: true,
  },
  // Request information
  ipAddress: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  userAgent: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  // Browser/Device details
  browser: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  browserVersion: {
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
  // Referrer information
  referrer: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  referrerDomain: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  trafficSource: {
    type: DataTypes.ENUM('direct', 'search', 'social', 'referral', 'email', 'other'),
    defaultValue: 'direct',
  },
  searchQuery: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  // Engagement metrics
  timeOnPage: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'Time spent on page in seconds'
  },
  scrollDepth: {
    type: DataTypes.FLOAT,
    allowNull: true,
    comment: 'How far user scrolled (0-100%)'
  },
  exitPage: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Whether this was the last page in the session'
  },
  // Date information
  viewDate: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    index: true,
  },
  viewHour: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  // Additional metadata
  isUniqueView: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Whether this is a unique view for this visitor/post combination'
  },
  isNewVisitor: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Whether this is the first visit from this visitor'
  },
  isBot: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Whether the request appears to be from a bot'
  },
}, {
  tableName: 'page_views',
  indexes: [
    {
      fields: ['postId', 'viewDate']
    },
    {
      fields: ['visitorId']
    },
    {
      fields: ['sessionId']
    },
    {
      fields: ['viewDate']
    },
    {
      fields: ['trafficSource']
    },
    {
      fields: ['deviceType']
    },
    {
      fields: ['country']
    },
    {
      fields: ['isBot']
    }
  ]
});

export default PageView;
