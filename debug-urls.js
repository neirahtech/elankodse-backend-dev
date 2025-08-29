#!/usr/bin/env node

/**
 * URL Generation Test Script
 * 
 * This script helps debug URL generation issues in production.
 * Run this script to verify that your environment variables are correctly
 * generating production URLs for image uploads.
 */

import dotenv from 'dotenv';
import { getUrls } from './config/constants.js';
import config from './config/environment.js';

// Load environment variables
dotenv.config();

console.log('\n🔍 URL Generation Debugging Script');
console.log('=====================================\n');

console.log('📋 Environment Variables:');
console.log(`NODE_ENV: ${process.env.NODE_ENV}`);
console.log(`PORT: ${process.env.PORT}`);
console.log(`PRODUCTION_URL: ${process.env.PRODUCTION_URL}`);
console.log(`FRONTEND_URL: ${process.env.FRONTEND_URL}`);
console.log('');

console.log('🌐 URL Resolution:');
const urls = getUrls(process.env.NODE_ENV);
console.log(`Frontend URL: ${urls.frontend}`);
console.log(`Backend URL: ${urls.backend}`);
console.log(`Server URL (from config): ${config.getServerUrl()}`);
console.log('');

console.log('🖼️ Sample Image URL Generation:');
const sampleFilename = 'content_123_1754567890123_0.jpg';
const serverUrl = config.getServerUrl();
const sampleImageUrl = `${serverUrl}/uploads/images/${sampleFilename}`;
console.log(`Generated Image URL: ${sampleImageUrl}`);
console.log('');

console.log('✅ Expected Production URLs:');
console.log('Backend: https://elankodse-backend.onrender.com');
console.log('Frontend: https://test.elankodse.com');
console.log('Image URL: https://elankodse-backend.onrender.com/uploads/images/filename.jpg');
console.log('');

const isCorrect = sampleImageUrl.includes('elankodse-backend.onrender.com');
console.log(`🎯 URL Generation Status: ${isCorrect ? '✅ CORRECT' : '❌ INCORRECT'}`);

if (!isCorrect) {
  console.log('\n🚨 Issues Found:');
  if (process.env.NODE_ENV !== 'production') {
    console.log('- NODE_ENV is not set to "production"');
  }
  if (process.env.PRODUCTION_URL && process.env.PRODUCTION_URL.includes('localhost')) {
    console.log('- PRODUCTION_URL contains localhost');
  }
  console.log('\n💡 Fix:');
  console.log('Set these environment variables in production:');
  console.log('NODE_ENV=production');
  console.log('PRODUCTION_URL=https://elankodse-backend.onrender.com');
  console.log('FRONTEND_URL=https://test.elankodse.com');
}
