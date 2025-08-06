import { DataTypes } from 'sequelize';
import { sequelize } from '../config/db.js';

const Diary = sequelize.define('Diary', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  year: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      min: 1900,
      max: 2100
    }
  },
  month: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      min: 1,
      max: 12
    }
  },
  monthName: {
    type: DataTypes.STRING(20),
    allowNull: false,
    validate: {
      notEmpty: true
    }
  },
  slug: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
    validate: {
      notEmpty: true
    }
  },
  postCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    validate: {
      min: 0
    }
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
}, {
  tableName: 'diaries',
  timestamps: true,
  indexes: [
    {
      fields: ['year', 'month'],
      unique: true
    },
    {
      fields: ['slug']
    },
    {
      fields: ['postCount']
    },
    {
      fields: ['isActive']
    },
    {
      fields: ['year']
    },
    {
      fields: ['month']
    }
  ]
});

export default Diary;
