import { DataTypes } from 'sequelize';
import { sequelize } from '../config/db.js';

const Image = sequelize.define('Image', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'Display name for the image'
  },
  type: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: 'Type/category of the image'
  },
  filename: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'Actual filename stored on disk'
  },
  originalName: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'Original filename uploaded by user'
  },
  path: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'Relative path to the image file'
  },
  url: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'Full URL to access the image'
  },
  size: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: 'File size in bytes'
  },
  mimeType: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'MIME type of the image'
  },
  width: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'Image width in pixels'
  },
  height: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'Image height in pixels'
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    comment: 'Whether this image is currently active'
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Optional description of the image'
  }
}, {
  tableName: 'images',
  timestamps: true,
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
});

export default Image; 