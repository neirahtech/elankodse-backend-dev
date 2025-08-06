import { DataTypes } from 'sequelize';
import { sequelize } from '../config/db.js';
// import Author from './Author.js'; // Remove to avoid circular dependency

const Post = sequelize.define('Post', {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    autoIncrement: true,
    primaryKey: true,
  },
  postId: {
    type: DataTypes.STRING,
    unique: true,
  },
  title: DataTypes.STRING,
  subtitle: DataTypes.STRING,
  excerpt: DataTypes.TEXT, // Increased size for longer excerpts
  urlSlug: {
    type: DataTypes.STRING,
    allowNull: true,
    unique: true, // Ensure URL slugs are unique
  },
  content: DataTypes.TEXT,
  category: DataTypes.STRING, // Keep for backward compatibility
  categoryId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'categories',
      key: 'id'
    }
  },
  tags: {
    type: DataTypes.JSON,
    defaultValue: [],
  },
  coverImage: DataTypes.STRING,
  images: {
    type: DataTypes.JSON,
    defaultValue: [],
  },
  additionalImages: {
    type: DataTypes.JSON,
    defaultValue: [],
    comment: 'Additional images beyond the main cover image'
  },
  url: DataTypes.STRING,
  comments: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  views: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  likes: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  likedBy: {
    type: DataTypes.JSON,
    defaultValue: [],
  },
  status: {
    type: DataTypes.ENUM('published', 'draft', 'scheduled'),
    defaultValue: 'published',
  },
  hidden: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  authorId: {
    type: DataTypes.INTEGER.UNSIGNED,
    references: {
      model: 'Authors',
      key: 'id'
    }
  },
  author: DataTypes.STRING, // Add this field to match the database schema
  publishedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  // Add indexed date columns for efficient diary filtering
  publishedYear: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  publishedMonth: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  publishedDay: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  updatedAt: DataTypes.DATE,
}, {
  timestamps: true,
  indexes: [
    // Composite index for published posts query optimization
    {
      fields: ['status', 'hidden', 'date']
    },
    // Individual indexes for performance
    {
      fields: ['publishedYear', 'publishedMonth']
    },
    {
      fields: ['publishedYear']
    },
    {
      fields: ['publishedMonth']
    },
    {
      fields: ['publishedDay']
    },
    {
      fields: ['publishedAt']
    },
    {
      fields: ['urlSlug']
    },
    {
      fields: ['categoryId']
    },
    {
      fields: ['status']
    },
    {
      fields: ['hidden']
    },
    {
      fields: ['date']
    }
  ]
});

export default Post; 