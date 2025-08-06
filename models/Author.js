import { DataTypes } from 'sequelize';
import { sequelize } from '../config/db.js';
// import Post from './Post.js'; // Remove to avoid circular dependency

const Author = sequelize.define('Author', {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    autoIncrement: true,
    primaryKey: true,
  },
  name: DataTypes.STRING,
  avatar: DataTypes.STRING,
  quote: DataTypes.STRING,
  updatedAt: DataTypes.DATE,
}, {
  timestamps: false,
});

export default Author; 