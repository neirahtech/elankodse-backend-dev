import { DataTypes } from 'sequelize';
import { sequelize } from '../config/db.js';

// Analytics model for tracking site-wide and post-specific statistics
const Analytics = sequelize.define('Analytics', {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    autoIncrement: true,
    primaryKey: true,
  },
  // Post reference (null for site-wide stats)
  postId: {
    type: DataTypes.STRING,
    allowNull: true,
    index: true,
  },
  // Date tracking
  date: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    index: true,
  },
  year: {
    type: DataTypes.INTEGER,
    allowNull: false,
    index: true,
  },
  month: {
    type: DataTypes.INTEGER,
    allowNull: false,
    index: true,
  },
  day: {
    type: DataTypes.INTEGER,
    allowNull: false,
    index: true,
  },
  // View counts
  views: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  uniqueViews: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  // Visitor tracking
  visitors: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  returningVisitors: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  // Engagement metrics
  avgTimeOnPage: {
    type: DataTypes.FLOAT,
    defaultValue: 0,
    comment: 'Average time spent on page in seconds'
  },
  bounceRate: {
    type: DataTypes.FLOAT,
    defaultValue: 0,
    comment: 'Percentage of single-page sessions'
  },
  // Traffic sources
  directTraffic: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  searchTraffic: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  socialTraffic: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  referralTraffic: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  // Device information
  mobileViews: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  desktopViews: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  tabletViews: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  // Geographic data
  countries: {
    type: DataTypes.JSON,
    defaultValue: {},
    comment: 'Country code to view count mapping'
  },
  // Browser/OS data
  browsers: {
    type: DataTypes.JSON,
    defaultValue: {},
    comment: 'Browser name to view count mapping'
  },
  operatingSystems: {
    type: DataTypes.JSON,
    defaultValue: {},
    comment: 'OS name to view count mapping'
  },
  // Hourly distribution
  hourlyViews: {
    type: DataTypes.JSON,
    defaultValue: {},
    comment: 'Hour (0-23) to view count mapping'
  },
}, {
  tableName: 'analytics'
});

export default Analytics;
