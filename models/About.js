import { DataTypes } from 'sequelize';
import { sequelize } from '../config/db.js';

const About = sequelize.define('About', {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    autoIncrement: true,
    primaryKey: true,
  },
  introduction: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  biography: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  interests: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  books: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: [],
  },
  awards: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  authorName: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  authorTitle: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  email: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  contactLabel: {
    type: DataTypes.STRING,
    allowNull: true,
    defaultValue: 'தொடர்புகட்கு:',
  },
  phone: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  website: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  address: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  socialMedia: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: {},
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
  tableName: 'about',
});

export default About;
