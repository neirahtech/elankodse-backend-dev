import dotenv from 'dotenv';
import { getCorsOrigins, getUrls } from './constants.js';

dotenv.config();

const config = {
  // MySQL
  mysqlHost: process.env.MYSQL_HOST || 'localhost',
  mysqlUser: process.env.MYSQL_USER || 'root',
  mysqlPassword: process.env.MYSQL_PASSWORD || '',
  mysqlDatabase: process.env.MYSQL_DATABASE || 'elankodse',
  mysqlPort: process.env.MYSQL_PORT || 3306,

  // Server
  port: process.env.PORT || 8084,
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // CORS - Use centralized constants
  allowedOrigins: getCorsOrigins(process.env.NODE_ENV),
  
  // JWT
  jwtSecret: process.env.JWT_SECRET || 'your_jwt_secret_here',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  
  // URLs - Use centralized URL management
  urls: getUrls(process.env.NODE_ENV),
  
  // Check if running in production
  isProduction: process.env.NODE_ENV === 'production',
  
  // Get the appropriate server URL based on environment
  getServerUrl: () => {
    const urls = getUrls(process.env.NODE_ENV);
    return urls.backend;
  },
  
  // Get frontend URL
  getFrontendUrl: () => {
    const urls = getUrls(process.env.NODE_ENV);
    return urls.frontend;
  },
  
  // For development: override to use production URLs when needed
  forceProductionUrls: process.env.FORCE_PRODUCTION_URLS === 'true',
  
  // Legacy support (deprecated - use urls object instead)
  productionUrl: process.env.PRODUCTION_URL || getUrls(process.env.NODE_ENV).backend
};

export default config; 