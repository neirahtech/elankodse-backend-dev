#!/usr/bin/env node

/**
 * Continue Batch Migration Helper
 * 
 * This script automatically continues the batch migration from where it left off.
 * It checks the database to find the last processed post and continues from there.
 */

import Post from '../models/Post.js';
import { sequelize } from '../config/db.js';
import { Op } from 'sequelize';
import { spawn } from 'child_process';

async function continueMigration() {
  try {
    console.log('🔍 Checking migration progress...');
    await sequelize.authenticate();
    
    // Count total posts needing migration
    const totalPosts = await Post.count({
      where: {
        [Op.or]: [
          {
            coverImage: {
              [Op.like]: '%blogger.googleusercontent.com%'
            }
          },
          {
            coverImage: {
              [Op.like]: '%blogspot.com%'
            }
          },
          {
            content: {
              [Op.like]: '%blogger.googleusercontent.com%'
            }
          },
          {
            content: {
              [Op.like]: '%blogspot.com%'
            }
          }
        ]
      }
    });
    
    // Count posts already migrated (no blogger URLs)
    const migratedPosts = await Post.count({
      where: {
        [Op.and]: [
          {
            [Op.or]: [
              { coverImage: { [Op.like]: '/uploads/images/%' } },
              { coverImage: { [Op.is]: null } },
              { coverImage: '' }
            ]
          },
          {
            [Op.or]: [
              { content: { [Op.notLike]: '%blogger.googleusercontent.com%' } },
              { content: { [Op.is]: null } }
            ]
          }
        ]
      }
    });
    
    const remaining = totalPosts;
    const processed = Math.max(0, totalPosts - remaining);
    
    console.log('📊 Migration Status:');
    console.log(`   📚 Total posts needing migration: ${totalPosts}`);
    console.log(`   ✅ Posts processed so far: ${processed}`);
    console.log(`   ⏳ Posts remaining: ${remaining}`);
    console.log(`   📈 Progress: ${((processed / totalPosts) * 100).toFixed(1)}%`);
    
    if (remaining === 0) {
      console.log('🎉 Migration complete! No more posts to process.');
      process.exit(0);
    }
    
    const batchSize = 10;
    const nextOffset = processed;
    
    console.log(`\n🚀 Continuing migration with next batch of ${batchSize} posts...`);
    console.log(`📍 Starting from offset: ${nextOffset}`);
    
    await sequelize.close();
    
    // Run the batch migration
    const child = spawn('node', ['scripts/batch-migrate-images.js', batchSize.toString(), nextOffset.toString()], {
      stdio: 'inherit',
      cwd: process.cwd()
    });
    
    child.on('close', (code) => {
      if (code === 0) {
        console.log('✅ Batch completed successfully!');
        console.log('🔄 Run this command again to continue: node scripts/continue-migration.js');
      } else {
        console.log(`❌ Batch failed with exit code ${code}`);
      }
      process.exit(code);
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

continueMigration();
