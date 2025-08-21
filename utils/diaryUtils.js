import { Post, Diary } from '../models/index.js';
import { Op } from 'sequelize';

/**
 * Update or create diary entries based on published posts
 * This function ensures the diary table stays in sync with published posts
 */
export async function updateDiaryEntries() {
  try {
    // Get all published posts with their year/month information
    const posts = await Post.findAll({
      where: {
        status: 'published',
        hidden: false,
        publishedAt: {
          [Op.not]: null
        }
      },
      attributes: ['id', 'publishedAt', 'publishedYear', 'publishedMonth'],
      raw: true
    });

    if (!posts.length) {
      return { created: 0, updated: 0, total: 0 };
    }

    // Group posts by year and month
    const monthGroups = {};
    
    posts.forEach(post => {
      let year = post.publishedYear;
      let month = post.publishedMonth;
      
      // If year/month fields are null, extract from publishedAt
      if (!year || !month) {
        const date = new Date(post.publishedAt);
        if (!isNaN(date.getTime())) {
          year = date.getFullYear();
          month = date.getMonth() + 1; // getMonth() returns 0-11
        }
      }
      
      if (year && month) {
        const key = `${year}-${month}`;
        if (!monthGroups[key]) {
          monthGroups[key] = {
            year,
            month,
            count: 0
          };
        }
        monthGroups[key].count++;
      }
    });

    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    // Update or create diary entries
    const updatedCount = { created: 0, updated: 0 };
    
    for (const [key, data] of Object.entries(monthGroups)) {
      const { year, month, count } = data;
      const monthName = monthNames[month - 1];
      const slug = `${monthName.toLowerCase()}-${year}`;

      try {
        const [diaryEntry, created] = await Diary.findOrCreate({
          where: { year, month },
          defaults: {
            monthName,
            slug,
            postCount: count,
            isActive: true
          }
        });

        if (!created) {
          // Update existing entry
          await diaryEntry.update({
            postCount: count,
            monthName,
            slug,
            isActive: true
          });
          updatedCount.updated++;
        } else {
          updatedCount.created++;
        }
      } catch (error) {
        // Log error but continue processing other entries
        console.error(`Error updating diary entry for ${year}-${month}:`, error.message);
      }
    }

    // Mark diary entries as inactive if they have no posts
    const activeYearMonths = Object.values(monthGroups).map(g => ({ year: g.year, month: g.month }));
    
    if (activeYearMonths.length > 0) {
      await Diary.update(
        { isActive: false, postCount: 0 },
        {
          where: {
            [Op.not]: {
              [Op.or]: activeYearMonths
            },
            isActive: true
          }
        }
      );
    }

    return { ...updatedCount, total: Object.keys(monthGroups).length };
    
  } catch (error) {
    console.error('Error updating diary entries:', error);
    throw error;
  }
}

/**
 * Update diary entry for a specific post
 * This is more efficient for single post updates
 */
export async function updateDiaryForPost(post) {
  try {
    if (!post || post.status !== 'published' || post.hidden) {
      return;
    }

    let year = post.publishedYear;
    let month = post.publishedMonth;
    
    // If year/month fields are null, extract from publishedAt
    if (!year || !month) {
      const date = new Date(post.publishedAt);
      if (!isNaN(date.getTime())) {
        year = date.getFullYear();
        month = date.getMonth() + 1;
      }
    }

    if (!year || !month) {
      console.warn('Cannot determine year/month for post:', post.id);
      return;
    }

    // Count posts for this month/year
    const postCount = await Post.count({
      where: {
        status: 'published',
        hidden: false,
        publishedYear: year,
        publishedMonth: month,
        publishedAt: {
          [Op.not]: null
        }
      }
    });

    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    
    const monthName = monthNames[month - 1];
    const slug = `${monthName.toLowerCase()}-${year}`;

    const [diaryEntry, created] = await Diary.findOrCreate({
      where: { year, month },
      defaults: {
        monthName,
        slug,
        postCount,
        isActive: postCount > 0
      }
    });

    if (!created) {
      await diaryEntry.update({
        postCount,
        monthName,
        slug,
        isActive: postCount > 0
      });
    }

    console.log(`Updated diary entry for ${monthName} ${year}: ${postCount} posts`);
    
  } catch (error) {
    console.error('Error updating diary for post:', error);
  }
}

/**
 * Clear diary cache in frontend
 * This should be called after diary updates to ensure frontend gets fresh data
 */
export function clearDiaryCache() {
  // This function will be used by the API to signal cache clearing
  return {
    cachesToClear: [
      'sidebar-data-diary',
      'sidebar-data-diary-*',
      'calendar-posts-*'
    ]
  };
}
