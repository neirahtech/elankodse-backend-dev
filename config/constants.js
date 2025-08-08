// Production URL constants
// This file centralizes all URL configurations for easy production deployment

export const PRODUCTION_URLS = {
  // Production Frontend URLs
  FRONTEND_MAIN: 'https://elankodse.com',
  FRONTEND_WWW: 'https://www.elankodse.com',
  FRONTEND_DIGITALOCEAN: 'https://digitalocean.elankodse.com',
  
  // Production Backend URLs
  BACKEND_API: 'https://api.elankodse.com',
  BACKEND_MAIN: 'https://elankodse.com',
  
  // Development URLs (fallbacks)
  DEV_FRONTEND: 'http://localhost:5173',
  DEV_BACKEND: 'http://localhost:8085',
  
  // Asset URLs
  DEFAULT_BANNER: '/src/assets/images/BlackAndBeigeFeminineHowToWebsiteBlogBanner.jpg',
  DEFAULT_OG_IMAGE: '/src/assets/images/BlackAndBeigeFeminineHowToWebsiteBlogBanner.jpg'
};

// Helper functions to get the correct URLs based on environment
export const getUrls = (nodeEnv = process.env.NODE_ENV) => {
  const isProduction = nodeEnv === 'production';
  
  return {
    // Frontend URL - prioritize env var, then production, then dev
    frontend: process.env.FRONTEND_URL || 
              (isProduction ? PRODUCTION_URLS.FRONTEND_MAIN : PRODUCTION_URLS.DEV_FRONTEND),
    
    // Backend URL - prioritize env var, then production, then dev  
    backend: process.env.PRODUCTION_URL || 
             (isProduction ? PRODUCTION_URLS.BACKEND_API : PRODUCTION_URLS.DEV_BACKEND),
    
    // Get full asset URL
    getAssetUrl: (path) => {
      const baseUrl = process.env.FRONTEND_URL || 
                     (isProduction ? PRODUCTION_URLS.FRONTEND_MAIN : PRODUCTION_URLS.DEV_FRONTEND);
      return `${baseUrl}${path}`;
    },
    
    // Get full post URL
    getPostUrl: (postId) => {
      const baseUrl = process.env.FRONTEND_URL || 
                     (isProduction ? PRODUCTION_URLS.FRONTEND_MAIN : PRODUCTION_URLS.DEV_FRONTEND);
      return `${baseUrl}/post/${postId}`;
    },
    
    // Get full book URL
    getBookUrl: (bookId) => {
      const baseUrl = process.env.FRONTEND_URL || 
                     (isProduction ? PRODUCTION_URLS.FRONTEND_MAIN : PRODUCTION_URLS.DEV_FRONTEND);
      return `${baseUrl}/book/${bookId}`;
    }
  };
};

// CORS origins for production
export const PRODUCTION_CORS_ORIGINS = [
  PRODUCTION_URLS.FRONTEND_MAIN,
  PRODUCTION_URLS.FRONTEND_WWW,
  PRODUCTION_URLS.FRONTEND_DIGITALOCEAN,
  PRODUCTION_URLS.BACKEND_API,
  PRODUCTION_URLS.BACKEND_MAIN
];

// Development CORS origins
export const DEVELOPMENT_CORS_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:3000', 
  'http://localhost:8085',
  'https://localhost:5173',
  'https://localhost:3000'
];

// Get appropriate CORS origins based on environment
export const getCorsOrigins = (nodeEnv = process.env.NODE_ENV) => {
  const isProduction = nodeEnv === 'production';
  
  // If ALLOWED_ORIGINS is set in env, use that
  if (process.env.ALLOWED_ORIGINS) {
    return process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim());
  }
  
  // Otherwise use environment-specific defaults
  if (isProduction) {
    return [...PRODUCTION_CORS_ORIGINS, ...DEVELOPMENT_CORS_ORIGINS]; // Include dev for flexibility
  }
  
  return [...DEVELOPMENT_CORS_ORIGINS, ...PRODUCTION_CORS_ORIGINS]; // Include prod for testing
};

export default {
  PRODUCTION_URLS,
  getUrls,
  getCorsOrigins,
  PRODUCTION_CORS_ORIGINS,
  DEVELOPMENT_CORS_ORIGINS
};
