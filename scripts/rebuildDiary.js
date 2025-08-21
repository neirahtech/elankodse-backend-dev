import { updateDiaryEntries } from '../utils/diaryUtils.js';
import { sequelize } from '../config/db.js';

/**
 * Script to initially populate or rebuild diary entries
 * Run this script when setting up the system or after data migration
 */
async function rebuildDiaryEntries() {
  try {
    console.log('Starting diary entries rebuild...');
    
    // Ensure database connection
    await sequelize.authenticate();
    console.log('Database connection established');
    
    // Update all diary entries
    const result = await updateDiaryEntries();
    
    console.log('Diary rebuild completed successfully!');
    console.log(`Results: ${result.created} created, ${result.updated} updated, ${result.total} total entries`);
    
    process.exit(0);
  } catch (error) {
    console.error('Error rebuilding diary entries:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  rebuildDiaryEntries();
}

export default rebuildDiaryEntries;
