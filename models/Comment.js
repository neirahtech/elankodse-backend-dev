import { DataTypes } from 'sequelize';
import { sequelize } from '../config/db.js';

const Comment = sequelize.define('Comment', {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    autoIncrement: true,
    primaryKey: true,
  },
  postId: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
    references: {
      model: 'Posts',
      key: 'id'
    }
  },
  userId: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: true, // Make optional for anonymous comments
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  text: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  // User information for anonymous comments
  userFirstName: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  userLastName: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  userAvatar: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  // Anonymous identifier
  anonymousId: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  // Hidden status for comments
  hidden: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    allowNull: false,
  },
}, {
  timestamps: true,
});

export default Comment; 