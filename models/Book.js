import { DataTypes } from 'sequelize';
import { sequelize } from '../config/db.js';

const Book = sequelize.define('Book', {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    autoIncrement: true,
    primaryKey: true,
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  originalTitle: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Original title if different from display title',
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  coverImage: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'URL to the book cover image',
  },
  category: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Category that matches blog post categories',
  },
  linkType: {
    type: DataTypes.ENUM('category', 'post'),
    defaultValue: 'category',
    comment: 'Whether this book links to a category or specific post',
  },
  linkValue: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Category name or post ID to link to',
  },
  publishedYear: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  genre: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Book genre (கவிதைகள், நாவல், கட்டுரைகள், etc.)',
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    comment: 'Whether to display this book on the books page',
  },
  sortOrder: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Display order on books page',
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  updatedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
}, {
  timestamps: true,
  tableName: 'books',
  indexes: [
    {
      fields: ['isActive', 'sortOrder']
    },
    {
      fields: ['category']
    }
  ]
});

export default Book;
