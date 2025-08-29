// Production URL constants
// This file centralizes all URL configurations for easy production deployment

export const PRODUCTION_URLS = {
  // Production Frontend URLs
  FRONTEND_MAIN: process.env.PRODUCTION_FRONTEND_URL || 'https://test.elankodse.com',
  FRONTEND_WWW: 'https://www.test.elankodse.com',
  FRONTEND_DIGITALOCEAN: 'https://digitalocean.elankodse.com',
  
  // Production Backend URLs - Use environment variables for easy monthly changes
  BACKEND_API: process.env.PRODUCTION_BACKEND_URL || 'https://elankodse-backend.onrender.com',
  BACKEND_MAIN: process.env.MAIN_DOMAIN || 'https://elankodse.com',
  
  // Development URLs (fallbacks)
  DEV_FRONTEND: process.env.DEVELOPMENT_FRONTEND_URL || 'http://localhost:5173',
  DEV_BACKEND: process.env.DEVELOPMENT_BACKEND_URL || 'http://localhost:8085',
  
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
    
    // Backend URL - FIXED: Prioritize PRODUCTION_URL env var for local testing in production mode
    backend: (() => {
      // If PRODUCTION_URL is explicitly set, use it (allows localhost in production mode for testing)
      if (process.env.PRODUCTION_URL) {
        return process.env.PRODUCTION_URL;
      }
      // Otherwise use environment-based URL
      return isProduction ? PRODUCTION_URLS.BACKEND_API : PRODUCTION_URLS.DEV_BACKEND;
    })(),
    
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

// CORS origins for production - Updated to include all possible domains
export const PRODUCTION_CORS_ORIGINS = [
  // Main production domains
  'https://elankodse.com',                          // Main domain
  'https://www.elankodse.com',                      // WWW domain
  'https://test.elankodse.com',                     // Test/staging environment
  
  // Backend domains
  'https://elankodse-backend.onrender.com',         // Current Render backend
  'https://api.elankodse.com',                      // Future API domain
  
  // Additional possible domains
  'https://digitalocean.elankodse.com',             // DigitalOcean deployment
  'https://app.elankodse.com',                      // App subdomain
  'https://staging.elankodse.com',                  // Staging subdomain
  
  // Local development for mixed environments
  'http://localhost:8085',                          // Local backend
  'http://localhost:5173',                          // Local frontend (Vite)
  'http://localhost:3000'                           // Local frontend (alternative)
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
  
  // PRODUCTION FIX: If no ALLOWED_ORIGINS env var, use comprehensive list
  if (isProduction && !process.env.ALLOWED_ORIGINS) {
    console.log('⚠️ Production mode: No ALLOWED_ORIGINS env var found, using comprehensive CORS list');
    return [
      'https://elankodse.com',
      'https://www.elankodse.com',
      'https://test.elankodse.com',
      'https://app.elankodse.com',
      'https://staging.elankodse.com',
      'https://digitalocean.elankodse.com',
      'http://localhost:5173',
      'http://localhost:3000',
      'http://localhost:8085'
    ];
  }
  
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
