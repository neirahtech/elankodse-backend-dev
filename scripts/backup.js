#!/usr/bin/env node

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import config from '../config/environment.js';

const execAsync = promisify(exec);

async function createBackup() {
  try {
    console.log('🚀 Creating database backup for deployment...');
    
    // Create backup directory
    const backupDir = path.join(process.cwd(), 'backups');
    try {
      await fs.access(backupDir);
    } catch {
      await fs.mkdir(backupDir, { recursive: true });
    }

    // Create timestamped backup
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = `elankodse_backup_${timestamp}.sql`;
    const backupPath = path.join(backupDir, backupFile);

    // Create MySQL dump
    const mysqldumpCommand = [
      'mysqldump',
      `-h${config.mysqlHost}`,
      `-P${config.mysqlPort}`,
      `-u${config.mysqlUser}`,
      config.mysqlPassword ? `-p${config.mysqlPassword}` : '',
      '--single-transaction',
      '--routines',
      '--triggers',
      config.mysqlDatabase,
      `> "${backupPath}"`
    ].filter(Boolean).join(' ');

    console.log('🔄 Creating database backup...');
    await execAsync(mysqldumpCommand);
    
    // Get file size
    const stats = await fs.stat(backupPath);
    const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
    
    console.log('✅ Backup completed successfully!');
    console.log(`📁 File: ${backupFile}`);
    console.log(`📊 Size: ${sizeInMB} MB`);
    console.log(`📍 Location: ${backupDir}`);
    console.log('');
    console.log('📋 Next steps for AsuraHosting deployment:');
    console.log('1. Upload this SQL file to your hosting phpMyAdmin');
    console.log('2. Import the SQL file to your production database');
    console.log('3. Upload your backend code to the hosting server');
    console.log('4. Update environment variables (.env file)');
    console.log('5. Run: npm install --production && npm start');
    
    return backupPath;
    
  } catch (error) {
    console.error('❌ Backup failed:', error.message);
    process.exit(1);
  }
}

// Run backup
createBackup();
