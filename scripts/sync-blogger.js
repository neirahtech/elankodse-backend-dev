#!/usr/bin/env node

import { fetchAndCacheBloggerData } from '../controllers/utilityController.js';
import connectDB from '../config/db.js';
import '../models/index.js';

console.log('🔄 Starting Blogger sync...');
console.log('This may take a few minutes depending on the number of posts.');

async function syncBloggerData() {
  try {
    // Connect to database
    await connectDB();
    console.log('✅ Database connected');

    // Sync database tables
    const { sequelize } = await import('../config/db.js');
    await sequelize.sync();
    console.log('✅ Database synced');

    // Run Blogger sync
    await fetchAndCacheBloggerData();
    
    console.log('✅ Blogger sync completed successfully!');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Blogger sync failed:', error);
    process.exit(1);
  }
}

syncBloggerData();
