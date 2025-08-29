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
  date: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Backward compatibility field - same as createdAt'
  },
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
      fields: ['status', 'hidden', 'publishedAt']
    },
    // Optimized index for post detail page lookups
    {
      name: 'post_detail_lookup',
      fields: ['urlSlug', 'status', 'hidden']
    },
    {
      name: 'post_detail_lookup_id',
      fields: ['postId', 'status', 'hidden']
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
    }
  ],
  hooks: {
    // Populate date fields before creating a post
    beforeCreate: async (post, options) => {
      if (post.publishedAt && (!post.publishedYear || !post.publishedMonth || !post.publishedDay)) {
        const date = new Date(post.publishedAt);
        if (!isNaN(date.getTime())) {
          post.publishedYear = date.getFullYear();
          post.publishedMonth = date.getMonth() + 1; // getMonth() returns 0-11
          post.publishedDay = date.getDate();
        }
      }
    },
    
    // Populate date fields before updating a post
    beforeUpdate: async (post, options) => {
      if (post.publishedAt && (!post.publishedYear || !post.publishedMonth || !post.publishedDay)) {
        const date = new Date(post.publishedAt);
        if (!isNaN(date.getTime())) {
          post.publishedYear = date.getFullYear();
          post.publishedMonth = date.getMonth() + 1; // getMonth() returns 0-11
          post.publishedDay = date.getDate();
        }
      }
    },
    
    // Update diary entries and clear caches after creating a post
    afterCreate: async (post, options) => {
      try {
        // Import here to avoid circular dependencies
        const { updateDiaryForPost } = await import('../utils/diaryUtils.js');
        const { clearPostsCache, clearDiaryAndPostsCache } = await import('../controllers/postController.js');
        
        // Update diary entries
        await updateDiaryForPost(post);
        
        // Clear all caches to ensure updates are reflected everywhere
        clearDiaryAndPostsCache();
        clearPostsCache();
      } catch (error) {
        // Don't throw error to avoid breaking post creation
        console.error('Error updating diary and clearing cache after post creation:', error);
      }
    },
    
    // Update diary entries and clear caches after updating a post
    afterUpdate: async (post, options) => {
      try {
        // Import here to avoid circular dependencies
        const { updateDiaryForPost } = await import('../utils/diaryUtils.js');
        const { clearPostsCache, clearDiaryAndPostsCache } = await import('../controllers/postController.js');
        
        // Update diary entries
        await updateDiaryForPost(post);
        
        // Clear all caches to ensure updates are reflected everywhere
        clearDiaryAndPostsCache();
        clearPostsCache();
      } catch (error) {
        // Don't throw error to avoid breaking post update
        console.error('Error updating diary and clearing cache after post update:', error);
      }
    },
    
    // Update diary entries after deleting a post
    afterDestroy: async (post, options) => {
      try {
        // Import here to avoid circular dependency
        const { updateDiaryForPost } = await import('../utils/diaryUtils.js');
        
        // For deleted posts, we need to recount the posts for that month
        if (post && post.publishedYear && post.publishedMonth) {
          // Create a fake post object with zero count to trigger recount
          await updateDiaryForPost({
            ...post.dataValues,
            status: 'published', // Force the function to run
            hidden: false
          });
        }
      } catch (error) {
        // Don't throw error to avoid breaking post deletion
        console.error('Error updating diary after post deletion:', error);
      }
    }
  }
});

export default Post; 